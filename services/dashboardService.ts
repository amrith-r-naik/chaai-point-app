import { db } from "../lib/db";

// Dashboard stats cache with short TTL (10 seconds)
class DashboardCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 10000; // 10 seconds

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const dashboardCache = new DashboardCache();

export interface DashboardStats {
  cashReceived: number; // Sum of payments in Cash (Clearance + direct) + Advance usage treated as cash equivalent? (business rule: only pure cash)
  upiReceived: number; // Sum of payments in UPI (Clearance + direct)
  totalReceived: number; // Retained for profit calc (cash+upi+advance usage)
  outstandingCredit: number; // SUM(customers.creditBalance)
  totalExpenses: number;
  profit: number;
  // Removed todayOrders & totalOrders per new requirement
  todayExpenses: number;
  creditAccrued?: number; // total credit granted in filter window
  creditCleared?: number; // total credit cleared in filter window
  netCreditChange?: number; // accrued - cleared
  // Expense split reporting
  expensePaid?: number;
  expenseCreditAccrued?: number;
  expenseCreditCleared?: number;
  expenseOutstandingCredit?: number;
  totalRevenue: number; // Total billed amount (sum of all items in billed KOTs)
  // Advance wallet reporting
  advanceAdded?: number;
  advanceUsed?: number;
  advanceRefunded?: number;
  advanceNetChange?: number; // added - used - refunded in window
  advanceOutstanding?: number; // total outstanding advance (all-time)
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
  // Clear cache when data changes
  clearCache(): void {
    dashboardCache.clear();
    console.log("[CACHE] Cleared dashboard cache");
  }

  async getDashboardStats(
    dateFilter?: DateFilterOptions
  ): Promise<DashboardStats & { totalRevenue: number }> {
    if (!db) throw new Error("Database not initialized");

    // Use local calendar day for "today" to avoid UTC shifting issues (e.g., IST)
    const today = new Date().toLocaleDateString("en-CA");
    const filterStartDate = dateFilter?.startDate || today;
    const filterEndDate = dateFilter?.endDate || today;

    // Check cache
    const cacheKey = `stats:${filterStartDate}:${filterEndDate}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Helper to compute local(IST) day range [startUtc, endUtc) for a given YYYY-MM-DD
    const istRangeForDate = (dStr: string) => {
      // Construct the IST midnight for the date, then convert to UTC by taking the ISO string
      const startUtcIso = new Date(dStr + "T00:00:00.000+05:30").toISOString();
      const endUtcIso = new Date(
        new Date(dStr + "T00:00:00.000+05:30").getTime() + 24 * 60 * 60 * 1000
      ).toISOString();
      return { startUtcIso, endUtcIso };
    };
    // For an inclusive start/end date range, convert to a single [start, endNext) UTC range
    const rangeForInclusiveDates = (start: string, end: string) => {
      const startUtcIso = new Date(start + "T00:00:00.000+05:30").toISOString();
      const endUtcIso = new Date(
        new Date(end + "T00:00:00.000+05:30").getTime() + 24 * 60 * 60 * 1000
      ).toISOString();
      return { startUtcIso, endUtcIso };
    };
    const { startUtcIso: filterStartUtc, endUtcIso: filterEndUtc } =
      rangeForInclusiveDates(filterStartDate, filterEndDate);
    const { startUtcIso: todayStartUtc, endUtcIso: todayEndUtc } =
      istRangeForDate(today);

    const [
      totalReceivedResult,
      outstandingCreditResult,
      totalExpensesResult,
      todayExpensesResult,
      creditAccruedResult,
      creditClearedResult,
      expensePaidResult,
      expenseCreditAccruedResult,
      expenseCreditClearedResult,
      expenseOutstandingCreditResult,
      totalRevenueResult,
      advanceAddedResult,
      advanceUsedResult,
      advanceRefundedResult,
      advanceOutstandingResult,
    ] = await Promise.all([
      this.gettotalReceived(filterStartUtc, filterEndUtc),
      this.getOutstandingCredit(),
      this.getTotalExpenses(filterStartDate, filterEndDate),
      this.getTotalExpenses(today, today),
      this.getCreditAccrued(filterStartUtc, filterEndUtc),
      this.getCreditCleared(filterStartUtc, filterEndUtc),
      this.getExpensePaid(filterStartUtc, filterEndUtc),
      this.getExpenseCreditAccrued(filterStartUtc, filterEndUtc),
      this.getExpenseCreditCleared(filterStartUtc, filterEndUtc),
      this.getExpenseOutstandingCredit(),
      this.getTotalRevenue(filterStartUtc, filterEndUtc),
      this.getAdvanceByType("Add", filterStartUtc, filterEndUtc),
      this.getAdvanceByType("Apply", filterStartUtc, filterEndUtc),
      this.getAdvanceByType("Refund", filterStartUtc, filterEndUtc),
      this.getAdvanceOutstanding(),
    ]);

    const totalReceived = totalReceivedResult;
    const outstandingCredit = outstandingCreditResult;
    const creditAccrued = creditAccruedResult;
    const creditCleared = creditClearedResult;
    const totalExpenses = totalExpensesResult;
    const profit = totalReceived - totalExpenses;

    const todayExpenses = todayExpensesResult;
    const advanceAdded = advanceAddedResult;
    const advanceUsed = advanceUsedResult;
    const advanceRefunded = advanceRefundedResult;
    const advanceNetChange =
      (advanceAdded || 0) - (advanceUsed || 0) - (advanceRefunded || 0);
    const advanceOutstanding = advanceOutstandingResult;

    // Derive cash & upi portions (excluding credit accrual). Advance usage currently blended into totalReceived only.
    const { cashPortion, upiPortion } = await this.getCashAndUpiSplit(
      filterStartUtc,
      filterEndUtc
    );

    const result = {
      cashReceived: cashPortion,
      upiReceived: upiPortion,
      totalReceived,
      outstandingCredit,
      totalExpenses,
      profit,
      todayExpenses,
      creditAccrued,
      creditCleared,
      netCreditChange: (creditAccrued || 0) - (creditCleared || 0),
      expensePaid: expensePaidResult,
      expenseCreditAccrued: expenseCreditAccruedResult,
      expenseCreditCleared: expenseCreditClearedResult,
      expenseOutstandingCredit: expenseOutstandingCreditResult,
      totalRevenue: totalRevenueResult,
      advanceAdded,
      advanceUsed,
      advanceRefunded,
      advanceNetChange,
      advanceOutstanding,
    };

    // Cache the result
    dashboardCache.set(cacheKey, result);
    return result;
  }

  // Removed getTotalOrders per new dashboard requirement

  private async gettotalReceived(
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    // New definition: only Cash + UPI + Credit (accrual & clearance) payments.
    const payRow = await db.getFirstAsync(
      `SELECT COALESCE(SUM(p.amount),0) as revenue
         FROM payments p
         WHERE p.mode IN ('Cash','UPI','Credit')
           AND (p.deletedAt IS NULL)
           AND p.createdAt >= ? AND p.createdAt < ?`,
      [startUtc, endUtc]
    );
    return (payRow as any)?.revenue || 0;
  }

  private async getCashAndUpiSplit(
    startUtc: string,
    endUtc: string
  ): Promise<{ cashPortion: number; upiPortion: number }> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT 
         COALESCE(SUM(CASE WHEN mode = 'Cash' AND (subType IS NULL OR subType='Clearance') THEN amount ELSE 0 END),0) as cash,
         COALESCE(SUM(CASE WHEN mode = 'UPI'  AND (subType IS NULL OR subType='Clearance') THEN amount ELSE 0 END),0) as upi
       FROM payments 
       WHERE (deletedAt IS NULL)
         AND createdAt >= ? AND createdAt < ?`,
      [startUtc, endUtc]
    )) as any;
    return { cashPortion: row?.cash || 0, upiPortion: row?.upi || 0 };
  }

  private async getOutstandingCredit(): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const result = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(creditBalance),0) as total FROM customers`
    )) as any;
    return result?.total || 0;
  }

  private async getCreditAccrued(
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(SUM(amount),0) as total FROM payments 
      WHERE subType = 'Accrual' AND (deletedAt IS NULL)
        AND createdAt >= ? AND createdAt < ?
    `,
      [startUtc, endUtc]
    )) as any;
    return result?.total || 0;
  }

  private async getCreditCleared(
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(SUM(amount),0) as total FROM payments 
      WHERE subType = 'Clearance' AND (deletedAt IS NULL)
        AND createdAt >= ? AND createdAt < ?
    `,
      [startUtc, endUtc]
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
  WHERE (deletedAt IS NULL) AND expenseDate >= ? AND expenseDate <= ?`,
      [startDate, endDate]
    )) as any;

    return result?.expenses || 0;
  }

  // Expense reporting based on settlements
  private async getExpensePaid(
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_settlements 
       WHERE (subType IS NULL OR subType = '' OR subType = 'Clearance')
         AND createdAt >= ? AND createdAt < ?
         AND (deletedAt IS NULL)`,
      [startUtc, endUtc]
    )) as any;
    return row?.total || 0;
  }

  private async getExpenseCreditAccrued(
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_settlements 
       WHERE subType = 'Accrual' AND createdAt >= ? AND createdAt < ?
         AND (deletedAt IS NULL)`,
      [startUtc, endUtc]
    )) as any;
    return row?.total || 0;
  }

  private async getExpenseCreditCleared(
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_settlements 
       WHERE subType = 'Clearance' AND createdAt >= ? AND createdAt < ?
         AND (deletedAt IS NULL)`,
      [startUtc, endUtc]
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

    // Compute UTC lower bound for the earliest IST date we want
    const startIst = new Date(Date.now() + 5.5 * 3600 * 1000 - days * 86400000);
    const startUtcIso = new Date(
      startIst.getTime() - 5.5 * 3600 * 1000
    ).toISOString();
    const result = (await db.getAllAsync(
      `SELECT 
         DATE(ko.createdAt, '+330 minutes') as date,
         COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as revenue,
         COUNT(DISTINCT ko.id) as orders
       FROM kot_orders ko
       LEFT JOIN kot_items ki ON ko.id = ki.kotId
       WHERE ko.billId IS NOT NULL 
         AND (ko.deletedAt IS NULL)
         AND (ki.deletedAt IS NULL OR ki.deletedAt IS NULL)
         AND ko.createdAt >= ?
       GROUP BY DATE(ko.createdAt, '+330 minutes')
       ORDER BY DATE(ko.createdAt, '+330 minutes') DESC`,
      [startUtcIso]
    )) as any[];

    return result.map((row) => ({
      date: row.date,
      revenue: row.revenue || 0,
      orders: row.orders || 0,
    }));
  }

  // Advances: ledger-based metrics
  private async getAdvanceByType(
    entryType: "Add" | "Apply" | "Refund",
    startUtc: string,
    endUtc: string
  ): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM customer_advances 
       WHERE entryType = ? AND (deletedAt IS NULL) AND createdAt >= ? AND createdAt < ?`,
      [entryType, startUtc, endUtc]
    )) as any;
    return row?.total || 0;
  }

  private async getAdvanceOutstanding(): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT 
         COALESCE(SUM(CASE WHEN entryType='Add' THEN amount ELSE 0 END),0) -
         COALESCE(SUM(CASE WHEN entryType='Apply' THEN amount ELSE 0 END),0) -
         COALESCE(SUM(CASE WHEN entryType='Refund' THEN amount ELSE 0 END),0) as outstanding
       FROM customer_advances
       WHERE (deletedAt IS NULL)`
    )) as any;
    return row?.outstanding || 0;
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
      query += ` WHERE expenseDate >= ? AND expenseDate <= ?`;
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

    const where = dateFilter
      ? `WHERE e.expenseDate >= ? AND e.expenseDate <= ?`
      : "";
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
      totalReceived: number;
    }[]
  > {
    if (!db) throw new Error("Database not initialized");

    let query = `
      SELECT 
        mi.name as itemName,
        SUM(ki.quantity) as totalQuantity,
        SUM(ki.quantity * ki.priceAtTime) as totalReceived
      FROM kot_items ki
      JOIN menu_items mi ON ki.itemId = mi.id
      JOIN kot_orders ko ON ki.kotId = ko.id
    `;

    let params: string[] = [];

    if (dateFilter) {
      // Convert inclusive IST dates to a single UTC range for index-friendly filtering
      const startIst = new Date(dateFilter.startDate + "T00:00:00.000+05:30");
      const endNextIst = new Date(
        new Date(dateFilter.endDate + "T00:00:00.000+05:30").getTime() +
          86400000
      );
      const startUtc = new Date(
        startIst.getTime() - 5.5 * 3600 * 1000
      ).toISOString();
      const endUtc = new Date(
        endNextIst.getTime() - 5.5 * 3600 * 1000
      ).toISOString();
      query += ` WHERE ko.createdAt >= ? AND ko.createdAt < ?`;
      params = [startUtc, endUtc];
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
      totalReceived: row.totalReceived || 0,
    }));
  }

  async getTotalRevenue(startUtc: string, endUtc: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    // Total billed amount: sum of all items in billed KOTs
    const result = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalRevenue
       FROM kot_items ki
       JOIN kot_orders ko ON ki.kotId = ko.id
       WHERE ko.billId IS NOT NULL
         AND (ko.deletedAt IS NULL)
         AND (ki.deletedAt IS NULL OR ki.deletedAt IS NULL)
         AND ko.createdAt >= ? AND ko.createdAt < ?`,
      [startUtc, endUtc]
    )) as any;
    return result?.totalRevenue || 0;
  }
}

export const dashboardService = new DashboardService();
