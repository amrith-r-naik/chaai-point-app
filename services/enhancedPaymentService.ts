import { PaymentMode, TOAST_MESSAGES } from "@/constants/paymentConstants";
import { db } from "@/lib/db";
import {
    BillSettlementRequest,
    CreditClearanceRequest,
    PaymentComponent
} from "@/types/payment";
import uuid from "react-native-uuid";

// Re-export existing interfaces for backward compatibility
export { Bill, Payment, PaymentProcessData, Receipt } from './paymentService';

/**
 * Enhanced Payment Service implementing the new unified payment flow
 * Supports both legacy and new payment methods during transition
 */
class EnhancedPaymentService {
  
  /**
   * Unified bill settlement function - handles all payment scenarios
   * @param request - Settlement request with components and credit portion
   */
  async processBillSettlement(request: BillSettlementRequest): Promise<{
    bill: any;
    receipt: any | null;
    toastMessage: string;
  }> {
    if (!db) throw new Error("Database not initialized");

    const { customerId, components, creditPortion, remarks, targetDate } = request;
    
    // Calculate totals
    const paidComponents = components.filter(c => c.mode !== PaymentMode.CREDIT);
    const paidPortion = paidComponents.reduce((sum, c) => sum + c.amount, 0);
    const totalAmount = paidPortion + creditPortion;

    // Validate components sum correctly
    const componentSum = components.reduce((sum, c) => sum + c.amount, 0);
    if (Math.abs(componentSum - totalAmount) > 0.01) {
      throw new Error("Payment components do not sum to total amount");
    }

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // 1. Create Bill
      const bill = await this.createBill(customerId, totalAmount);

      let receipt: any | null = null;
      let toastMessage: string;

      // 2. Handle Receipt Creation (only for paid portions)
      if (paidPortion > 0) {
        const receiptMode = paidComponents.length === 1 ? paidComponents[0].mode : PaymentMode.SPLIT;
        receipt = await this.createReceipt(customerId, paidPortion, receiptMode, remarks);

        // Store split payment details if multiple components
        if (paidComponents.length > 1 || creditPortion > 0) {
          await this.storeSplitPaymentDetails(receipt.id, components);
        }
      }

      // 3. Create Payment Records for all components
      for (const component of components) {
        await this.createPaymentRecord(bill.id, customerId, component, remarks);
      }

      // 4. Update customer credit balance if needed
      if (creditPortion > 0) {
        await this.updateCustomerCredit(customerId, creditPortion);
      }

      // 5. Link KOTs to bill
      await this.linkKOTsToBill(customerId, bill.id, targetDate);

      // 6. Determine toast message
      if (paidPortion === 0) {
        // Pure credit
        toastMessage = TOAST_MESSAGES.PURE_CREDIT(creditPortion);
      } else if (creditPortion > 0) {
        // Split with credit
        toastMessage = TOAST_MESSAGES.SPLIT_WITH_CREDIT(paidPortion, creditPortion);
      } else {
        // Pure paid
        toastMessage = TOAST_MESSAGES.PAYMENT_SUCCESSFUL;
      }

      await db.execAsync('COMMIT');

      return { bill, receipt, toastMessage };

    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }

  /**
   * Credit clearance function - reduces customer credit balance
   */
  async clearCredit(request: CreditClearanceRequest): Promise<{
    receipt: any;
    toastMessage: string;
  }> {
    if (!db) throw new Error("Database not initialized");

    const { customerId, components, remarks } = request;
    
    // Calculate total clearance amount
    const clearanceAmount = components.reduce((sum, c) => sum + c.amount, 0);
    
    // Validate against current credit balance
    const currentCreditBalance = await this.getCustomerCreditBalance(customerId);
    if (clearanceAmount > currentCreditBalance) {
      throw new Error(`Clearance amount (₹${clearanceAmount}) exceeds credit balance (₹${currentCreditBalance})`);
    }

    if (clearanceAmount <= 0) {
      throw new Error("Clearance amount must be greater than zero");
    }

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // 1. Create receipt for paid amount
      const receiptMode = components.length === 1 ? components[0].mode : PaymentMode.SPLIT;
      const receipt = await this.createReceipt(customerId, clearanceAmount, receiptMode, remarks);

      // 2. Store split payment details if needed
      if (components.length > 1) {
        await this.storeSplitPaymentDetails(receipt.id, components);
      }

      // 3. Create payment records for each component
      for (const component of components) {
        await this.createPaymentRecord(null, customerId, component, remarks);
      }

      // 4. Create ledger entry for credit clearance
      await this.createPaymentRecord(null, customerId, {
        mode: PaymentMode.CREDIT_CLEAR,
        amount: clearanceAmount
      }, remarks);

      // 5. Decrement credit balance
      await this.updateCustomerCredit(customerId, -clearanceAmount);

      // 6. Determine toast message
      const remainingBalance = currentCreditBalance - clearanceAmount;
      const toastMessage = remainingBalance > 0 
        ? TOAST_MESSAGES.CREDIT_CLEARANCE_PARTIAL(clearanceAmount, remainingBalance)
        : TOAST_MESSAGES.CREDIT_CLEARANCE_FULL(clearanceAmount);

      await db.execAsync('COMMIT');

      return { receipt, toastMessage };

    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get customer's current credit balance (computed from payments if needed)
   */
  async getCustomerCreditBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    // For now, use the stored balance - later we can add reconciliation
    const result = await db.getFirstAsync(`
      SELECT COALESCE(creditBalance, 0) as creditBalance FROM customers WHERE id = ?
    `, [customerId]) as { creditBalance: number };

    return result?.creditBalance || 0;
  }

  /**
   * Compute credit balance from payment history (for reconciliation)
   */
  async computeCreditBalanceFromPayments(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(`
      SELECT 
        COALESCE(SUM(CASE WHEN mode = ? THEN amount ELSE 0 END), 0) as creditAccrual,
        COALESCE(SUM(CASE WHEN mode = ? THEN amount ELSE 0 END), 0) as creditClearance
      FROM payments 
      WHERE customerId = ?
    `, [PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR, customerId]) as any;

    return (result?.creditAccrual || 0) - (result?.creditClearance || 0);
  }

  // Private helper methods

  private async createBill(customerId: string, totalAmount: number): Promise<any> {
    const billNumber = await this.getNextBillNumber();
    const bill = {
      id: uuid.v4() as string,
      billNumber,
      customerId,
      total: totalAmount,
      createdAt: new Date().toISOString(),
    };

    await db!.runAsync(`
      INSERT INTO bills (id, billNumber, customerId, total, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [bill.id, bill.billNumber, bill.customerId, bill.total, bill.createdAt]);

    return bill;
  }

  private async createReceipt(
    customerId: string, 
    amount: number, 
    mode: PaymentMode, 
    remarks?: string
  ): Promise<any> {
    const receiptNo = await this.getNextReceiptNumber();
    const receipt = {
      id: uuid.v4() as string,
      receiptNo,
      customerId,
      amount,
      mode,
      remarks: remarks || null,
      createdAt: new Date().toISOString(),
    };

    await db!.runAsync(`
      INSERT INTO receipts (id, receiptNo, customerId, amount, mode, remarks, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [receipt.id, receipt.receiptNo, receipt.customerId, receipt.amount, receipt.mode, receipt.remarks, receipt.createdAt]);

    return receipt;
  }

  private async createPaymentRecord(
    billId: string | null,
    customerId: string,
    component: PaymentComponent,
    remarks?: string
  ): Promise<void> {
    const payment = {
      id: uuid.v4() as string,
      billId,
      customerId,
      amount: component.amount,
      mode: component.mode,
      remarks: remarks || null,
      createdAt: new Date().toISOString(),
    };

    await db!.runAsync(`
      INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, payment.remarks, payment.createdAt]);
  }

  private async storeSplitPaymentDetails(receiptId: string, components: PaymentComponent[]): Promise<void> {
    for (const component of components) {
      const splitId = uuid.v4() as string;
      await db!.runAsync(`
        INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `, [splitId, receiptId, component.mode, component.amount, new Date().toISOString()]);
    }
  }

  private async updateCustomerCredit(customerId: string, amount: number): Promise<void> {
    await db!.runAsync(`
      UPDATE customers 
      SET creditBalance = COALESCE(creditBalance, 0) + ?
      WHERE id = ?
    `, [amount, customerId]);
  }

  private async linkKOTsToBill(customerId: string, billId: string, targetDate?: string): Promise<void> {
    const dateToUse = targetDate || new Date().toISOString().split('T')[0];
    
    await db!.runAsync(`
      UPDATE kot_orders 
      SET billId = ? 
      WHERE customerId = ? 
        AND billId IS NULL 
        AND DATE(createdAt) = DATE(?)
    `, [billId, customerId, dateToUse]);
  }

  private async getNextReceiptNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    
    const result = await db!.getFirstAsync(`
      SELECT MAX(CAST(receiptNo AS INTEGER)) as maxReceiptNo FROM receipts
      WHERE strftime('%Y', createdAt) = ?
    `, [currentYear.toString()]) as { maxReceiptNo: number | null };
    
    const nextNumber = (result?.maxReceiptNo || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }

  private async getNextBillNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    
    const result = await db!.getFirstAsync(`
      SELECT MAX(CAST(billNumber AS INTEGER)) as maxBillNumber FROM bills
      WHERE strftime('%Y', createdAt) = ?
    `, [currentYear.toString()]) as { maxBillNumber: number | null };
    
    const nextNumber = (result?.maxBillNumber || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }
}

export const enhancedPaymentService = new EnhancedPaymentService();
