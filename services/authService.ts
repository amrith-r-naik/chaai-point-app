import { db } from "@/lib/db";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  authState,
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from "@/state/authState";

export interface User {
  id: string;
  email: string;
  role: string;
}

export async function loginUser(
  email: string,
  password: string
): Promise<User | null> {
  try {
    if (!isSupabaseConfigured) throw new Error("Supabase not configured");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    const sessionUser = data.user;
    if (!sessionUser) return null;
    console.log("[auth] signIn ok", {
      id: sessionUser.id,
      email: sessionUser.email || email,
    });

    // Fetch remote role once and reconcile with local
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .maybeSingle();
    if (profileErr) {
      console.log("[auth] profiles fetch error (login)", profileErr);
    }
    const remoteRoleRaw =
      (profile?.role as string | undefined) ??
      (sessionUser.user_metadata?.role as string | undefined);
    const remoteRole = String(remoteRoleRaw || "staff")
      .toLowerCase()
      .trim();
    // Read local
    const local = db
      ? ((await db.getFirstAsync(
          `SELECT id, email, role FROM users WHERE id = ?`,
          [sessionUser.id]
        )) as User | undefined)
      : undefined;
    const localRole = local?.role
      ? String(local.role).toLowerCase().trim()
      : undefined;
    const finalRole = (remoteRole || localRole || "staff").toLowerCase().trim();
    console.log("[auth] roles (login)", {
      remoteRoleRaw,
      remoteRole,
      localRole,
      finalRole,
    });
    // Persist local snapshot
    if (db) {
      const now = new Date().toISOString();
      console.log("[auth] persist local user (login)", {
        id: sessionUser.id,
        email: sessionUser.email || email,
        role: finalRole,
      });
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
        [sessionUser.id, sessionUser.email || email, "", finalRole, now]
      );
    }

    const user: User = {
      id: sessionUser.id,
      email: sessionUser.email || email,
      role: finalRole,
    };
    authState.user.set(user);
    console.log("[auth] auth.user set (login)", user);
    await saveUserSession(user);
    return user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await clearUserSession();
    authState.user.set(null);
    authState.error.set("");
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

export async function initializeAuth(): Promise<User | null> {
  try {
    authState.loading.set(true);
    // Try Supabase session only to know if signed-in; do not fetch profiles
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      if (sessionUser) {
        console.log("[auth] init: session found", {
          id: sessionUser.id,
          email: sessionUser.email || "",
        });
        // Load from local DB
        let local: User | null = null;
        if (db) {
          local = (await db.getFirstAsync(
            `SELECT id, email, role FROM users WHERE id = ?`,
            [sessionUser.id]
          )) as User | null;
        }
        const metaRole =
          (sessionUser.user_metadata?.role as string | undefined) || undefined;
        let localRole = local?.role || undefined;

        // One-time seed: if no local role and no metadata role, fetch profiles.role once
        if (!localRole && !metaRole && isSupabaseConfigured) {
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sessionUser.id)
            .maybeSingle();
          if (profileErr) {
            console.log("[auth] profiles fetch error (init)", profileErr);
          }
          if (profile?.role) {
            localRole = String(profile.role);
            if (db) {
              const now = new Date().toISOString();
              console.log("[auth] init: seed local role from profiles", {
                id: sessionUser.id,
                role: localRole.toLowerCase().trim(),
              });
              await db.runAsync(
                `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
                [
                  sessionUser.id,
                  local?.email || sessionUser.email || "",
                  "",
                  localRole.toLowerCase().trim(),
                  now,
                ]
              );
            }
          }
        }

        let finalRole = String(localRole || metaRole || "staff")
          .toLowerCase()
          .trim();
        console.log("[auth] roles (init)", {
          metaRole,
          localRole,
          finalRole,
        });
        // If metadata differs and is present, refresh local snapshot
        if (
          metaRole &&
          String(metaRole).toLowerCase().trim() !==
            String(localRole || "")
              .toLowerCase()
              .trim()
        ) {
          finalRole = String(metaRole).toLowerCase().trim();
          if (db) {
            const now = new Date().toISOString();
            console.log("[auth] init: update local role from metadata", {
              id: sessionUser.id,
              role: finalRole,
            });
            await db.runAsync(
              `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
              [
                sessionUser.id,
                local?.email || sessionUser.email || "",
                "",
                finalRole,
                now,
              ]
            );
          }
        }
        const email = local?.email || sessionUser.email || "";
        const user: User = { id: sessionUser.id, email, role: finalRole };
        authState.user.set(user);
        console.log("[auth] auth.user set (init)", user);
        await saveUserSession(user);
        authState.isInitialized.set(true);
        return user;
      }
    }
    // Fall back to persisted session (AsyncStorage)
    const user = await loadUserSession();
    authState.isInitialized.set(true);
    return user;
  } catch (error) {
    console.error("Initialize auth error:", error);
    authState.isInitialized.set(true);
    return null;
  } finally {
    authState.loading.set(false);
  }
}

// Force-refresh role from Supabase profiles and update local snapshot and auth state
export async function refreshRoleFromCloud(): Promise<User | null> {
  try {
    if (!isSupabaseConfigured) return authState.user.get();
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user;
    if (!sessionUser) return authState.user.get();
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .maybeSingle();
    if (profileErr) {
      console.log("[auth] profiles fetch error (refresh)", profileErr);
    }
    const remoteRoleRaw =
      (profile?.role as string | undefined) ??
      (sessionUser.user_metadata?.role as string | undefined);
    const finalRole = String(remoteRoleRaw || "staff")
      .toLowerCase()
      .trim();

    // Update local DB snapshot
    if (db) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
        [sessionUser.id, sessionUser.email || "", "", finalRole, now]
      );
    }

    const user: User = {
      id: sessionUser.id,
      email: sessionUser.email || "",
      role: finalRole,
    };
    authState.user.set(user);
    console.log("[auth] auth.user set (refresh)", user);
    await saveUserSession(user);
    return user;
  } catch (e) {
    console.log("[auth] refreshRoleFromCloud error", e);
    return authState.user.get();
  }
}
