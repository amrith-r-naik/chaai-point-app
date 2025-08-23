import { db, openDatabase } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { backupService } from "@/services/backupService";
import { syncService } from "@/services/syncService";

type TestResult = { name: string; passed: boolean; details?: string };

const SHOP_ID = "shop_1";

async function ensureDb() {
  await openDatabase();
}

async function upsertCloudCustomer(id: string, fields: any) {
  const payload = { id, shop_id: SHOP_ID, ...fields };
  const { error } = await supabase.from("customers").upsert(payload, {
    onConflict: "id",
  });
  if (error) throw error;
}

async function getCloudCustomer(id: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, updated_at, deleted_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as any;
}

async function getLocalCustomer(id: string) {
  if (!db) throw new Error("DB not ready");
  return (await db.getFirstAsync("SELECT * FROM customers WHERE id = ?", [
    id,
  ])) as any;
}

async function upsertLocalCustomer(id: string, fields: any) {
  if (!db) throw new Error("DB not ready");
  const existing = (await getLocalCustomer(id)) as any;
  const now = new Date().toISOString();
  const row = {
    id,
    shopId: SHOP_ID,
    // Prefer explicit fields over existing so tests can force a change
    name: (fields.name ?? existing?.name) || "Diag User",
    contact: fields.contact ?? existing?.contact ?? null,
    creditBalance: fields.creditBalance ?? existing?.creditBalance ?? 0,
    createdAt: existing?.createdAt || now,
    updatedAt: fields.updatedAt || now,
    deletedAt: fields.deletedAt ?? null,
  };
  await db.runAsync(
    `INSERT INTO customers (id, shopId, name, contact, creditBalance, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET shopId=excluded.shopId, name=excluded.name, contact=excluded.contact, creditBalance=excluded.creditBalance, createdAt=excluded.createdAt, updatedAt=excluded.updatedAt, deletedAt=excluded.deletedAt`,
    [
      row.id,
      row.shopId,
      row.name,
      row.contact,
      row.creditBalance,
      row.createdAt,
      row.updatedAt,
      row.deletedAt,
    ]
  );
}

async function resetCustomerCheckpoints() {
  // Reset pull only for customers to force fetch
  await syncService.resetPullCheckpoint("customers");
}

export async function runCloudWinsTest(): Promise<TestResult> {
  const id = "diag_customer_cloudwins";
  try {
    await ensureDb();
    await upsertLocalCustomer(id, { name: "Local v0" });
    await upsertCloudCustomer(id, { name: "Cloud v1" });
    await resetCustomerCheckpoints();
    await syncService.syncAll();
    const local = await getLocalCustomer(id);
    const cloud = await getCloudCustomer(id);
    const passed = local?.name === "Cloud v1" && cloud?.name === "Cloud v1";
    return {
      name: "Cloud change pulls to local (cloud wins)",
      passed,
      details: `local=${local?.name}, cloud=${cloud?.name}`,
    };
  } catch (e: any) {
    return {
      name: "Cloud change pulls to local (cloud wins)",
      passed: false,
      details: e?.message || String(e),
    };
  }
}

export async function runLocalWinsTest(): Promise<TestResult> {
  const id = "diag_customer_cloudwins"; // reuse same
  try {
    await ensureDb();
    // Local edit newer
    const future = new Date(Date.now() + 1500).toISOString();
    await upsertLocalCustomer(id, {
      name: "Local v2",
      updatedAt: future,
    });
    // Small delay to ensure any prior server timestamps don't tie
    await new Promise((r) => setTimeout(r, 1200));
    await syncService.syncAll();
    const local = await getLocalCustomer(id);
    const cloud = await getCloudCustomer(id);
    const passed = local?.name === "Local v2" && cloud?.name === "Local v2";
    return {
      name: "Local change pushes to cloud (local wins)",
      passed,
      details: `local=${local?.name}, cloud=${cloud?.name}`,
    };
  } catch (e: any) {
    return {
      name: "Local change pushes to cloud (local wins)",
      passed: false,
      details: e?.message || String(e),
    };
  }
}

export async function runCloudDeleteTest(): Promise<TestResult> {
  const id = "diag_customer_clouddel";
  try {
    await ensureDb();
    await upsertLocalCustomer(id, { name: "ToDelete" });
    await upsertCloudCustomer(id, { name: "ToDelete" });
    // Cloud delete (soft)
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await resetCustomerCheckpoints();
    await syncService.syncAll();
    const local = await getLocalCustomer(id);
    const passed = !!local?.deletedAt;
    return {
      name: "Cloud delete propagates to local",
      passed,
      details: `local.deletedAt=${local?.deletedAt}`,
    };
  } catch (e: any) {
    return {
      name: "Cloud delete propagates to local",
      passed: false,
      details: e?.message || String(e),
    };
  }
}

export async function runLocalDeleteTest(): Promise<TestResult> {
  const id = "diag_customer_localdel";
  try {
    await ensureDb();
    await upsertCloudCustomer(id, { name: "ToDelete" });
    // Use cloud's updated_at as base to avoid server clock being ahead
    const cloudBefore = await getCloudCustomer(id);
    const baseMs = Date.parse(
      cloudBefore.updated_at ?? new Date().toISOString()
    );
    const ts = new Date(baseMs + 2000).toISOString();
    await upsertLocalCustomer(id, {
      name: "ToDelete",
      deletedAt: ts,
      updatedAt: ts,
    });
    // Ensure push checkpoint isn't blocking resend
    await syncService.resetPushCheckpoint("customers");
    // Small delay to avoid race with network/apply
    await new Promise((r) => setTimeout(r, 500));
    await syncService.syncAll();
    const cloud = await getCloudCustomer(id);
    const passed = !!cloud?.deleted_at;
    return {
      name: "Local delete propagates to cloud",
      passed,
      details: `cloud.deleted_at=${cloud?.deleted_at}`,
    };
  } catch (e: any) {
    return {
      name: "Local delete propagates to cloud",
      passed: false,
      details: e?.message || String(e),
    };
  }
}

export async function runIdempotentSyncTest(): Promise<TestResult> {
  const id = "diag_customer_idem";
  try {
    await ensureDb();
    await upsertLocalCustomer(id, { name: "Idem" });
    await upsertCloudCustomer(id, { name: "Idem" });
    await syncService.syncAll();
    const before = await getCloudCustomer(id);
    await syncService.syncAll();
    const after = await getCloudCustomer(id);
    const passed = before.updated_at === after.updated_at;
    return {
      name: "Second sync is a no-op (no updated_at churn)",
      passed,
      details: `before=${before.updated_at}, after=${after.updated_at}`,
    };
  } catch (e: any) {
    return {
      name: "Second sync is a no-op (no updated_at churn)",
      passed: false,
      details: e?.message || String(e),
    };
  }
}

export async function runBackupTest(): Promise<TestResult> {
  try {
    await ensureDb();
    const res = await backupService.backupNow();
    const latest = await backupService.getLatestBackup();
    const passed =
      !!latest && !!latest.name && res.objectPath.endsWith(latest.name);
    return {
      name: "Backup upload and listing",
      passed,
      details: latest ? `latest=${latest.name}` : "no files",
    };
  } catch (e: any) {
    return {
      name: "Backup upload and listing",
      passed: false,
      details: e?.message || String(e),
    };
  }
}

export async function runAllSyncDiagnostics() {
  const results: TestResult[] = [];
  results.push(await runCloudWinsTest());
  results.push(await runLocalWinsTest());
  results.push(await runCloudDeleteTest());
  results.push(await runLocalDeleteTest());
  results.push(await runIdempotentSyncTest());
  results.push(await runBackupTest());
  return results;
}

export type { TestResult };
