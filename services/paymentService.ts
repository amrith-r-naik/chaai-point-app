import { computeISTBusinessDate, db } from "@/lib/db";
import { SplitPayment } from "@/types/payment";
import uuid from "react-native-uuid";

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
  private async getOrInitSequence(key: string, initialQuery?: { sql: string; params?: any[] }): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    // Try insert ignore with 0 then if need seed from existing max
    await db.runAsync(`INSERT OR IGNORE INTO sequences (key, value) VALUES (?, 0)`, [key]);
    if (initialQuery) {
      const row = (await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [key])) as any;
      if (row.value === 0) {
        const init = (await db.getFirstAsync(initialQuery.sql, initialQuery.params || [])) as any;
        const existingMax = init?.maxVal ? Number(init.maxVal) : 0;
        if (existingMax > 0) {
          await db.runAsync(`UPDATE sequences SET value = ? WHERE key = ?`, [existingMax, key]);
        }
      }
    }
    return (await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [key]) as any).value;
  }

  private async nextSequence(key: string, initialQuery?: { sql: string; params?: any[] }): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    await this.getOrInitSequence(key, initialQuery);
    await db.runAsync(`UPDATE sequences SET value = value + 1 WHERE key = ?`, [key]);
    const row = (await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [key])) as any;
    return row.value;
  }

  private async getNextReceiptNumber(businessDate: string): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    const year = businessDate.split('-')[0];
    const seqKey = `receipt:${year}`;
    const nextNum = await this.nextSequence(seqKey, {
      sql: `SELECT MAX(receiptNo) as maxVal FROM receipts WHERE businessDate LIKE ?`,
      params: [`${year}-%`]
    });
    return nextNum.toString().padStart(6, '0');
  }

  private async getNextBillNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    const seqKey = `bill`;
    const nextNum = await this.nextSequence(seqKey, {
      sql: `SELECT MAX(billNumber) as maxVal FROM bills`,
    });
    return nextNum.toString().padStart(6, '0');
  }

  async createBill(customerId: string, totalAmount: number): Promise<Bill> {
    if (!db) throw new Error("Database not initialized");

    const nowIso = new Date().toISOString();
    const businessDate = computeISTBusinessDate(nowIso);
    const billNumber = await this.getNextBillNumber();
    const bill: Bill = {
      id: uuid.v4() as string,
      billNumber,
      customerId,
      total: totalAmount,
      createdAt: nowIso,
    };

    await db.runAsync(`
      INSERT INTO bills (id, billNumber, customerId, total, createdAt, businessDate)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [bill.id, bill.billNumber, bill.customerId, bill.total, bill.createdAt, businessDate]);

    return bill;
  }

  async processPayment(paymentData: PaymentProcessData): Promise<{ receipt: Receipt; bill: Bill }> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Start transaction
      await db.execAsync('BEGIN TRANSACTION');

      // Create bill
      const bill = await this.createBill(paymentData.customerId, paymentData.totalAmount);
      const businessDate = computeISTBusinessDate(bill.createdAt);
      // Generate receipt number
      const receiptNo = await this.getNextReceiptNumber(businessDate);

      // Create receipt
      const receipt: Receipt = {
        id: uuid.v4() as string,
        receiptNo,
        customerId: paymentData.customerId,
        amount: paymentData.totalAmount,
        mode: paymentData.paymentType,
        remarks: paymentData.remarks || null,
        createdAt: bill.createdAt,
      };

      await db.runAsync(`
        INSERT INTO receipts (id, receiptNo, customerId, amount, mode, remarks, createdAt, businessDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [receipt.id, receipt.receiptNo, receipt.customerId, receipt.amount, receipt.mode, receipt.remarks, receipt.createdAt, businessDate]);

      // Process payments based on type
      if (paymentData.paymentType === "Split" && paymentData.splitPayments) {
        // Create individual payment records for each split
        for (const split of paymentData.splitPayments) {
          if (split.amount <= 0) continue;
          if (split.type !== "Credit") {
            const payment: Payment = {
              id: uuid.v4() as string,
              billId: bill.id,
              customerId: paymentData.customerId,
              amount: split.amount,
              mode: split.type,
              remarks: paymentData.remarks || null,
              createdAt: new Date().toISOString(),
            };
            await db.runAsync(`
              INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, payment.remarks, payment.createdAt]);
          } else {
            // Credit component: update credit balance AND persist a payment row for audit consistency
            await this.updateCustomerCredit(paymentData.customerId, split.amount);
            const creditPayment: Payment = {
              id: uuid.v4() as string,
              billId: bill.id,
              customerId: paymentData.customerId,
              amount: split.amount,
              mode: 'Credit',
              remarks: paymentData.remarks || null,
              createdAt: new Date().toISOString(),
            };
            await db.runAsync(`
              INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [creditPayment.id, creditPayment.billId, creditPayment.customerId, creditPayment.amount, creditPayment.mode, creditPayment.remarks, creditPayment.createdAt]);
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
      await this.linkKOTsToBill(paymentData.customerId, bill.id, paymentData.targetDate || businessDate);

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
    const dateToUse = targetDate || computeISTBusinessDate(new Date().toISOString());
    await db.runAsync(`
      UPDATE kot_orders 
      SET billId = ? 
      WHERE customerId = ? 
        AND billId IS NULL 
        AND (businessDate = ? OR (businessDate IS NULL AND DATE(createdAt) = DATE(?)))
    `, [billId, customerId, dateToUse, dateToUse]);
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
    `, [amount, customerId]); // Store direct amount (already in rupees)
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
        r.businessDate,
        c.name as customerName,
        c.contact as customerContact,
        b.billNumber
      FROM receipts r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN bills b ON r.customerId = b.customerId 
        AND b.businessDate = r.businessDate
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
  } | null> {
    if (!db) throw new Error("Database not initialized");

    // Get receipt details
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) return null;

    // Get customer details
    const customer = await db.getFirstAsync(`
      SELECT * FROM customers WHERE id = ?
    `, [receipt.customerId]) as any;

    const rBusinessDateRow = await db.getFirstAsync(`SELECT businessDate, createdAt FROM receipts WHERE id = ?`, [receiptId]) as any;
    const rBusinessDate = rBusinessDateRow?.businessDate || computeISTBusinessDate(rBusinessDateRow.createdAt);

    // Get related bill
    const bill = await db.getFirstAsync(`
      SELECT * FROM bills 
      WHERE customerId = ? 
        AND businessDate = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `, [receipt.customerId, rBusinessDate]) as any;

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
    };
  }
}

export const paymentService = new PaymentService();
