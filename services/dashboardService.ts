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

export interface DetailedAnalytics {
  period: 'today' | 'week' | 'month';
  revenue: {
    total: number;
    previous: number;
    growth: number;
  };
  orders: {
    total: number;
    previous: number;
    growth: number;
  };
  expenses: {
    total: number;
    previous: number;
    growth: number;
  };
  profit: {
    total: number;
    previous: number;
    growth: number;
  };
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  hourlyData?: Array<{
    hour: number;
    orders: number;
    revenue: number;
  }>;
  dailyData?: Array<{
    date: string;
    orders: number;
    revenue: number;
    expenses: number;
  }>;
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

  async getDetailedAnalytics(period: 'today' | 'week' | 'month'): Promise<DetailedAnalytics> {
    if (!db) throw new Error("Database not initialized");

    const { current, previous } = this.getDateRanges(period);
    
    const [
      currentRevenue,
      previousRevenue,
      currentOrders,
      previousOrders,
      currentExpenses,
      previousExpenses,
      topItems,
      timeData
    ] = await Promise.all([
      this.getTotalRevenue(current.startDate, current.endDate),
      this.getTotalRevenue(previous.startDate, previous.endDate),
      this.getTotalOrders(current.startDate, current.endDate),
      this.getTotalOrders(previous.startDate, previous.endDate),
      this.getTotalExpenses(current.startDate, current.endDate),
      this.getTotalExpenses(previous.startDate, previous.endDate),
      this.getTopSellingItems({ startDate: current.startDate, endDate: current.endDate }, 5),
      period === 'today' ? this.getHourlyData(current.startDate) : this.getDailyData(current.startDate, current.endDate)
    ]);

    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      period,
      revenue: {
        total: currentRevenue,
        previous: previousRevenue,
        growth: calculateGrowth(currentRevenue, previousRevenue)
      },
      orders: {
        total: currentOrders,
        previous: previousOrders,
        growth: calculateGrowth(currentOrders, previousOrders)
      },
      expenses: {
        total: currentExpenses,
        previous: previousExpenses,
        growth: calculateGrowth(currentExpenses, previousExpenses)
      },
      profit: {
        total: currentRevenue - currentExpenses,
        previous: previousRevenue - previousExpenses,
        growth: calculateGrowth(currentRevenue - currentExpenses, previousRevenue - previousExpenses)
      },
      topItems: topItems.map(item => ({
        name: item.itemName,
        quantity: item.totalQuantity,
        revenue: item.totalRevenue
      })),
      ...(period === 'today' ? { hourlyData: timeData as any } : { dailyData: timeData as any })
    };
  }

  private getDateRanges(period: 'today' | 'week' | 'month'): {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  } {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (period) {
      case 'today': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          current: { startDate: todayStr, endDate: todayStr },
          previous: { startDate: yesterday.toISOString().split('T')[0], endDate: yesterday.toISOString().split('T')[0] }
        };
      }
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        const prevWeekEnd = new Date(weekStart);
        prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
        const prevWeekStart = new Date(prevWeekEnd);
        prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
        
        return {
          current: { startDate: weekStart.toISOString().split('T')[0], endDate: todayStr },
          previous: { startDate: prevWeekStart.toISOString().split('T')[0], endDate: prevWeekEnd.toISOString().split('T')[0] }
        };
      }
      case 'month': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const prevMonthEnd = new Date(monthStart);
        prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
        const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
        
        return {
          current: { startDate: monthStart.toISOString().split('T')[0], endDate: todayStr },
          previous: { startDate: prevMonthStart.toISOString().split('T')[0], endDate: prevMonthEnd.toISOString().split('T')[0] }
        };
      }
    }
  }

  private async getHourlyData(date: string): Promise<Array<{ hour: number; orders: number; revenue: number }>> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getAllAsync(`
      SELECT 
        CAST(strftime('%H', ko.createdAt) AS INTEGER) as hour,
        COUNT(DISTINCT ko.id) as orders,
        COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue
      FROM kot_orders ko
      LEFT JOIN kot_items ki ON ko.id = ki.kotId
      WHERE DATE(ko.createdAt) = ?
      GROUP BY CAST(strftime('%H', ko.createdAt) AS INTEGER)
      ORDER BY hour
    `, [date]) as any[];

    // Fill missing hours with zeros
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, revenue: 0 }));
    result.forEach(row => {
      hourlyData[row.hour] = { hour: row.hour, orders: row.orders || 0, revenue: row.revenue || 0 };
    });

    return hourlyData;
  }

  private async getDailyData(startDate: string, endDate: string): Promise<Array<{ date: string; orders: number; revenue: number; expenses: number }>> {
    if (!db) throw new Error("Database not initialized");

    const [ordersRevenue, expenses] = await Promise.all([
      db.getAllAsync(`
        SELECT 
          DATE(ko.createdAt) as date,
          COUNT(DISTINCT ko.id) as orders,
          COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue
        FROM kot_orders ko
        LEFT JOIN kot_items ki ON ko.id = ki.kotId
        WHERE DATE(ko.createdAt) BETWEEN ? AND ?
        GROUP BY DATE(ko.createdAt)
        ORDER BY date
      `, [startDate, endDate]),
      db.getAllAsync(`
        SELECT 
          DATE(createdAt) as date,
          COALESCE(SUM(amount), 0) as expenses
        FROM expenses
        WHERE DATE(createdAt) BETWEEN ? AND ?
        GROUP BY DATE(createdAt)
        ORDER BY date
      `, [startDate, endDate])
    ]) as [any[], any[]];

    // Merge orders/revenue and expenses data
    const dailyMap = new Map<string, { date: string; orders: number; revenue: number; expenses: number }>();
    
    ordersRevenue.forEach(row => {
      dailyMap.set(row.date, { 
        date: row.date, 
        orders: row.orders || 0, 
        revenue: row.revenue || 0, 
        expenses: 0 
      });
    });

    expenses.forEach(row => {
      const existing = dailyMap.get(row.date);
      if (existing) {
        existing.expenses = row.expenses || 0;
      } else {
        dailyMap.set(row.date, { 
          date: row.date, 
          orders: 0, 
          revenue: 0, 
          expenses: row.expenses || 0 
        });
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
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
