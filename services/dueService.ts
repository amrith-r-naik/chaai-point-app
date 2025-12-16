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

    // Single query to get all unpaid KOTs with their customer and item info
    // This eliminates N+1 by fetching everything in one go
    const allUnpaidKots = (await db.getAllAsync(`
      SELECT 
        c.id as customerId,
        c.name as customerName,
        c.contact as customerContact,
        ko.id as kotId,
        ko.kotNumber,
        ko.createdAt,
        COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as amount,
        GROUP_CONCAT(mi.name || ' (x' || ki.quantity || ')', ', ') as items
      FROM customers c
      INNER JOIN kot_orders ko ON c.id = ko.customerId
      INNER JOIN kot_items ki ON ko.id = ki.kotId
      LEFT JOIN menu_items mi ON ki.itemId = mi.id
      WHERE ko.billId IS NULL
      GROUP BY c.id, c.name, c.contact, ko.id, ko.kotNumber, ko.createdAt
      ORDER BY ko.createdAt DESC
    `)) as any[];

    // Group by customer in JavaScript
    const customerMap = new Map<string, CustomerDue>();

    for (const row of allUnpaidKots) {
      if (!customerMap.has(row.customerId)) {
        customerMap.set(row.customerId, {
          customerId: row.customerId,
          customerName: row.customerName,
          customerContact: row.customerContact,
          totalDueAmount: 0,
          lastOrderDate: row.createdAt,
          unpaidKots: [],
        });
      }

      const customer = customerMap.get(row.customerId)!;
      customer.totalDueAmount += row.amount;
      customer.unpaidKots.push({
        id: row.kotId,
        kotNumber: row.kotNumber,
        amount: row.amount,
        createdAt: row.createdAt,
        items: row.items || "No items",
      });

      // Update lastOrderDate if this KOT is newer
      if (row.createdAt > customer.lastOrderDate) {
        customer.lastOrderDate = row.createdAt;
      }
    }

    // Convert to array and sort by lastOrderDate DESC
    return Array.from(customerMap.values())
      .filter((c) => c.totalDueAmount > 0)
      .sort(
        (a, b) =>
          new Date(b.lastOrderDate).getTime() -
          new Date(a.lastOrderDate).getTime()
      );
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
  async gettotalReceived(): Promise<number> {
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
