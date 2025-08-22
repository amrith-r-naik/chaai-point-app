import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type TableName =
  | "customers"
  | "menu_items"
  | "bills"
  | "kot_orders"
  | "kot_items"
  | "payments"
  | "receipts"
  | "expenses"
  | "split_payments";

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
];

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
    return {
      ...base,
      bill_number: row.billNumber,
      customer_id: row.customerId,
      total: row.total,
    };
  }
  if (table === "kot_orders") {
    return {
      ...base,
      kot_number: row.kotNumber,
      customer_id: row.customerId,
      bill_id: row.billId ?? null,
    };
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
    return {
      ...base,
      receipt_no: row.receiptNo,
      customer_id: row.customerId,
      bill_id: row.billId ?? null,
      amount: row.amount,
      mode: row.mode,
      remarks: row.remarks ?? null,
    };
  }
  if (table === "expenses") {
    return {
      ...base,
      voucher_no: row.voucherNo,
      amount: row.amount,
      towards: row.towards,
      mode: row.mode,
      remarks: row.remarks ?? null,
    };
  }
  if (table === "split_payments") {
    return {
      ...base,
      receipt_id: row.receiptId,
      payment_type: row.paymentType,
      amount: row.amount,
    };
  }
  return base;
}

// Fetch server updated_at for a set of IDs to perform conflict-aware filtering
async function fetchServerUpdatedMap(
  table: TableName,
  ids: string[]
): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  // PostgREST 'in' filter; chunk if too many IDs
  const chunkSize = 500;
  const map = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .select("id, updated_at")
      .in("id", chunk);
    if (error) {
      console.error(`[sync] fetchServerUpdatedMap failed for ${table}`, error);
      throw error;
    }
    (data || []).forEach((row: any) => map.set(row.id, row.updated_at || null));
  }
  return map;
}

async function upsertCloud(table: TableName, rows: RowMap[]) {
  if (!rows.length) return { maxUpdatedAt: null as string | null };
  // Conflict-aware filter: don't push if server has newer updated_at
  const serverMap = await fetchServerUpdatedMap(
    table,
    rows.map((r) => r.id)
  );
  const toSend = rows.filter((r) => {
    const localUpdated = (r.updatedAt || r.createdAt || "") as string;
    const serverUpdated = serverMap.get(r.id) || null;
    // if server has no row -> insert; else push only if local >= server
    if (!serverUpdated) return true;
    return localUpdated >= serverUpdated;
  });
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
    throw error;
  }
  const maxUpdatedAt =
    payload
      .map((r) => r.updated_at as string)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
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
    throw error;
  }
  const rows = (data || []) as any[];
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
      } as any;
      for (const [k, v] of Object.entries(mapKeys)) {
        if ((mapped as any)[k] !== undefined) {
          (mapped as any)[v] = (mapped as any)[k];
          delete (mapped as any)[k];
        }
      }

      // Conflict-aware: only apply cloud if newer than local
      const existing = (await db.getFirstAsync(
        `SELECT updatedAt FROM ${table} WHERE id = ?`,
        [mapped.id]
      )) as any;
      const localUpdated = (existing?.updatedAt || null) as string | null;
      const cloudUpdated = (mapped.updatedAt || null) as string | null;
      if (localUpdated && cloudUpdated && !(cloudUpdated > localUpdated)) {
        // Local is newer or equal; skip applying this cloud row
        continue;
      }

      const cols = Object.keys(mapped);
      const placeholders = cols.map(() => "?").join(",");
      const updates = cols
        .filter((c) => c !== "id")
        .map((c) => `${c}=excluded.${c}`)
        .join(",");
      const values = cols.map((c) => (mapped as any)[c]);
      await db.runAsync(
        `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values
      );
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    console.error(`[sync] applyPulled failed for ${table}`, e);
    await db.execAsync("ROLLBACK");
    throw e;
  }
}

export const syncService = {
  async syncAll() {
    for (const table of TABLES) {
      try {
        // PULL first (conflict-aware apply will skip if local is newer)
        const { lastPullAt } = await getSyncCheckpoint(table);
        const pulled = await pullCloud(table, lastPullAt);
        await applyPulled(table, pulled.rows);
        if (pulled.maxUpdatedAt)
          await setSyncCheckpoint(table, { lastPullAt: pulled.maxUpdatedAt });

        // PUSH (conflict-aware upsert will skip if server is newer)
        const { lastPushAt } = await getSyncCheckpoint(table);
        const toPush = await fetchLocalChanges(table, lastPushAt);
        const pushed = await upsertCloud(table, toPush);
        if (pushed.maxUpdatedAt)
          await setSyncCheckpoint(table, { lastPushAt: pushed.maxUpdatedAt });
      } catch (e) {
        console.error(`[sync] table sync failed for ${table}`, e);
        throw e;
      }
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
