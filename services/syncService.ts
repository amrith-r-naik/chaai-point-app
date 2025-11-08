import { db } from "@/lib/db";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { syncLog } from "@/services/syncLog";

type TableName =
  | "customers"
  | "menu_items"
  | "bills"
  | "kot_orders"
  | "kot_items"
  | "payments"
  | "receipts"
  | "expenses"
  | "split_payments"
  | "expense_settlements"
  | "customer_advances";

type RowMap = Record<string, any>;

// Phase 4 scope: sync all business tables. Order respects FK dependencies.
const TABLES: TableName[] = [
  "customers",
  "menu_items",
  "bills",
  "kot_orders",
  "kot_items",
  "receipts",
  "split_payments",
  "payments",
  "expenses",
  "expense_settlements",
  "customer_advances",
];

// Time helpers to robustly compare timestamps (supporting both ISO and "YYYY-MM-DD HH:MM:SS")
function normalizeTsString(ts: string | null | undefined): string | null {
  if (!ts) return null;
  if (ts.includes("T")) return ts; // Assume already ISO
  return ts.replace(" ", "T") + "Z";
}

function toMs(ts: string | null | undefined): number | null {
  const norm = normalizeTsString(ts);
  if (!norm) return null;
  const ms = Date.parse(norm);
  return Number.isNaN(ms) ? null : ms;
}

function latestMs(...values: (string | null | undefined)[]): number | null {
  const arr = values.map((v) => toMs(v)).filter((v): v is number => v !== null);
  if (!arr.length) return null;
  return Math.max(...arr);
}

async function getSyncCheckpoint(table: string) {
  if (!db) throw new Error("DB not ready");
  const row = (await db.getFirstAsync(
    `SELECT lastPushAt, lastPullAt FROM sync_state WHERE tableName = ?`,
    [table]
  )) as any;
  return {
    lastPushAt: row?.lastPushAt || null,
    lastPullAt: row?.lastPullAt || null,
  };
}

async function setSyncCheckpoint(
  table: string,
  values: { lastPushAt?: string | null; lastPullAt?: string | null }
) {
  if (!db) throw new Error("DB not ready");
  const current = await getSyncCheckpoint(table);
  const next = {
    lastPushAt: values.lastPushAt ?? current.lastPushAt,
    lastPullAt: values.lastPullAt ?? current.lastPullAt,
  };
  await db.runAsync(
    `INSERT INTO sync_state (tableName, lastPushAt, lastPullAt)
     VALUES (?, ?, ?)
     ON CONFLICT(tableName) DO UPDATE SET lastPushAt=excluded.lastPushAt, lastPullAt=excluded.lastPullAt`,
    [table, next.lastPushAt, next.lastPullAt]
  );
}

async function fetchLocalChanges(
  table: TableName,
  since: string | null
): Promise<RowMap[]> {
  if (!db) throw new Error("DB not ready");
  const clause = since ? `WHERE updatedAt > ? OR deletedAt > ?` : "";
  const params = since ? [since, since] : [];
  const rows = (await db.getAllAsync(
    `SELECT * FROM ${table} ${clause}`,
    params
  )) as any[];
  syncLog.log(`[sync][local] fetchLocalChanges`, {
    table,
    since,
    count: rows.length,
  });
  return rows;
}

function toCloud(table: TableName, row: RowMap): RowMap {
  const nowIso = new Date().toISOString();
  const createdAt = row.createdAt ?? row.updatedAt ?? nowIso;
  const updatedAt = row.updatedAt ?? row.createdAt ?? nowIso;
  const base: RowMap = {
    id: row.id,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: row.deletedAt ?? null,
    shop_id: row.shopId || "shop_1",
  };
  if (table === "customers") {
    return {
      ...base,
      name: row.name,
      contact: row.contact ?? null,
      credit_balance: row.creditBalance ?? 0,
    };
  }
  if (table === "menu_items") {
    return {
      ...base,
      name: row.name,
      category: row.category ?? null,
      price: row.price,
      is_active: row.isActive ? true : false,
    };
  }
  if (table === "bills") {
    const payload: any = {
      ...base,
      customer_id: row.customerId,
      total: row.total,
    };
    // Do not push local provisional bill numbers; server will assign
    return payload;
  }
  if (table === "kot_orders") {
    const payload: any = {
      ...base,
      customer_id: row.customerId,
      bill_id: row.billId ?? null,
    };
    // Do not push local provisional kot numbers; server will assign
    return payload;
  }
  if (table === "kot_items") {
    return {
      ...base,
      kot_id: row.kotId,
      item_id: row.itemId,
      quantity: row.quantity,
      price_at_time: row.priceAtTime,
    };
  }
  if (table === "payments") {
    return {
      ...base,
      bill_id: row.billId ?? null,
      customer_id: row.customerId,
      amount: row.amount,
      mode: row.mode,
      sub_type: row.subType ?? null,
      remarks: row.remarks ?? null,
    };
  }
  if (table === "receipts") {
    const payload: any = {
      ...base,
      customer_id: row.customerId,
      bill_id: row.billId ?? null,
      amount: row.amount,
      mode: row.mode,
      remarks: row.remarks ?? null,
    };
    // Do not push local provisional receipt numbers; server will assign
    return payload;
  }
  if (table === "expenses") {
    const payload: any = {
      ...base,
      amount: row.amount,
      towards: row.towards,
      mode: row.mode,
      remarks: row.remarks ?? null,
      expense_date:
        row.expenseDate ?? (row.createdAt ? row.createdAt.slice(0, 10) : null),
    };
    // Do not push local provisional voucher numbers; server will assign
    return payload;
  }
  if (table === "split_payments") {
    return {
      ...base,
      receipt_id: row.receiptId,
      payment_type: row.paymentType,
      amount: row.amount,
    };
  }
  if (table === "expense_settlements") {
    return {
      ...base,
      expense_id: row.expenseId,
      payment_type: row.paymentType,
      sub_type: row.subType ?? null,
      amount: row.amount,
      remarks: row.remarks ?? null,
    };
  }
  if (table === "customer_advances") {
    return {
      ...base,
      customer_id: row.customerId,
      entry_type: row.entryType,
      amount: row.amount,
      remarks: row.remarks ?? null,
    } as any;
  }
  return base;
}

// Fetch server updated_at for a set of IDs to perform conflict-aware filtering
async function fetchServerUpdatedMap(
  table: TableName,
  ids: string[]
): Promise<Map<string, number | null>> {
  if (!ids.length) return new Map();
  // PostgREST 'in' filter; chunk if too many IDs
  const chunkSize = 500;
  const map = new Map<string, number | null>();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .select("id, updated_at, deleted_at")
      .in("id", chunk);
    if (error) {
      console.error(`[sync] fetchServerUpdatedMap failed for ${table}`, error);
      throw error;
    }
    (data || []).forEach((row: any) => {
      const latest = latestMs(row.updated_at, row.deleted_at);
      map.set(row.id, latest);
    });
  }
  return map;
}

async function upsertCloud(table: TableName, rows: RowMap[]) {
  if (!rows.length) return { maxUpdatedAt: null as string | null };
  // Conflict-aware filter: don't push if server has newer latest timestamp
  const serverMap = await fetchServerUpdatedMap(
    table,
    rows.map((r) => r.id)
  );
  const candidates = rows;
  const toSend = candidates.filter((r) => {
    const localLatest = latestMs(r.updatedAt, r.deletedAt, r.createdAt);
    const serverLatest = serverMap.get(r.id) ?? null;
    if (serverLatest === null) return true; // server missing -> insert
    if (localLatest === null) return false;
    const isDelete = !!r.deletedAt;
    // For deletes, allow equality to ensure tombstones propagate despite same-second timestamps
    return isDelete ? localLatest >= serverLatest : localLatest > serverLatest;
  });
  syncLog.log(`[sync][cloud] push candidates`, {
    table,
    candidates: candidates.length,
    toSend: toSend.length,
  });
  // Safety: for child tables with FKs, ensure parents exist on the server before pushing
  if (table === "expense_settlements" && toSend.length) {
    // Collect unique parent expense IDs referenced by rows we'll send
    const expenseIds = Array.from(
      new Set(
        toSend
          .map((r) => r.expenseId)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      )
    );
    if (expenseIds.length) {
      // Check which parent expenses already exist on the server
      const existingParents = await fetchServerUpdatedMap(
        "expenses",
        expenseIds
      );
      const missingIds = expenseIds.filter((id) => !existingParents.has(id));
      if (missingIds.length) {
        // Fetch local parent expense rows and push them first (bypass lastPushAt)
        const chunkSize = 500;
        for (let i = 0; i < missingIds.length; i += chunkSize) {
          const chunk = missingIds.slice(i, i + chunkSize);
          const placeholders = chunk.map(() => "?").join(",");
          const parents = (await db!.getAllAsync(
            `SELECT * FROM expenses WHERE id IN (${placeholders})`,
            chunk
          )) as any[];
          if (parents.length) {
            const parentPayload = parents.map((p) => toCloud("expenses", p));
            const { error: parentErr } = await supabase
              .from("expenses")
              .upsert(parentPayload, { onConflict: "id" });
            if (parentErr) {
              console.error(
                `[sync] upsertCloud parent expenses failed`,
                parentErr
              );
              throw parentErr;
            }
          }
        }
      }
    }
  }
  if (!toSend.length) return { maxUpdatedAt: null };
  const payload = toSend.map((r) => toCloud(table, r));
  const { error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: "id" });
  if (error) {
    console.error(`[sync] upsertCloud failed for ${table}`, {
      error,
      count: payload.length,
    });
    syncLog.log(`[sync][cloud] upsert failed`, { table, error: String(error) });
    throw error;
  }
  const maxUpdatedAt =
    payload
      .map((r) => r.updated_at as string)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  syncLog.log(`[sync][cloud] upsert ok`, {
    table,
    count: payload.length,
    maxUpdatedAt,
  });
  return { maxUpdatedAt };
}

async function pullCloud(
  table: TableName,
  since: string | null
): Promise<{ rows: RowMap[]; maxUpdatedAt: string | null }> {
  let query = supabase
    .from(table)
    .select("*")
    .or("shop_id.eq.shop_1,shop_id.is.null")
    .order("updated_at", { ascending: true })
    .limit(1000);
  if (since) query = query.gte("updated_at", since);
  const { data, error } = await query;
  if (error) {
    console.error(`[sync] pullCloud failed for ${table}`, { error, since });
    syncLog.log(`[sync][cloud] pull failed`, {
      table,
      error: String(error),
      since,
    });
    throw error;
  }
  const rows = (data || []) as any[];
  syncLog.log(`[sync][cloud] pulled`, { table, since, count: rows.length });
  const maxUpdatedAt =
    rows
      .map((r) => r.updated_at as string)
      .filter(Boolean)
      .sort()
      .at(-1) || since;
  return { rows, maxUpdatedAt };
}

async function applyPulled(table: TableName, rows: RowMap[]) {
  if (!db || !rows.length) return;
  await db.execAsync("BEGIN IMMEDIATE TRANSACTION");
  try {
    // Helper to ensure a referenced customer exists locally by pulling once from cloud if missing
    const ensureLocalCustomer = async (
      customerId: string | null | undefined
    ) => {
      if (!customerId) return;
      const exists = (await db!.getFirstAsync(
        `SELECT id FROM customers WHERE id = ?`,
        [customerId]
      )) as any;
      if (exists?.id) return;
      // Fetch from cloud and insert
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();
      if (error) {
        console.warn(`[sync] ensureLocalCustomer fetch failed`, error);
        return;
      }
      if (!data) return;
      const r: any = { ...data };
      const mapKeys: Record<string, string> = {
        created_at: "createdAt",
        updated_at: "updatedAt",
        deleted_at: "deletedAt",
        shop_id: "shopId",
        credit_balance: "creditBalance",
      } as any;
      for (const [k, v] of Object.entries(mapKeys)) {
        if (r[k] !== undefined) {
          r[v] = r[k];
          delete r[k];
        }
      }
      const cols = Object.keys(r);
      const placeholders = cols.map(() => "?").join(",");
      const updates = cols
        .filter((c) => c !== "id")
        .map((c) => `${c}=excluded.${c}`)
        .join(",");
      const values = cols.map((c) => r[c]);
      await db!.runAsync(
        `INSERT INTO customers (${cols.join(",")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values
      );
    };
    // Helper to ensure a referenced expense exists locally by pulling once from cloud if missing
    const ensureLocalExpense = async (expenseId: string | null | undefined) => {
      if (!expenseId) return;
      const exists = (await db!.getFirstAsync(
        `SELECT id FROM expenses WHERE id = ?`,
        [expenseId]
      )) as any;
      if (exists?.id) return;
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", expenseId)
        .maybeSingle();
      if (error) {
        console.warn(`[sync] ensureLocalExpense fetch failed`, error);
        return;
      }
      if (!data) return;
      const r: any = { ...data };
      const mapKeys: Record<string, string> = {
        created_at: "createdAt",
        updated_at: "updatedAt",
        deleted_at: "deletedAt",
        shop_id: "shopId",
        voucher_no: "voucherNo",
      } as any;
      for (const [k, v] of Object.entries(mapKeys)) {
        if (r[k] !== undefined) {
          r[v] = r[k];
          delete r[k];
        }
      }
      const cols = Object.keys(r);
      const placeholders = cols.map(() => "?").join(",");
      const updates = cols
        .filter((c) => c !== "id")
        .map((c) => `${c}=excluded.${c}`)
        .join(",");
      const values = cols.map((c) => r[c]);
      await db!.runAsync(
        `INSERT INTO expenses (${cols.join(",")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values
      );
    };
    for (const r of rows) {
      // Map cloud snake_case to local camelCase
      const mapped: any = { ...r };
      const mapKeys: Record<string, string> = {
        created_at: "createdAt",
        updated_at: "updatedAt",
        deleted_at: "deletedAt",
        shop_id: "shopId",
        credit_balance: "creditBalance",
        bill_number: "billNumber",
        customer_id: "customerId",
        kot_number: "kotNumber",
        bill_id: "billId",
        kot_id: "kotId",
        item_id: "itemId",
        price_at_time: "priceAtTime",
        is_active: "isActive",
        receipt_no: "receiptNo",
        receipt_id: "receiptId",
        voucher_no: "voucherNo",
        payment_type: "paymentType",
        sub_type: "subType",
        expense_id: "expenseId",
        expense_date: "expenseDate",
        entry_type: "entryType",
      } as any;
      for (const [k, v] of Object.entries(mapKeys)) {
        if ((mapped as any)[k] !== undefined) {
          (mapped as any)[v] = (mapped as any)[k];
          delete (mapped as any)[k];
        }
      }

      // Drop legacy/unexpected fields that don't exist locally
      // e.g., some older clouds had customer_advances.payment_date
      if ((mapped as any)["payment_date"] !== undefined) {
        delete (mapped as any)["payment_date"];
      }

      // Whitelist of allowed columns per local table to avoid inserting unknown fields
      const allowed: Record<string, Set<string>> = {
        customers: new Set([
          "id",
          "name",
          "contact",
          "creditBalance",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        menu_items: new Set([
          "id",
          "name",
          "category",
          "price",
          "isActive",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        bills: new Set([
          "id",
          "billNumber",
          "customerId",
          "total",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        kot_orders: new Set([
          "id",
          "kotNumber",
          "customerId",
          "billId",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        kot_items: new Set([
          "id",
          "kotId",
          "itemId",
          "quantity",
          "priceAtTime",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        payments: new Set([
          "id",
          "billId",
          "customerId",
          "amount",
          "mode",
          "subType",
          "remarks",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        receipts: new Set([
          "id",
          "receiptNo",
          "customerId",
          "billId",
          "amount",
          "mode",
          "remarks",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        expenses: new Set([
          "id",
          "voucherNo",
          "amount",
          "towards",
          "mode",
          "remarks",
          "expenseDate",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        split_payments: new Set([
          "id",
          "receiptId",
          "paymentType",
          "amount",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        expense_settlements: new Set([
          "id",
          "expenseId",
          "paymentType",
          "subType",
          "amount",
          "remarks",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
        customer_advances: new Set([
          "id",
          "customerId",
          "entryType",
          "amount",
          "remarks",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "shopId",
        ]),
      } as const;

      // Conflict-aware: only apply cloud if newer than local
      const existing = (await db.getFirstAsync(
        `SELECT updatedAt, deletedAt FROM ${table} WHERE id = ?`,
        [mapped.id]
      )) as any;
      const localLatest = latestMs(existing?.updatedAt, existing?.deletedAt);
      const cloudLatest = latestMs(mapped.updatedAt, mapped.deletedAt);
      if (
        localLatest !== null &&
        cloudLatest !== null &&
        !(cloudLatest > localLatest)
      ) {
        // Local is newer or equal; skip applying this cloud row
        continue;
      }

      // Ensure parents exist for FK tables before insert
      if (table === "bills") {
        await ensureLocalCustomer(mapped.customerId);
      }
      if (table === "expense_settlements") {
        await ensureLocalExpense(mapped.expenseId);
      }
      if (table === "customer_advances") {
        await ensureLocalCustomer(mapped.customerId);
      }

      const cols = Object.keys(mapped).filter((c) =>
        (allowed as any)[table]?.has(c)
      );
      // If any unknown keys were present, ignore them silently
      const filtered: Record<string, any> = {};
      for (const c of cols) filtered[c] = (mapped as any)[c];
      const placeholders = cols.map(() => "?").join(",");
      const updates = cols
        .filter((c) => c !== "id")
        .map((c) => `${c}=excluded.${c}`)
        .join(",");
      const values = cols.map((c) => (filtered as any)[c]);
      await db.runAsync(
        `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values
      );
    }
    syncLog.log(`[sync][local] applied rows`, { table, count: rows.length });
    await db.execAsync("COMMIT");
  } catch (e) {
    console.error(`[sync] applyPulled failed for ${table}`, e);
    syncLog.log(`[sync][local] apply failed`, { table, error: String(e) });
    await db.execAsync("ROLLBACK");
    throw e;
  }
}

export const syncService = {
  async syncAll() {
    if (!isSupabaseConfigured) {
      // Skip cloud sync silently but log once
      console.warn(
        "[sync] Skipping cloud sync: Supabase not configured (set EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY)."
      );
      return;
    }
    syncLog.log(`[sync] starting`);
    for (const table of TABLES) {
      try {
        syncLog.log(`[sync] table begin`, { table });
        // PULL first (conflict-aware apply will skip if local is newer)
        const { lastPullAt } = await getSyncCheckpoint(table);
        syncLog.log(`[sync][cloud] pull`, { table, since: lastPullAt });
        const pulled = await pullCloud(table, lastPullAt);
        await applyPulled(table, pulled.rows);
        if (pulled.maxUpdatedAt)
          await setSyncCheckpoint(table, { lastPullAt: pulled.maxUpdatedAt });

        // PUSH (conflict-aware upsert will skip if server is newer)
        const { lastPushAt } = await getSyncCheckpoint(table);
        syncLog.log(`[sync][cloud] push`, { table, since: lastPushAt });
        const toPush = await fetchLocalChanges(table, lastPushAt);
        const pushed = await upsertCloud(table, toPush);
        if (pushed.maxUpdatedAt) {
          await setSyncCheckpoint(table, { lastPushAt: pushed.maxUpdatedAt });
        } else if (toPush.length > 0) {
          // Nothing sent (server newer/equal). Avoid resending same candidates next run.
          const localMax = toPush
            .map((r) =>
              normalizeTsString(
                r.updatedAt || r.deletedAt || r.createdAt || null
              )
            )
            .filter((s): s is string => !!s)
            .sort()
            .at(-1) as string | undefined;
          if (localMax) {
            syncLog.log(`[sync][cloud] advance lastPushAt without send`, {
              table,
              localMax,
            });
            await setSyncCheckpoint(table, { lastPushAt: localMax });
          }
        }
        syncLog.log(`[sync] table end`, { table });
      } catch (e) {
        console.error(`[sync] table sync failed for ${table}`, e);
        syncLog.log(`[sync] table error`, { table, error: String(e) });
        throw e;
      }
    }
    syncLog.log(`[sync] completed`);
    try {
      const { signalChange } = await import("@/state/appEvents");
      // Trigger global refresh so views recompute after new data pulled
      signalChange.orders();
      signalChange.bills();
      signalChange.payments();
      signalChange.expenses();
      signalChange.customers();
      signalChange.any();
    } catch {}
  },

  async pullCloudChanges() {
    if (!isSupabaseConfigured) {
      console.warn("[sync] Skipping pull: Supabase not configured");
      return;
    }
    syncLog.log(`[sync] pull-only starting`);
    for (const table of TABLES) {
      try {
        const { lastPullAt } = await getSyncCheckpoint(table);
        syncLog.log(`[sync][cloud] pull`, { table, since: lastPullAt });
        const pulled = await pullCloud(table, lastPullAt);
        await applyPulled(table, pulled.rows);
        if (pulled.maxUpdatedAt)
          await setSyncCheckpoint(table, { lastPullAt: pulled.maxUpdatedAt });
      } catch (e) {
        console.error(`[sync] pull failed for ${table}`, e);
        syncLog.log(`[sync] pull error`, { table, error: String(e) });
        throw e;
      }
    }
    syncLog.log(`[sync] pull-only completed`);
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.orders();
      signalChange.bills();
      signalChange.payments();
      signalChange.expenses();
      signalChange.customers();
      signalChange.any();
    } catch {}
  },

  async pushLocalChanges() {
    if (!isSupabaseConfigured) {
      console.warn("[sync] Skipping push: Supabase not configured");
      return;
    }
    syncLog.log(`[sync] push-only starting`);
    for (const table of TABLES) {
      try {
        const { lastPushAt } = await getSyncCheckpoint(table);
        syncLog.log(`[sync][cloud] push`, { table, since: lastPushAt });
        const toPush = await fetchLocalChanges(table, lastPushAt);
        const pushed = await upsertCloud(table, toPush);
        if (pushed.maxUpdatedAt) {
          await setSyncCheckpoint(table, { lastPushAt: pushed.maxUpdatedAt });
        } else if (toPush.length > 0) {
          const localMax = toPush
            .map((r) =>
              normalizeTsString(
                r.updatedAt || r.deletedAt || r.createdAt || null
              )
            )
            .filter((s): s is string => !!s)
            .sort()
            .at(-1) as string | undefined;
          if (localMax) {
            syncLog.log(`[sync][cloud] advance lastPushAt without send`, {
              table,
              localMax,
            });
            await setSyncCheckpoint(table, { lastPushAt: localMax });
          }
        }
      } catch (e) {
        console.error(`[sync] push failed for ${table}`, e);
        syncLog.log(`[sync] push error`, { table, error: String(e) });
        throw e;
      }
    }
    syncLog.log(`[sync] push-only completed`);
  },

  async resetPushCheckpoint(table?: TableName) {
    if (!db) throw new Error("DB not ready");
    if (table) {
      await db.runAsync(
        `INSERT INTO sync_state (tableName, lastPushAt, lastPullAt)
         VALUES (?, NULL, (SELECT lastPullAt FROM sync_state WHERE tableName = ?))
         ON CONFLICT(tableName) DO UPDATE SET lastPushAt = NULL`,
        [table, table]
      );
    } else {
      await db.execAsync(`UPDATE sync_state SET lastPushAt = NULL`);
    }
  },
  async resetPullCheckpoint(table?: TableName) {
    if (!db) throw new Error("DB not ready");
    if (table) {
      await db.runAsync(
        `INSERT INTO sync_state (tableName, lastPushAt, lastPullAt)
         VALUES (?, (SELECT lastPushAt FROM sync_state WHERE tableName = ?), NULL)
         ON CONFLICT(tableName) DO UPDATE SET lastPullAt = NULL`,
        [table, table]
      );
    } else {
      await db.execAsync(`UPDATE sync_state SET lastPullAt = NULL`);
    }
  },
  async getLastSyncAt(): Promise<string | null> {
    if (!db) throw new Error("DB not ready");
    const row = (await db.getFirstAsync(
      `SELECT MAX(COALESCE(lastPullAt, lastPushAt)) as ts FROM sync_state`
    )) as any;
    return row?.ts || null;
  },
};
