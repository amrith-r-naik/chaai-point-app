import { ENABLE_NEW_PAYMENT_FLOW, PaymentMode } from "@/constants/paymentConstants";
import { db } from "@/lib/db";
import { SplitPayment } from "@/types/payment";
import uuid from "react-native-uuid";
import { enhancedPaymentService } from "./enhancedPaymentService";

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
  targetDate?: string; // For EOD processing
}

class PaymentService {
  private async getNextReceiptNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    
    // Get current year for yearly reset
    const currentYear = new Date().getFullYear();
    
    const result = await db.getFirstAsync(`
      SELECT MAX(CAST(receiptNo AS INTEGER)) as maxReceiptNo FROM receipts
      WHERE strftime('%Y', createdAt) = ?
    `, [currentYear.toString()]) as { maxReceiptNo: number | null };
    
    const nextNumber = (result?.maxReceiptNo || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }

  private async getNextBillNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    
    // Get current year for yearly reset
    const currentYear = new Date().getFullYear();
    
    const result = await db.getFirstAsync(`
      SELECT MAX(CAST(billNumber AS INTEGER)) as maxBillNumber FROM bills
      WHERE strftime('%Y', createdAt) = ?
    `, [currentYear.toString()]) as { maxBillNumber: number | null };
    
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
      total: totalAmount, // Store in rupees (direct KOT total)
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

    // Route through new unified flow if feature flag is enabled
    if (ENABLE_NEW_PAYMENT_FLOW) {
      return this.processPaymentNew(paymentData);
    }

    // Legacy implementation (unchanged)
    return this.processPaymentLegacy(paymentData);
  }

  private async processPaymentNew(paymentData: PaymentProcessData): Promise<{ receipt: Receipt; bill: Bill }> {
    // Convert legacy request to new format
    const components = [];
    let creditPortion = 0;

    if (paymentData.paymentType === "Credit") {
      // Pure credit
      creditPortion = paymentData.totalAmount;
      components.push({
        mode: PaymentMode.CREDIT,
        amount: paymentData.totalAmount
      });
    } else if (paymentData.paymentType === "Split" && paymentData.splitPayments) {
      // Split payment
      for (const split of paymentData.splitPayments) {
        if (split.type === "Credit") {
          creditPortion += split.amount;
          components.push({
            mode: PaymentMode.CREDIT,
            amount: split.amount
          });
        } else {
          components.push({
            mode: split.type === "Cash" ? PaymentMode.CASH : PaymentMode.UPI,
            amount: split.amount
          });
        }
      }
    } else {
      // Single payment (Cash/UPI)
      components.push({
        mode: paymentData.paymentType === "Cash" ? PaymentMode.CASH : PaymentMode.UPI,
        amount: paymentData.totalAmount
      });
    }

    const result = await enhancedPaymentService.processBillSettlement({
      customerId: paymentData.customerId,
      components,
      creditPortion,
      remarks: paymentData.remarks,
      targetDate: paymentData.targetDate
    });

    // For pure credit, return placeholder receipt to maintain backward compatibility
    if (creditPortion === paymentData.totalAmount) {
      const placeholderReceipt: Receipt = {
        id: "credit-only-" + Date.now(),
        receiptNo: "0",
        customerId: paymentData.customerId,
        amount: paymentData.totalAmount,
        mode: "Credit",
        remarks: (paymentData.remarks || "") + " (Added to credit)",
        createdAt: new Date().toISOString(),
      };
      return { receipt: placeholderReceipt, bill: result.bill };
    }

    return { receipt: result.receipt!, bill: result.bill };
  }

  private async processPaymentLegacy(paymentData: PaymentProcessData): Promise<{ receipt: Receipt; bill: Bill }> {
    if (!db) throw new Error("Database not initialized");
    
    // Handle Credit payment separately - just add to dues without creating bill
    if (paymentData.paymentType === "Credit") {
      return this.processCreditPayment(paymentData);
    }

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
        amount: paymentData.totalAmount, // Store in rupees (direct KOT total)
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
        // Store split payment details
        for (const split of paymentData.splitPayments) {
          const splitId = uuid.v4() as string;
          await db.runAsync(`
            INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `, [splitId, receipt.id, split.type, split.amount, receipt.createdAt]);
        }

        // Create individual payment records for each split
        for (const split of paymentData.splitPayments) {
          if (split.type !== "Credit") {
            const payment: Payment = {
              id: uuid.v4() as string,
              billId: bill.id,
              customerId: paymentData.customerId,
              amount: split.amount, // Store in rupees (direct amount)
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
          // For credit payments, create a payment record AND update customer credit balance
          await this.updateCustomerCredit(paymentData.customerId, paymentData.totalAmount);
          
          // Also create a payment record for credit
          const payment: Payment = {
            id: uuid.v4() as string,
            billId: bill.id,
            customerId: paymentData.customerId,
            amount: paymentData.totalAmount, // Store in rupees (direct amount)
            mode: paymentData.paymentType,
            remarks: paymentData.remarks || null,
            createdAt: new Date().toISOString(),
          };

          await db.runAsync(`
            INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, payment.remarks, payment.createdAt]);
        } else {
          const payment: Payment = {
            id: uuid.v4() as string,
            billId: bill.id,
            customerId: paymentData.customerId,
            amount: paymentData.totalAmount, // Store in rupees (direct amount)
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
      await this.linkKOTsToBill(paymentData.customerId, bill.id, paymentData.targetDate);

      // Commit transaction
      await db.execAsync('COMMIT');

      return { receipt, bill };
    } catch (error) {
      // Rollback transaction on error
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }

  private async linkKOTsToBill(customerId: string, billId: string, targetDate?: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // Use provided date or today's date for filtering KOTs
    const dateToUse = targetDate || new Date().toISOString().split('T')[0];
    
    await db.runAsync(`
      UPDATE kot_orders 
      SET billId = ? 
      WHERE customerId = ? 
        AND billId IS NULL 
        AND DATE(createdAt) = DATE(?)
    `, [billId, customerId, dateToUse]);
  }

  private async processCreditPayment(paymentData: PaymentProcessData): Promise<{ receipt: Receipt; bill: Bill }> {
    if (!db) throw new Error("Database not initialized");
    // Pure credit: only add to customer credit balance, no receipt or bill persistence
    await this.updateCustomerCredit(paymentData.customerId, paymentData.totalAmount);
    const placeholderReceipt: Receipt = {
      id: "credit-only-" + Date.now(),
      receiptNo: "0",
      customerId: paymentData.customerId,
      amount: paymentData.totalAmount,
      mode: "Credit",
      remarks: (paymentData.remarks || "") + " (Added to credit)",
      createdAt: new Date().toISOString(),
    };
    const placeholderBill: Bill = {
      id: "credit-only-bill-" + Date.now(),
      billNumber: "0",
      customerId: paymentData.customerId,
      total: paymentData.totalAmount,
      createdAt: new Date().toISOString(),
    };
    return { receipt: placeholderReceipt, bill: placeholderBill };
  }

  private async updateCustomerCredit(customerId: string, amount: number): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    // Column guaranteed in schema; just update
    await db.runAsync(`
      UPDATE customers 
      SET creditBalance = COALESCE(creditBalance, 0) + ?
      WHERE id = ?
    `, [amount, customerId]); // Store direct amount (already in rupees)
  }

  /**
   * Clear customer credit balance (new API)
   */
  async clearCredit(customerId: string, components: any[], remarks?: string): Promise<{ receipt: any; toastMessage: string }> {
    if (ENABLE_NEW_PAYMENT_FLOW) {
      return enhancedPaymentService.clearCredit({
        customerId,
        components,
        remarks
      });
    } else {
      throw new Error("Credit clearance not available in legacy mode");
    }
  }

  async getCustomerCreditBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(`
      SELECT COALESCE(creditBalance, 0) as creditBalance FROM customers WHERE id = ?
    `, [customerId]) as { creditBalance: number };

    return (result?.creditBalance || 0); // Use direct credit balance (already in rupees)
  }

  async getReceipt(receiptId: string): Promise<Receipt | null> {
    if (!db) throw new Error("Database not initialized");

    const receipt = await db.getFirstAsync(`
      SELECT * FROM receipts WHERE id = ?
    `, [receiptId]) as Receipt | null;

    if (receipt) {
      receipt.amount = receipt.amount; // Use direct amount (already in rupees)
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
      amount: payment.amount // Use direct amount (already in rupees)
    }));
  }

  async getCompletedBillsGroupedByDate(): Promise<
    Record<
      string,
      {
        date: string;
        displayDate: string;
        bills: Array<{
          id: string;
          billNumber: string;
          receiptNo: string;
          customerId: string;
          customerName: string;
          customerContact: string | null;
          amount: number;
          mode: string;
          remarks: string | null;
          createdAt: string;
        }>;
      }
    >
  > {
    if (!db) throw new Error("Database not initialized");

    const bills = await db.getAllAsync(`
      SELECT 
        r.id,
        r.receiptNo,
        r.customerId,
        r.amount,
        r.mode,
        r.remarks,
        r.createdAt,
        c.name as customerName,
        c.contact as customerContact,
        b.billNumber
      FROM receipts r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN bills b ON r.customerId = b.customerId 
        AND DATE(r.createdAt) = DATE(b.createdAt)
      ORDER BY r.createdAt DESC
    `) as any[];

    const dateGroups: Record<string, any> = {};

    bills.forEach((bill: any) => {
      const billDate = bill.createdAt.split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      let displayDate: string;
      if (billDate === today) {
        displayDate = "Today";
      } else if (billDate === yesterday) {
        displayDate = "Yesterday";
      } else {
        const date = new Date(billDate);
        const options: Intl.DateTimeFormatOptions = {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          weekday: "long",
        };
        displayDate = date.toLocaleDateString("en-GB", options);
      }

      if (!dateGroups[billDate]) {
        dateGroups[billDate] = {
          date: billDate,
          displayDate,
          bills: [],
        };
      }

      dateGroups[billDate].bills.push({
        id: bill.id,
        billNumber: bill.billNumber || 'N/A',
        receiptNo: bill.receiptNo,
        customerId: bill.customerId,
        customerName: bill.customerName,
        customerContact: bill.customerContact,
        amount: bill.amount, // Use direct amount from receipts (already in rupees)
        mode: bill.mode,
        remarks: bill.remarks,
        createdAt: bill.createdAt,
      });
    });

    return dateGroups;
  }

  async getBillDetails(receiptId: string): Promise<{
    receipt: Receipt;
    customer: any;
    kots: any[];
    splitPayments?: any[];
  } | null> {
    if (!db) throw new Error("Database not initialized");

    // Get receipt details
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) return null;

    // Get customer details
    const customer = await db.getFirstAsync(`
      SELECT * FROM customers WHERE id = ?
    `, [receipt.customerId]) as any;

    // Get split payment details
    const splitPayments = await db.getAllAsync(`
      SELECT * FROM split_payments WHERE receiptId = ?
      ORDER BY createdAt
    `, [receiptId]) as any[];

    // Get related bill
    const bill = await db.getFirstAsync(`
      SELECT * FROM bills 
      WHERE customerId = ? 
        AND DATE(createdAt) = DATE(?)
      ORDER BY createdAt DESC
      LIMIT 1
    `, [receipt.customerId, receipt.createdAt]) as any;

    let kots: any[] = [];
    if (bill) {
      // Get KOTs linked to this bill
      kots = await db.getAllAsync(`
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.createdAt,
          GROUP_CONCAT(mi.name || ' x' || ki.quantity, ', ') as items,
          SUM(ki.quantity * ki.priceAtTime) as total
        FROM kot_orders ko
        LEFT JOIN kot_items ki ON ko.id = ki.kotId
        LEFT JOIN menu_items mi ON ki.itemId = mi.id
        WHERE ko.billId = ?
        GROUP BY ko.id, ko.kotNumber, ko.createdAt
        ORDER BY ko.createdAt
      `, [bill.id]) as any[];

      kots = kots.map(kot => ({
        ...kot,
        total: kot.total || 0
      }));
    }

    return {
      receipt,
      customer,
      kots,
      splitPayments: splitPayments.length > 0 ? splitPayments : undefined,
    };
  }

  async getCustomerReceipts(customerId: string): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      const receipts = await db.getAllAsync(`
        SELECT * FROM receipts 
        WHERE customerId = ?
        ORDER BY createdAt DESC
      `, [customerId]) as any[];

      return receipts;
    } catch (error) {
      console.error("Error fetching customer receipts:", error);
      return [];
    }
  }
}

export const paymentService = new PaymentService();
