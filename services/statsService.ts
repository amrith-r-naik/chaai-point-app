// services/statsService.ts
// Aggregation & analytics
import { db } from '@/lib/db';

// Shared return shapes
export interface OrdersGroupedByDate {
  [date: string]: {
    date: string;
    displayDate: string;
    customers: {
      [customerId: string]: {
        customer: {
          id: string;
          name: string;
          contact: string | null;
        };
        totalAmount: number;
        orderCount: number;
        hasCompletedBilling: boolean;
        hasActiveOrders: boolean;
        activeAmount: number;
        completedAmount: number;
        activeOrderCount: number;
        completedOrderCount: number;
        isPaidCustomer: boolean;
      };
    };
  };
}

export interface CompletedBillsGroupedByDate {
  [date: string]: {
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
  };
}

// Convenience element shapes
export type DateGroup = OrdersGroupedByDate[string];
export type CompletedBillGroup = CompletedBillsGroupedByDate[string];

export interface DailySummary {
  businessDate: string;
  kotCount: number;
  billedKotCount: number;
  unbilledKotCount: number;
  totalKotAmount: number;
  billedAmount: number;
  receiptAmount: number;
}

class StatsService {
  async getDailySummary(businessDate: string): Promise<DailySummary | null> {
    if (!db) throw new Error('Database not initialized');

    const row = await db.getFirstAsync(`
      WITH kot_totals AS (
        SELECT 
          ko.id,
          ko.billId,
          COALESCE(SUM(ki.quantity * ki.priceAtTime),0) as kotAmount
        FROM kot_orders ko
        LEFT JOIN kot_items ki ON ki.kotId = ko.id
        WHERE (ko.businessDate = ? OR (ko.businessDate IS NULL AND DATE(ko.createdAt) = DATE(?)))
        GROUP BY ko.id
      )
      SELECT 
        ? as businessDate,
        COUNT(*) as kotCount,
        SUM(CASE WHEN billId IS NOT NULL THEN 1 ELSE 0 END) as billedKotCount,
        SUM(CASE WHEN billId IS NULL THEN 1 ELSE 0 END) as unbilledKotCount,
        SUM(kotAmount) as totalKotAmount,
        SUM(CASE WHEN billId IS NOT NULL THEN kotAmount ELSE 0 END) as billedAmount,
        (SELECT COALESCE(SUM(amount),0) FROM receipts r WHERE r.businessDate = ? OR (r.businessDate IS NULL AND DATE(r.createdAt)=DATE(?))) as receiptAmount
      FROM kot_totals;
    `, [businessDate, businessDate, businessDate, businessDate]) as any;

    if (!row) return null;
    return {
      businessDate: row.businessDate,
      kotCount: row.kotCount || 0,
      billedKotCount: row.billedKotCount || 0,
      unbilledKotCount: row.unbilledKotCount || 0,
      totalKotAmount: row.totalKotAmount || 0,
      billedAmount: row.billedAmount || 0,
      receiptAmount: row.receiptAmount || 0,
    };
  }

  /**
   * Orders grouped by business date (or created date fallback) with customer summaries
   * (migrated from orderService for centralized analytics)
   */
  async getOrdersGroupedByDate(): Promise<OrdersGroupedByDate> {
    if (!db) throw new Error('Database not initialized');

    const orders = (await db.getAllAsync(`
      SELECT 
        ko.id,
        ko.kotNumber,
        ko.customerId,
        ko.billId,
        ko.createdAt,
        ko.businessDate,
        c.name as customerName,
        c.contact as customerContact,
        COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount,
        COALESCE(ko.businessDate, DATE(ko.createdAt)) as orderDate,
        p.mode as paymentMode
      FROM kot_orders ko
      LEFT JOIN customers c ON ko.customerId = c.id
      LEFT JOIN kot_items ki ON ko.id = ki.kotId
      LEFT JOIN bills b ON ko.billId = b.id
      LEFT JOIN payments p ON b.id = p.billId
      GROUP BY ko.id, c.name, c.contact, orderDate, p.mode
      ORDER BY ko.createdAt DESC
    `)) as any[];

    const dateGroups: OrdersGroupedByDate = {};

    orders.forEach(order => {
      const orderDate: string = order.orderDate;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let displayDate: string;
      if (orderDate === today) displayDate = 'Today';
      else if (orderDate === yesterday) displayDate = 'Yesterday';
      else {
        const date = new Date(orderDate);
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: '2-digit', weekday: 'long' };
        displayDate = date.toLocaleDateString('en-GB', options);
      }

      if (!dateGroups[orderDate]) {
        dateGroups[orderDate] = { date: orderDate, displayDate, customers: {} };
      }

      const customerId: string = order.customerId;
      if (!dateGroups[orderDate].customers[customerId]) {
        dateGroups[orderDate].customers[customerId] = {
          customer: { id: order.customerId, name: order.customerName, contact: order.customerContact },
          totalAmount: 0,
          orderCount: 0,
          hasCompletedBilling: false,
          hasActiveOrders: false,
          activeAmount: 0,
          completedAmount: 0,
          activeOrderCount: 0,
            completedOrderCount: 0,
          isPaidCustomer: false,
        };
      }

      const customerData = dateGroups[orderDate].customers[customerId];
      customerData.totalAmount += order.totalAmount || 0;
      customerData.orderCount += 1;

      if (order.billId) {
        customerData.hasCompletedBilling = true;
        customerData.completedAmount += order.totalAmount || 0;
        customerData.completedOrderCount += 1;
        if (order.paymentMode && order.paymentMode !== 'Credit') customerData.isPaidCustomer = true;
      } else {
        customerData.hasActiveOrders = true;
        customerData.activeAmount += order.totalAmount || 0;
        customerData.activeOrderCount += 1;
      }
    });

    return dateGroups;
  }

  /**
   * Completed bills (receipts) grouped by date (migrated from paymentService)
   */
  async getCompletedBillsGroupedByDate(): Promise<CompletedBillsGroupedByDate> {
    if (!db) throw new Error('Database not initialized');

    const bills = (await db.getAllAsync(`
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
    `)) as any[];

    const dateGroups: CompletedBillsGroupedByDate = {};

    bills.forEach(bill => {
      const billDate: string = bill.createdAt.split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let displayDate: string;
      if (billDate === today) displayDate = 'Today';
      else if (billDate === yesterday) displayDate = 'Yesterday';
      else {
        const date = new Date(billDate);
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: '2-digit', weekday: 'long' };
        displayDate = date.toLocaleDateString('en-GB', options);
      }

      if (!dateGroups[billDate]) {
        dateGroups[billDate] = { date: billDate, displayDate, bills: [] };
      }

      dateGroups[billDate].bills.push({
        id: bill.id,
        billNumber: bill.billNumber || 'N/A',
        receiptNo: bill.receiptNo,
        customerId: bill.customerId,
        customerName: bill.customerName,
        customerContact: bill.customerContact,
        amount: bill.amount,
        mode: bill.mode,
        remarks: bill.remarks,
        createdAt: bill.createdAt,
      });
    });

    return dateGroups;
  }
}

export const statsService = new StatsService();
