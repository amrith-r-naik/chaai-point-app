import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export interface BootstrapUser {
  id: string;
  email: string;
  password: string;
  role: "admin" | "staff";
}

// Inserts the provided users only if the local users table is empty.
// Use this for production first-run to create real admin/staff accounts once.
export async function ensureInitialUsers(users: BootstrapUser[]) {
  if (!db) throw new Error("Database is not initialized");
  try {
    const row = (await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM users`
    )) as { count?: number };
    const existing = Number(row?.count || 0);
    if (existing > 0) return; // Already initialized

    if (!users || users.length === 0) return; // No-op unless caller provides users

    const now = new Date().toISOString();
    for (const u of users) {
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
        [u.id, u.email, u.password, u.role, now]
      );
    }
  } catch (e) {
    console.error("ensureInitialUsers failed", e);
    throw e;
  }
}

// Pull users from cloud directory on first launch and insert into local users table
// Expects a table like public.user_accounts (id text, email text, role text, is_active boolean, shop_id text)
// with RLS allowing select within the same shop. Falls back to no-op if table/policies aren’t configured.
export async function ensureInitialUsersFromCloud(shopId = "shop_1") {
  if (!db) throw new Error("Database is not initialized");
  try {
    const row = (await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM users`
    )) as { count?: number };
    const existing = Number(row?.count || 0);
    if (existing > 0) return; // Already initialized locally

    // Fetch active accounts for this shop
    const { data, error } = await supabase
      .from("user_accounts")
      .select("id,email,role,shop_id,is_active")
      .eq("shop_id", shopId)
      .eq("is_active", true);
    if (error) {
      console.warn("ensureInitialUsersFromCloud: fetch failed", error);
      return; // Safe no-op if not configured
    }
    const accounts = (data || []).filter((u: any) => u.email && u.role);
    if (accounts.length === 0) return;

    // Insert with a temporary random password; admins can change it later in-app once that flow exists.
    const now = new Date().toISOString();
    const genPwd = () => Math.random().toString(36).slice(-10);
    for (const acc of accounts) {
      const pwd = genPwd();
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
        [acc.id, acc.email, pwd, acc.role, now]
      );
      console.log(`[bootstrap] created local user`, {
        email: acc.email,
        role: acc.role,
      });
    }
  } catch (e) {
    console.error("ensureInitialUsersFromCloud failed", e);
  }
}
