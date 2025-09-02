import { db, withTransaction } from "@/lib/db";
import { signalChange } from "@/state/appEvents";
import uuid from "react-native-uuid";

export type AdvanceEntryType = "Add" | "Apply" | "Refund";

export interface AdvanceEntry {
  id: string;
  customerId: string;
  entryType: AdvanceEntryType;
  amount: number; // stored in rupees
  remarks: string | null;
  createdAt: string; // ISO timestamp
}

// ...

class AdvanceService {
  // Compute current advance balance for a customer
  async getBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT 
				 COALESCE(SUM(CASE WHEN entryType='Add' THEN amount ELSE 0 END),0)
				 - COALESCE(SUM(CASE WHEN entryType='Apply' THEN amount ELSE 0 END),0)
				 - COALESCE(SUM(CASE WHEN entryType='Refund' THEN amount ELSE 0 END),0) 
				 AS balance
			 FROM customer_advances
			 WHERE customerId = ? AND (deletedAt IS NULL)`,
      [customerId]
    )) as { balance?: number } | null;
    return row?.balance || 0;
  }

  // Fetch ledger entries for a customer (most recent first)
  async getLedger(customerId: string, limit = 100): Promise<AdvanceEntry[]> {
    if (!db) throw new Error("Database not initialized");
    const rows = (await db.getAllAsync(
      `SELECT id, customerId, entryType, amount, remarks, createdAt
			 FROM customer_advances
			 WHERE customerId=? AND (deletedAt IS NULL)
			 ORDER BY createdAt DESC
			 LIMIT ?`,
      [customerId, limit]
    )) as any[];
    return rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      entryType: r.entryType,
      amount: r.amount,
      remarks: r.remarks ?? null,
      createdAt: r.createdAt,
    }));
  }

  // Add money to customer's advance (cash-in); records only in ledger for now
  async addAdvance(
    customerId: string,
    amount: number,
    opts?: { remarks?: string; inTransaction?: boolean }
  ): Promise<AdvanceEntry> {
    if (!db) throw new Error("Database not initialized");
    if (amount <= 0) throw new Error("Amount must be positive");
    const nowIso = new Date().toISOString();
    const entry: AdvanceEntry = {
      id: uuid.v4() as string,
      customerId,
      entryType: "Add",
      amount,
      remarks: opts?.remarks ?? null,
      createdAt: nowIso,
    };
    const insert = async () => {
      await db!.runAsync(
        `INSERT INTO customer_advances (id, customerId, entryType, amount, remarks, createdAt, shopId)
             VALUES (?, ?, ?, ?, ?, ?, 'shop_1')`,
        [
          entry.id,
          entry.customerId,
          entry.entryType,
          entry.amount,
          entry.remarks,
          entry.createdAt,
        ]
      );
    };
    if (opts?.inTransaction) await insert();
    else await withTransaction(insert);
    try {
      signalChange.any();
      signalChange.customers();
    } catch {}
    return entry;
  }

  // Apply advance towards a bill/order (cash-out from advance wallet).
  // Enforces non-negative balance.
  async applyAdvance(
    customerId: string,
    amount: number,
    opts?: {
      remarks?: string;
      context?: { billId?: string };
      inTransaction?: boolean;
    }
  ): Promise<AdvanceEntry> {
    if (!db) throw new Error("Database not initialized");
    if (amount <= 0) throw new Error("Amount must be positive");
    const balance = await this.getBalance(customerId);
    if (amount > balance)
      throw new Error("Insufficient advance balance to apply");
    const nowIso = new Date().toISOString();
    const remark =
      opts?.remarks ??
      (opts?.context?.billId ? `Applied to bill ${opts.context.billId}` : null);
    const entry: AdvanceEntry = {
      id: uuid.v4() as string,
      customerId,
      entryType: "Apply",
      amount,
      remarks: remark,
      createdAt: nowIso,
    };
    const insert = async () => {
      await db!.runAsync(
        `INSERT INTO customer_advances (id, customerId, entryType, amount, remarks, createdAt, shopId)
             VALUES (?, ?, ?, ?, ?, ?, 'shop_1')`,
        [
          entry.id,
          entry.customerId,
          entry.entryType,
          entry.amount,
          entry.remarks,
          entry.createdAt,
        ]
      );
    };
    if (opts?.inTransaction) await insert();
    else await withTransaction(insert);
    try {
      signalChange.any();
      signalChange.customers();
    } catch {}
    return entry;
  }

  // Refund available advance back to customer (cash-out)
  async refundAdvance(
    customerId: string,
    amount: number,
    opts?: { remarks?: string; inTransaction?: boolean }
  ): Promise<AdvanceEntry> {
    if (!db) throw new Error("Database not initialized");
    if (amount <= 0) throw new Error("Amount must be positive");
    const balance = await this.getBalance(customerId);
    if (amount > balance)
      throw new Error("Insufficient advance balance to refund");
    const nowIso = new Date().toISOString();
    const entry: AdvanceEntry = {
      id: uuid.v4() as string,
      customerId,
      entryType: "Refund",
      amount,
      remarks: opts?.remarks ?? null,
      createdAt: nowIso,
    };
    const insert = async () => {
      await db!.runAsync(
        `INSERT INTO customer_advances (id, customerId, entryType, amount, remarks, createdAt, shopId)
             VALUES (?, ?, ?, ?, ?, ?, 'shop_1')`,
        [
          entry.id,
          entry.customerId,
          entry.entryType,
          entry.amount,
          entry.remarks,
          entry.createdAt,
        ]
      );
    };
    if (opts?.inTransaction) await insert();
    else await withTransaction(insert);
    try {
      signalChange.any();
      signalChange.customers();
    } catch {}
    return entry;
  }
}

export const advanceService = new AdvanceService();
export default advanceService;
