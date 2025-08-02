import { db } from "@/lib/db";
import { authState } from "@/state/authState";
import uuid from "react-native-uuid";
import { SplitPayment } from "@/types/payment";

export interface Bill {
  id: string;
  billNumber: string;
  customerId: string;
  total: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  billId: string | null;
  customerId: string;
  amount: number;
  mode: string;
  remarks: string | null;
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  customerId: string;
  amount: number;
  mode: string;
  remarks: string | null;
  createdAt: string;
}

export interface PaymentProcessData {
  billId: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paymentType: string;
  splitPayments?: SplitPayment[];
  remarks?: string;
}

class PaymentService {
  private async getNextReceiptNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db.getFirstAsync(`
      SELECT MAX(receiptNo) as maxReceiptNo FROM receipts
    `) as { maxReceiptNo: number | null };
    
    const nextNumber = (result?.maxReceiptNo || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }

  private async getNextBillNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db.getFirstAsync(`
      SELECT MAX(billNumber) as maxBillNumber FROM bills
    `) as { maxBillNumber: number | null };
    
    const nextNumber = (result?.maxBillNumber || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }

  async createBill(customerId: string, totalAmount: number): Promise<Bill> {
    if (!db) throw new Error("Database not initialized");

    const billNumber = await this.getNextBillNumber();
    const bill: Bill = {
      id: uuid.v4() as string,
      billNumber,
      customerId,
      total: Math.round(totalAmount * 100), // Store in cents
      createdAt: new Date().toISOString(),
    };

    await db.runAsync(`
      INSERT INTO bills (id, billNumber, customerId, total, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [bill.id, bill.billNumber, bill.customerId, bill.total, bill.createdAt]);

    return bill;
  }

  async processPayment(paymentData: PaymentProcessData): Promise<{ receipt: Receipt; bill: Bill }> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Start transaction
      await db.execAsync('BEGIN TRANSACTION');

      // Create bill
      const bill = await this.createBill(paymentData.customerId, paymentData.totalAmount);

      // Generate receipt number
      const receiptNo = await this.getNextReceiptNumber();

      // Create receipt
      const receipt: Receipt = {
        id: uuid.v4() as string,
        receiptNo,
        customerId: paymentData.customerId,
        amount: Math.round(paymentData.totalAmount * 100),
        mode: paymentData.paymentType,
        remarks: paymentData.remarks || null,
        createdAt: new Date().toISOString(),
      };

      await db.runAsync(`
        INSERT INTO receipts (id, receiptNo, customerId, amount, mode, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [receipt.id, receipt.receiptNo, receipt.customerId, receipt.amount, receipt.mode, receipt.remarks, receipt.createdAt]);

      // Process payments based on type
      if (paymentData.paymentType === "Split" && paymentData.splitPayments) {
        // Create individual payment records for each split
        for (const split of paymentData.splitPayments) {
          if (split.type !== "Credit") {
            const payment: Payment = {
              id: uuid.v4() as string,
              billId: bill.id,
              customerId: paymentData.customerId,
              amount: Math.round(split.amount * 100),
              mode: split.type,
              remarks: paymentData.remarks || null,
              createdAt: new Date().toISOString(),
            };

            await db.runAsync(`
              INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, payment.remarks, payment.createdAt]);
          } else {
            // Handle credit payment - this would update customer credit balance
            await this.updateCustomerCredit(paymentData.customerId, split.amount);
          }
        }
      } else {
        // Single payment
        if (paymentData.paymentType === "Credit") {
          await this.updateCustomerCredit(paymentData.customerId, paymentData.totalAmount);
        } else {
          const payment: Payment = {
            id: uuid.v4() as string,
            billId: bill.id,
            customerId: paymentData.customerId,
            amount: Math.round(paymentData.totalAmount * 100),
            mode: paymentData.paymentType,
            remarks: paymentData.remarks || null,
            createdAt: new Date().toISOString(),
          };

          await db.runAsync(`
            INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, payment.remarks, payment.createdAt]);
        }
      }

      // Update KOT orders to link with this bill
      await this.linkKOTsToBill(paymentData.customerId, bill.id);

      // Commit transaction
      await db.execAsync('COMMIT');

      return { receipt, bill };
    } catch (error) {
      // Rollback transaction on error
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }

  private async linkKOTsToBill(customerId: string, billId: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // Get today's date for filtering KOTs
    const today = new Date().toISOString().split('T')[0];
    
    await db.runAsync(`
      UPDATE kot_orders 
      SET billId = ? 
      WHERE customerId = ? 
        AND billId IS NULL 
        AND DATE(createdAt) = DATE(?)
    `, [billId, customerId, today]);
  }

  private async updateCustomerCredit(customerId: string, amount: number): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // First, check if customer credit column exists, if not add it
    try {
      await db.execAsync(`
        ALTER TABLE customers ADD COLUMN creditBalance INTEGER DEFAULT 0
      `);
    } catch (error) {
      // Column might already exist, that's fine
    }

    // Update customer credit balance
    await db.runAsync(`
      UPDATE customers 
      SET creditBalance = COALESCE(creditBalance, 0) + ?
      WHERE id = ?
    `, [Math.round(amount * 100), customerId]);
  }

  async getCustomerCreditBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(`
      SELECT COALESCE(creditBalance, 0) as creditBalance FROM customers WHERE id = ?
    `, [customerId]) as { creditBalance: number };

    return (result?.creditBalance || 0) / 100; // Convert from cents
  }

  async getReceipt(receiptId: string): Promise<Receipt | null> {
    if (!db) throw new Error("Database not initialized");

    const receipt = await db.getFirstAsync(`
      SELECT * FROM receipts WHERE id = ?
    `, [receiptId]) as Receipt | null;

    if (receipt) {
      receipt.amount = receipt.amount / 100; // Convert from cents
    }

    return receipt;
  }

  async getPaymentHistory(customerId: string): Promise<Payment[]> {
    if (!db) throw new Error("Database not initialized");

    const payments = await db.getAllAsync(`
      SELECT * FROM payments 
      WHERE customerId = ? 
      ORDER BY createdAt DESC
    `, [customerId]) as Payment[];

    return payments.map(payment => ({
      ...payment,
      amount: payment.amount / 100 // Convert from cents
    }));
  }
}

export const paymentService = new PaymentService();
