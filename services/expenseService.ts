import { db, nextLocalNumber, withTransaction } from "@/lib/db";
import { SplitPayment } from "@/types/payment";
import uuid from "react-native-uuid";

type ExpenseSplit = Pick<SplitPayment, "type" | "amount"> & {
  remarks?: string | null;
};

export interface ExpenseRecord {
  id: string;
  voucherNo: number;
  amount: number;
  towards: string;
  mode: string; // legacy display: Cash | UPI | Credit | Split
  remarks: string | null;
  createdAt: string;
}

export interface ExpenseDetails extends ExpenseRecord {
  settlements: {
    id: string;
    paymentType: "Cash" | "UPI" | "Credit";
    subType: "Accrual" | "Clearance" | null;
    amount: number;
    remarks: string | null;
    createdAt: string;
  }[];
  paidAmount: number;
  creditAccrued: number;
  creditCleared: number;
  creditOutstanding: number;
  status: "Paid" | "Partial" | "Credit";
}

class ExpenseService {
  private assertDb() {
    if (!db) throw new Error("Database not initialized");
  }

  private normalizeSplits(splits: ExpenseSplit[]): ExpenseSplit[] {
    const agg: Record<string, number> = {};
    for (const s of splits) {
      if (!s || !s.type) continue;
      agg[s.type] = (agg[s.type] || 0) + (s.amount || 0);
    }
    return Object.entries(agg).map(([type, amount]) => ({
      type: type as any,
      amount,
    }));
  }

  private async computeDetails(
    expenseId: string
  ): Promise<
    Pick<
      ExpenseDetails,
      | "paidAmount"
      | "creditAccrued"
      | "creditCleared"
      | "creditOutstanding"
      | "status"
    >
  > {
    this.assertDb();
    const sums = (await db!.getFirstAsync(
      `SELECT 
         COALESCE(SUM(CASE WHEN paymentType IN ('Cash','UPI') AND (subType IS NULL OR subType='') THEN amount ELSE 0 END),0) as paid,
         COALESCE(SUM(CASE WHEN paymentType='Credit' AND subType='Accrual' THEN amount ELSE 0 END),0) as accrued,
         COALESCE(SUM(CASE WHEN subType='Clearance' THEN amount ELSE 0 END),0) as cleared
       FROM expense_settlements WHERE expenseId = ? AND (deletedAt IS NULL)`,
      [expenseId]
    )) as any;
    const paidAmount = sums?.paid || 0;
    const creditAccrued = sums?.accrued || 0;
    const creditCleared = sums?.cleared || 0;
    const creditOutstanding = Math.max(0, creditAccrued - creditCleared);
    // Derive status: if outstanding>0 -> Partial or Credit depending on paid
    let status: "Paid" | "Partial" | "Credit" = "Paid";
    if (creditOutstanding > 0) {
      status = paidAmount > 0 || creditCleared > 0 ? "Partial" : "Credit";
    }
    return {
      paidAmount,
      creditAccrued,
      creditCleared,
      creditOutstanding,
      status,
    };
  }

  async getExpense(expenseId: string): Promise<ExpenseDetails> {
    this.assertDb();
    const e = (await db!.getFirstAsync(`SELECT * FROM expenses WHERE id = ?`, [
      expenseId,
    ])) as any;
    if (!e) throw new Error("Expense not found");
    const settlements = (await db!.getAllAsync(
      `SELECT id, paymentType, subType, amount, remarks, createdAt FROM expense_settlements 
       WHERE expenseId = ? AND (deletedAt IS NULL) ORDER BY createdAt ASC`,
      [expenseId]
    )) as any[];
    const stats = await this.computeDetails(expenseId);
    return {
      id: e.id,
      voucherNo: e.voucherNo,
      amount: e.amount,
      towards: e.towards,
      mode: e.mode,
      remarks: e.remarks,
      createdAt: e.createdAt,
      settlements: settlements.map((s) => ({
        id: s.id,
        paymentType: s.paymentType,
        subType: s.subType,
        amount: s.amount,
        remarks: s.remarks ?? null,
        createdAt: s.createdAt,
      })),
      ...stats,
    };
  }

  async createExpense(params: {
    amount: number;
    towards: string;
    remarks?: string | null;
    expenseDate?: string; // YYYY-MM-DD
    paymentType?: "Cash" | "UPI" | "Credit"; // for simple path
    splitPayments?: ExpenseSplit[]; // for split path
  }): Promise<{ expenseId: string }> {
    this.assertDb();
    const amount = Math.round(params.amount);
    if (!(amount > 0)) throw new Error("Amount must be > 0");
    const towards = (params.towards || "").trim();
    if (!towards) throw new Error("Towards is required");

    // Build splits
    let splits: ExpenseSplit[] = [];
    if (params.splitPayments && params.splitPayments.length) {
      splits = this.normalizeSplits(params.splitPayments);
    } else if (params.paymentType) {
      splits = [{ type: params.paymentType, amount }];
    } else {
      throw new Error("Provide paymentType or splitPayments");
    }
    // Validate splits
    const total = splits.reduce((s, p) => s + (p.amount || 0), 0);
    if (total !== amount) throw new Error("Split total must equal amount");
    const creditParts = splits.filter((p) => p.type === "Credit");
    if (creditParts.length > 1)
      throw new Error("At most one Credit part allowed");
    if (splits.some((p) => p.amount <= 0))
      throw new Error("Split amounts must be > 0");

    return await withTransaction(async () => {
      // Generate voucher (local provisional)
      const voucherNo = await nextLocalNumber("expense", new Date());
      const id = uuid.v4() as string;
      const createdAt = new Date().toISOString();
      // Determine legacy mode for display compatibility
      let mode = "Split";
      if (splits.length === 1) mode = splits[0].type;
      else if (creditParts.length === 0) {
        // only paid parts
        const onlyType = new Set(splits.map((s) => s.type));
        if (onlyType.size === 1) mode = splits[0].type;
      }
      await db!.runAsync(
        `INSERT INTO expenses (id, voucherNo, amount, towards, mode, remarks, createdAt, expenseDate, shopId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'shop_1')`,
        [
          id,
          voucherNo,
          amount,
          towards,
          mode,
          params.remarks ?? null,
          createdAt,
          params.expenseDate ?? createdAt.slice(0, 10),
        ]
      );
      // Insert settlements
      for (const s of splits) {
        const sid = uuid.v4() as string;
        const subType = s.type === "Credit" ? "Accrual" : null;
        await db!.runAsync(
          `INSERT INTO expense_settlements (id, expenseId, paymentType, subType, amount, remarks, createdAt, shopId)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'shop_1')`,
          [
            sid,
            id,
            s.type,
            subType,
            Math.round(s.amount),
            s.remarks ?? null,
            createdAt,
          ]
        );
      }
      try {
        const { signalChange } = await import("@/state/appEvents");
        signalChange.expenses();
        signalChange.any();
      } catch {}
      return { expenseId: id };
    });
  }

  async clearExpenseCredit(
    expenseId: string,
    clearSplits: {
      type: "Cash" | "UPI";
      amount: number;
      remarks?: string | null;
    }[]
  ): Promise<void> {
    this.assertDb();
    if (!clearSplits?.length) throw new Error("No clearance splits provided");
    if (clearSplits.some((s) => s.amount <= 0))
      throw new Error("Amounts must be > 0");

    await withTransaction(async () => {
      // Ensure expense exists
      const e = await db!.getFirstAsync(
        `SELECT id FROM expenses WHERE id = ?`,
        [expenseId]
      );
      if (!e) throw new Error("Expense not found");
      const stats = await this.computeDetails(expenseId);
      const maxClear = stats.creditOutstanding;
      const sum = clearSplits.reduce((s, p) => s + Math.round(p.amount), 0);
      if (sum > maxClear)
        throw new Error("Clearance exceeds outstanding credit");
      const nowIso = new Date().toISOString();
      for (const s of clearSplits) {
        const sid = uuid.v4() as string;
        await db!.runAsync(
          `INSERT INTO expense_settlements (id, expenseId, paymentType, subType, amount, remarks, createdAt, shopId)
           VALUES (?, ?, ?, 'Clearance', ?, ?, ?, 'shop_1')`,
          [
            sid,
            expenseId,
            s.type,
            Math.round(s.amount),
            s.remarks ?? null,
            nowIso,
          ]
        );
      }
      try {
        const { signalChange } = await import("@/state/appEvents");
        signalChange.expenses();
        signalChange.any();
      } catch {}
    });
  }
}

export const expenseService = new ExpenseService();
