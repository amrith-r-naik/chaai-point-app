import { db } from "../lib/db";

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number; // Sum of paid portions (non-credit) from KOTs whose bills have any paid component
  outstandingCredit: number; // SUM(customers.creditBalance)
  totalExpenses: number;
  profit: number;
  todayOrders: number;
  todayRevenue: number;
  todayExpenses: number;
  todayProfit: number;
  creditAccrued?: number; // total credit granted in filter window
  creditCleared?: number; // total credit cleared in filter window
  netCreditChange?: number; // accrued - cleared
  // Expense split reporting
  expensePaid?: number;
  expenseCreditAccrued?: number;
  expenseCreditCleared?: number;
  expenseOutstandingCredit?: number;
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

export interface ExpenseListItem extends ExpenseData {
  paidAmount: number;
  creditOutstanding: number;
  status: "Paid" | "Partial" | "Credit";
  expenseDate: string;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  orders: number;
}

class DashboardService {
  async getDashboardStats(
    dateFilter?: DateFilterOptions
  ): Promise<DashboardStats> {
    if (!db) throw new Error("Database not initialized");

    const today = new Date().toISOString().split("T")[0];
    const filterStartDate = dateFilter?.startDate || today;
    const filterEndDate = dateFilter?.endDate || today;

    const [
      totalOrdersResult,
      totalRevenueResult,
      outstandingCreditResult,
      totalExpensesResult,
      todayOrdersResult,
      todayRevenueResult,
      todayExpensesResult,
      creditAccruedResult,
      creditClearedResult,
      expensePaidResult,
      expenseCreditAccruedResult,
      expenseCreditClearedResult,
      expenseOutstandingCreditResult,
    ] = await Promise.all([
      this.getTotalOrders(filterStartDate, filterEndDate),
      this.getTotalRevenue(filterStartDate, filterEndDate),
      this.getOutstandingCredit(),
      this.getTotalExpenses(filterStartDate, filterEndDate),
      this.getTotalOrders(today, today),
      this.getTotalRevenue(today, today),
      this.getTotalExpenses(today, today),
      this.getCreditAccrued(filterStartDate, filterEndDate),
      this.getCreditCleared(filterStartDate, filterEndDate),
      this.getExpensePaid(filterStartDate, filterEndDate),
      this.getExpenseCreditAccrued(filterStartDate, filterEndDate),
      this.getExpenseCreditCleared(filterStartDate, filterEndDate),
      this.getExpenseOutstandingCredit(),
    ]);

    const totalOrders = totalOrdersResult;
    const totalRevenue = totalRevenueResult;
    const outstandingCredit = outstandingCreditResult;
    const creditAccrued = creditAccruedResult;
    const creditCleared = creditClearedResult;
    const totalExpenses = totalExpensesResult;
    const profit = totalRevenue - totalExpenses;

    const todayOrders = todayOrdersResult;
    const todayRevenue = todayRevenueResult;
    const todayExpenses = todayExpensesResult;
    const todayProfit = todayRevenue - todayExpenses;

    return {
      totalOrders,
      totalRevenue,
      outstandingCredit,
      totalExpenses,
      profit,
      todayOrders,
      todayRevenue,
      todayExpenses,
      todayProfit,
      creditAccrued,
      creditCleared,
      netCreditChange: (creditAccrued || 0) - (creditCleared || 0),
      expensePaid: expensePaidResult,
      expenseCreditAccrued: expenseCreditAccruedResult,
      expenseCreditCleared: expenseCreditClearedResult,
      expenseOutstandingCredit: expenseOutstandingCreditResult,
    };
  }

  private async getTotalOrders(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM kot_orders 
       WHERE date(createdAt) BETWEEN ? AND ?`,
      [startDate, endDate]
    )) as any;

    return result?.count || 0;
  }

  private async getTotalRevenue(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    // Revenue is sum of cash/upi/etc plus credit clearances (exclude Accrual).
    const result = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(p.amount),0) as revenue
       FROM payments p
       WHERE (p.subType IS NULL OR p.subType = 'Clearance')
         AND date(p.createdAt) BETWEEN ? AND ?`,
      [startDate, endDate]
    )) as any;
    return result?.revenue || 0;
  }

  private async getOutstandingCredit(): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const result = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(creditBalance),0) as total FROM customers`
    )) as any;
    return result?.total || 0;
  }

  private async getCreditAccrued(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(SUM(amount),0) as total FROM payments 
      WHERE subType = 'Accrual' AND date(createdAt) BETWEEN ? AND ?
    `,
      [startDate, endDate]
    )) as any;
    return result?.total || 0;
  }

  private async getCreditCleared(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(SUM(amount),0) as total FROM payments 
      WHERE subType = 'Clearance' AND date(createdAt) BETWEEN ? AND ?
    `,
      [startDate, endDate]
    )) as any;
    return result?.total || 0;
  }

  private async getTotalExpenses(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as expenses 
       FROM expenses 
       WHERE date(expenseDate) BETWEEN ? AND ?`,
      [startDate, endDate]
    )) as any;

    return result?.expenses || 0;
  }

  // Expense reporting based on settlements
  private async getExpensePaid(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_settlements 
       WHERE (subType IS NULL OR subType = '' OR subType = 'Clearance')
         AND date(createdAt) BETWEEN ? AND ?
         AND (deletedAt IS NULL)`,
      [startDate, endDate]
    )) as any;
    return row?.total || 0;
  }

  private async getExpenseCreditAccrued(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_settlements 
       WHERE subType = 'Accrual' AND date(createdAt) BETWEEN ? AND ?
         AND (deletedAt IS NULL)`,
      [startDate, endDate]
    )) as any;
    return row?.total || 0;
  }

  private async getExpenseCreditCleared(
    startDate: string,
    endDate: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_settlements 
       WHERE subType = 'Clearance' AND date(createdAt) BETWEEN ? AND ?
         AND (deletedAt IS NULL)`,
      [startDate, endDate]
    )) as any;
    return row?.total || 0;
  }

  private async getExpenseOutstandingCredit(): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT 
         COALESCE(SUM(CASE WHEN paymentType='Credit' AND subType='Accrual' THEN amount ELSE 0 END),0) -
         COALESCE(SUM(CASE WHEN subType='Clearance' THEN amount ELSE 0 END),0) as outstanding
       FROM expense_settlements WHERE (deletedAt IS NULL)`
    )) as any;
    return row?.outstanding || 0;
  }

  async getRevenueByDays(days: number = 7): Promise<RevenueByDay[]> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getAllAsync(
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
    )) as any[];

    return result.map((row) => ({
      date: row.date,
      revenue: row.revenue || 0,
      orders: row.orders || 0,
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
    // Server assigns voucher number; placeholder 0
    const voucherNo = 0;
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
        createdAt,
      ]
    );
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.expenses();
      signalChange.any();
    } catch {}
    return expenseId;
  }

  async getExpenses(dateFilter?: DateFilterOptions): Promise<ExpenseData[]> {
    if (!db) throw new Error("Database not initialized");

    let query = `SELECT * FROM expenses`;
    let params: string[] = [];

    if (dateFilter) {
      query += ` WHERE date(expenseDate) BETWEEN ? AND ?`;
      params = [dateFilter.startDate, dateFilter.endDate];
    }

    query += ` ORDER BY expenseDate DESC, createdAt DESC`;

    const result = (await db.getAllAsync(query, params)) as any[];

    return result.map((row) => ({
      id: row.id,
      voucherNo: row.voucherNo,
      amount: row.amount,
      towards: row.towards,
      mode: row.mode,
      remarks: row.remarks,
      createdAt: row.createdAt,
      expenseDate: row.expenseDate,
    }));
  }

  async getExpensesWithStatus(
    dateFilter?: DateFilterOptions
  ): Promise<ExpenseListItem[]> {
    if (!db) throw new Error("Database not initialized");

    const where = dateFilter ? `WHERE date(e.expenseDate) BETWEEN ? AND ?` : "";
    const params: string[] = dateFilter
      ? [dateFilter.startDate, dateFilter.endDate]
      : [];
    const rows = (await db.getAllAsync(
      `SELECT 
         e.id, e.voucherNo, e.amount, e.towards, e.mode, e.remarks, e.createdAt, e.expenseDate,
         COALESCE(SUM(CASE WHEN s.paymentType IN ('Cash','UPI') AND (s.subType IS NULL OR s.subType='') THEN s.amount ELSE 0 END),0) as paidAmount,
         COALESCE(SUM(CASE WHEN s.paymentType='Credit' AND s.subType='Accrual' THEN s.amount ELSE 0 END),0) as accrued,
         COALESCE(SUM(CASE WHEN s.subType='Clearance' THEN s.amount ELSE 0 END),0) as cleared
       FROM expenses e
       LEFT JOIN expense_settlements s ON s.expenseId = e.id AND s.deletedAt IS NULL
       ${where}
       GROUP BY e.id
       ORDER BY e.expenseDate DESC, e.createdAt DESC`,
      params
    )) as any[];

    return rows.map((r) => {
      const outstanding = Math.max(0, (r.accrued || 0) - (r.cleared || 0));
      let status: "Paid" | "Partial" | "Credit" = "Paid";
      if (outstanding > 0)
        status =
          (r.paidAmount || 0) > 0 || (r.cleared || 0) > 0
            ? "Partial"
            : "Credit";
      const item: ExpenseListItem = {
        id: r.id,
        voucherNo: r.voucherNo,
        amount: r.amount,
        towards: r.towards,
        mode: r.mode,
        remarks: r.remarks,
        createdAt: r.createdAt,
        expenseDate: r.expenseDate,
        paidAmount: r.paidAmount || 0,
        creditOutstanding: outstanding,
        status,
      };
      return item;
    });
  }

  // Numbers assigned by server; no local voucher generator

  async getTopSellingItems(
    dateFilter?: DateFilterOptions,
    limit: number = 5
  ): Promise<
    {
      itemName: string;
      totalQuantity: number;
      totalRevenue: number;
    }[]
  > {
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

    const result = (await db.getAllAsync(query, params)) as any[];

    return result.map((row) => ({
      itemName: row.itemName,
      totalQuantity: row.totalQuantity || 0,
      totalRevenue: row.totalRevenue || 0,
    }));
  }
}

export const dashboardService = new DashboardService();
