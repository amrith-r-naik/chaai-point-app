import { db, withTransaction } from "../lib/db";

export interface CustomerDue {
  customerId: string;
  customerName: string;
  customerContact: string | null;
  totalDueAmount: number;
  lastOrderDate: string;
  unpaidKots: {
    id: string;
    kotNumber: number;
    amount: number;
    createdAt: string;
    items: string;
  }[];
}

export interface DueUpdateData {
  customerId: string;
  amount: number;
  remarks?: string;
  paymentMode: string;
}

class DueService {
  async getCustomersWithDues(): Promise<CustomerDue[]> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getAllAsync(`
      SELECT 
        c.id as customerId,
        c.name as customerName,
        c.contact as customerContact,
        COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalDueAmount,
        MAX(ko.createdAt) as lastOrderDate
      FROM customers c
      INNER JOIN kot_orders ko ON c.id = ko.customerId
      INNER JOIN kot_items ki ON ko.id = ki.kotId
      WHERE ko.billId IS NULL
      GROUP BY c.id, c.name, c.contact
      HAVING totalDueAmount > 0
      ORDER BY lastOrderDate DESC
    `)) as any[];

    const customersWithDues: CustomerDue[] = [];

    for (const row of result) {
      const unpaidKots = (await db.getAllAsync(
        `
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.createdAt,
          COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as amount,
          GROUP_CONCAT(mi.name || ' (x' || ki.quantity || ')', ', ') as items
        FROM kot_orders ko
        INNER JOIN kot_items ki ON ko.id = ki.kotId
        LEFT JOIN menu_items mi ON ki.itemId = mi.id
        WHERE ko.customerId = ? AND ko.billId IS NULL
        GROUP BY ko.id, ko.kotNumber, ko.createdAt
        ORDER BY ko.createdAt DESC
      `,
        [row.customerId]
      )) as any[];

      customersWithDues.push({
        customerId: row.customerId,
        customerName: row.customerName,
        customerContact: row.customerContact,
        totalDueAmount: row.totalDueAmount,
        lastOrderDate: row.lastOrderDate,
        unpaidKots: unpaidKots.map((kot) => ({
          id: kot.id,
          kotNumber: kot.kotNumber,
          amount: kot.amount,
          createdAt: kot.createdAt,
          items: kot.items || "No items",
        })),
      });
    }

    return customersWithDues;
  }

  async getTotalPendingDues(): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(`
      SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalDues
      FROM kot_orders ko
      INNER JOIN kot_items ki ON ko.id = ki.kotId
      WHERE ko.billId IS NULL
    `)) as any;

    return result?.totalDues || 0;
  }

  async getCustomerDueAmount(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as dueAmount
      FROM kot_orders ko
      INNER JOIN kot_items ki ON ko.id = ki.kotId
      WHERE ko.customerId = ? AND ko.billId IS NULL
    `,
      [customerId]
    )) as any;

    return result?.dueAmount || 0;
  }

  async processCustomerDuePayment(paymentData: DueUpdateData): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    await withTransaction(async () => {
      const unpaidKots = (await db!.getAllAsync(
        `
        SELECT 
          ko.id,
          ko.kotNumber,
          COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as amount
        FROM kot_orders ko
        INNER JOIN kot_items ki ON ko.id = ki.kotId
        WHERE ko.customerId = ? AND ko.billId IS NULL
        GROUP BY ko.id, ko.kotNumber
        ORDER BY ko.createdAt ASC
      `,
        [paymentData.customerId]
      )) as any[];

      let remainingAmount = paymentData.amount;
      const paidKotIds: string[] = [];
      let billAmount = 0;

      // Try to pay full KOTs first
      for (const kot of unpaidKots) {
        if (remainingAmount <= 0) break;

        if (kot.amount <= remainingAmount) {
          paidKotIds.push(kot.id);
          remainingAmount -= kot.amount;
          billAmount += kot.amount;
        } else {
          // Allow partial payment - mark remaining amount as credit/partial payment
          billAmount += remainingAmount;
          remainingAmount = 0;
          break;
        }
      }

      if (billAmount > 0) {
        const billId = `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Server assigns bill number; placeholder 0
        const billNumber = 0;

        await db!.runAsync(
          `
          INSERT INTO bills (id, billNumber, customerId, total, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            billId,
            billNumber,
            paymentData.customerId,
            billAmount,
            new Date().toISOString(),
          ]
        );

        // Mark fully paid KOTs as billed
        for (const kotId of paidKotIds) {
          await db!.runAsync(
            `
            UPDATE kot_orders SET billId = ? WHERE id = ?
          `,
            [billId, kotId]
          );
        }

        const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db!.runAsync(
          `
          INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            paymentId,
            billId,
            paymentData.customerId,
            billAmount,
            paymentData.paymentMode,
            paymentData.remarks || null,
            new Date().toISOString(),
          ]
        );

        // Create receipt
        const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Server assigns receipt number; placeholder 0
        const receiptNumber = 0;
        await db!.runAsync(
          `
          INSERT INTO receipts (id, receiptNo, customerId, amount, mode, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            receiptId,
            receiptNumber,
            paymentData.customerId,
            billAmount,
            paymentData.paymentMode,
            paymentData.remarks || null,
            new Date().toISOString(),
          ]
        );
      }

      // If there's remaining amount and no bills were created, treat as advance payment
      if (remainingAmount > 0 && billAmount === 0) {
        const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db!.runAsync(
          `
          INSERT INTO payments (id, billId, customerId, amount, mode, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            paymentId,
            null,
            paymentData.customerId,
            remainingAmount,
            paymentData.paymentMode,
            (paymentData.remarks || "") + " (Advance payment)",
            new Date().toISOString(),
          ]
        );

        const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Server assigns receipt number; placeholder 0
        const receiptNumber = 0;
        await db!.runAsync(
          `
          INSERT INTO receipts (id, receiptNo, customerId, amount, mode, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            receiptId,
            receiptNumber,
            paymentData.customerId,
            remainingAmount,
            paymentData.paymentMode,
            (paymentData.remarks || "") + " (Advance payment)",
            new Date().toISOString(),
          ]
        );
      }
    });
  }

  // Numbers assigned by server; no local generators

  /**
   * Get revenue from paid orders (orders with billId)
   */
  async getTotalRevenue(): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(`
      SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue
      FROM kot_orders ko
      INNER JOIN kot_items ki ON ko.id = ki.kotId
      WHERE ko.billId IS NOT NULL
    `)) as any;

    return result?.revenue || 0;
  }

  /**
   * Get revenue for a specific date range
   */
  async getRevenueByDateRange(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue
      FROM kot_orders ko
      INNER JOIN kot_items ki ON ko.id = ki.kotId
      WHERE ko.billId IS NOT NULL 
        AND date(ko.createdAt) BETWEEN ? AND ?
    `,
      [startDate, endDate]
    )) as any;

    return result?.revenue || 0;
  }
}

export const dueService = new DueService();
