import { db } from "../lib/db";
import { dueService } from "./dueService";

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingDues: number;
  totalExpenses: number;
  profit: number;
  todayOrders: number;
  todayRevenue: number;
  todayExpenses: number;
  todayProfit: number;
}

export interface DateFilterOptions {
  startDate: string;
  endDate: string;
}

export interface ExpenseData {
  id: string;
  voucherNo: number;
  amount: number;
  towards: string;
  mode: string;
  remarks: string | null;
  createdAt: string;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  orders: number;
}

class DashboardService {
  async getDashboardStats(dateFilter?: DateFilterOptions): Promise<DashboardStats> {
    if (!db) throw new Error("Database not initialized");

    const today = new Date().toISOString().split('T')[0];
    const filterStartDate = dateFilter?.startDate || today;
    const filterEndDate = dateFilter?.endDate || today;

    const [
      totalOrdersResult,
      totalRevenueResult,
      pendingDuesResult,
      totalExpensesResult,
      todayOrdersResult,
      todayRevenueResult,
      todayExpensesResult
    ] = await Promise.all([
      this.getTotalOrders(filterStartDate, filterEndDate),
      this.getTotalRevenue(filterStartDate, filterEndDate),
      this.getPendingDues(),
      this.getTotalExpenses(filterStartDate, filterEndDate),
      this.getTotalOrders(today, today),
      this.getTotalRevenue(today, today),
      this.getTotalExpenses(today, today)
    ]);

    const totalOrders = totalOrdersResult;
    const totalRevenue = totalRevenueResult;
    const pendingDues = pendingDuesResult;
    const totalExpenses = totalExpensesResult;
    const profit = totalRevenue - totalExpenses;

    const todayOrders = todayOrdersResult;
    const todayRevenue = todayRevenueResult;
    const todayExpenses = todayExpensesResult;
    const todayProfit = todayRevenue - todayExpenses;

    return {
      totalOrders,
      totalRevenue,
      pendingDues,
      totalExpenses,
      profit,
      todayOrders,
      todayRevenue,
      todayExpenses,
      todayProfit
    };
  }

  private async getTotalOrders(startDate: string, endDate: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM kot_orders 
       WHERE date(createdAt) BETWEEN ? AND ?`,
      [startDate, endDate]
    ) as any;
    
    return result?.count || 0;
  }

  private async getTotalRevenue(startDate: string, endDate: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    
    // Use the new due service logic - only count revenue from paid orders (with billId)
    const result = await db.getFirstAsync(
      `SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue 
       FROM kot_items ki
       JOIN kot_orders ko ON ki.kotId = ko.id
       WHERE ko.billId IS NOT NULL 
         AND date(ko.createdAt) BETWEEN ? AND ?`,
      [startDate, endDate]
    ) as any;
    
    return result?.revenue || 0;
  }

  private async getPendingDues(): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    
    // Use the new due service to get actual pending dues
    return await dueService.getTotalPendingDues();
  }

  private async getTotalExpenses(startDate: string, endDate: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as expenses 
       FROM expenses 
       WHERE date(createdAt) BETWEEN ? AND ?`,
      [startDate, endDate]
    ) as any;
    
    return result?.expenses || 0;
  }

  async getRevenueByDays(days: number = 7): Promise<RevenueByDay[]> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db.getAllAsync(
      `SELECT 
         date(ko.createdAt) as date,
         COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue,
         COUNT(DISTINCT ko.id) as orders
       FROM kot_orders ko
       LEFT JOIN kot_items ki ON ko.id = ki.kotId
       WHERE ko.billId IS NOT NULL 
         AND date(ko.createdAt) >= date('now', '-${days} days')
       GROUP BY date(ko.createdAt)
       ORDER BY date(ko.createdAt) DESC`
    ) as any[];
    
    return result.map(row => ({
      date: row.date,
      revenue: row.revenue || 0,
      orders: row.orders || 0
    }));
  }

  async addExpense(expenseData: {
    amount: number;
    towards: string;
    mode: string;
    remarks?: string;
  }): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    const expenseId = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const voucherNo = await this.getNextVoucherNumber();
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO expenses (id, voucherNo, amount, towards, mode, remarks, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        expenseId,
        voucherNo,
        expenseData.amount,
        expenseData.towards,
        expenseData.mode,
        expenseData.remarks || null,
        createdAt
      ]
    );

    return expenseId;
  }

  async getExpenses(dateFilter?: DateFilterOptions): Promise<ExpenseData[]> {
    if (!db) throw new Error("Database not initialized");

    let query = `SELECT * FROM expenses`;
    let params: string[] = [];

    if (dateFilter) {
      query += ` WHERE date(createdAt) BETWEEN ? AND ?`;
      params = [dateFilter.startDate, dateFilter.endDate];
    }

    query += ` ORDER BY createdAt DESC`;

    const result = await db.getAllAsync(query, params) as any[];
    
    return result.map(row => ({
      id: row.id,
      voucherNo: row.voucherNo,
      amount: row.amount,
      towards: row.towards,
      mode: row.mode,
      remarks: row.remarks,
      createdAt: row.createdAt
    }));
  }

  private async getNextVoucherNumber(): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(
      `SELECT MAX(voucherNo) as maxVoucher FROM expenses`
    ) as any;

    return (result?.maxVoucher || 0) + 1;
  }

  async getTopSellingItems(dateFilter?: DateFilterOptions, limit: number = 5): Promise<Array<{
    itemName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>> {
    if (!db) throw new Error("Database not initialized");

    let query = `
      SELECT 
        mi.name as itemName,
        SUM(ki.quantity) as totalQuantity,
        SUM(ki.quantity * ki.priceAtTime) as totalRevenue
      FROM kot_items ki
      JOIN menu_items mi ON ki.itemId = mi.id
      JOIN kot_orders ko ON ki.kotId = ko.id
    `;
    
    let params: string[] = [];

    if (dateFilter) {
      query += ` WHERE date(ko.createdAt) BETWEEN ? AND ?`;
      params = [dateFilter.startDate, dateFilter.endDate];
    }

    query += `
      GROUP BY ki.itemId, mi.name
      ORDER BY totalQuantity DESC
      LIMIT ?
    `;
    
    params.push(limit.toString());

    const result = await db.getAllAsync(query, params) as any[];
    
    return result.map(row => ({
      itemName: row.itemName,
      totalQuantity: row.totalQuantity || 0,
      totalRevenue: row.totalRevenue || 0
    }));
  }
}

export const dashboardService = new DashboardService();
