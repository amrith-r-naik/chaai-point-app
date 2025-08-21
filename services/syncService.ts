import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type TableName = "customers" | "menu_items";

type RowMap = Record<string, any>;

const TABLES: TableName[] = ["customers", "menu_items"]; // Phase 3 scope

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
  const base: RowMap = {
    id: row.id,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
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
  return base;
}

async function upsertCloud(table: TableName, rows: RowMap[]) {
  if (!rows.length) return { maxUpdatedAt: null as string | null };
  const payload = rows.map((r) => toCloud(table, r));
  const { error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
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
    .eq("shop_id", "shop_1")
    .order("updated_at", { ascending: true })
    .limit(1000);
  if (since) query = query.gt("updated_at", since);
  const { data, error } = await query;
  if (error) throw error;
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
        item_id: "itemId",
        price_at_time: "priceAtTime",
        is_active: "isActive",
        receipt_no: "receiptNo",
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
    await db.execAsync("ROLLBACK");
    throw e;
  }
}

export const syncService = {
  async syncAll() {
    for (const table of TABLES) {
      // PUSH
      const { lastPushAt } = await getSyncCheckpoint(table);
      const toPush = await fetchLocalChanges(table, lastPushAt);
      const pushed = await upsertCloud(table, toPush);
      if (pushed.maxUpdatedAt)
        await setSyncCheckpoint(table, { lastPushAt: pushed.maxUpdatedAt });

      // PULL
      const { lastPullAt } = await getSyncCheckpoint(table);
      const pulled = await pullCloud(table, lastPullAt);
      await applyPulled(table, pulled.rows);
      if (pulled.maxUpdatedAt)
        await setSyncCheckpoint(table, { lastPullAt: pulled.maxUpdatedAt });
    }
  },
};
