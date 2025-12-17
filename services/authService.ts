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
    // sign-in successful

    // Fetch remote role once and reconcile with local
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .maybeSingle();
    // ignore profile errors; fallback to metadata/local
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
    // resolved role
    // Persist local snapshot
    if (db) {
      const now = new Date().toISOString();
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
    await saveUserSession(user);
    return user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    // Sign out from Supabase first (clears server-side session)
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // Ignore Supabase signout errors (might be offline)
        console.warn(
          "Supabase signOut failed (continuing with local logout):",
          e
        );
      }
    }
    // Then clear local session
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
        // session found
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
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sessionUser.id)
            .maybeSingle();
          // ignore profile errors during init
          if (profile?.role) {
            localRole = String(profile.role);
            if (db) {
              const now = new Date().toISOString();
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
        // resolved role during init
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
        await saveUserSession(user);
        authState.isInitialized.set(true);
        return user;
      }
    }
    // Fall back to persisted session (AsyncStorage)
    const user = await loadUserSession();
    if (user) {
      authState.user.set(user);
    }
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

// dev logs removed for production

/**
 * Validates the Supabase session in the background (non-blocking).
 * Called after cached session is loaded to verify it's still valid
 * and sync any role changes from the server.
 *
 * NOTE: Since Supabase client is not configured with AsyncStorage,
 * getSession() will return null on app restart. We only clear the
 * cached user if Supabase explicitly tells us the session is invalid
 * (e.g., via an auth error), not just because getSession returns null.
 */
export async function validateSessionInBackground(): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      // Only clear if Supabase explicitly says session is invalid
      if (
        error.message?.includes("invalid") ||
        error.message?.includes("expired")
      ) {
        console.log("Supabase session invalid, clearing cached user");
        await clearUserSession();
        authState.user.set(null);
      } else {
        console.warn("Background session validation error:", error.message);
      }
      return; // Keep using cached session on other errors
    }

    const sessionUser = data.session?.user;
    const cachedUser = authState.user.get();

    // If no Supabase session but we have cached user, keep using cached user
    // This is expected on app restart since Supabase isn't configured with storage
    if (!sessionUser) {
      // Don't clear - Supabase just doesn't have the session in memory
      // The cached user from AsyncStorage is our source of truth
      return;
    }

    // Session valid - check if we need to update anything
    if (!cachedUser) {
      // No cached user but valid Supabase session - restore from Supabase
      await initializeAuth();
      return;
    }

    // Check for role updates from server metadata
    const metaRole = sessionUser.user_metadata?.role as string | undefined;
    if (
      metaRole &&
      String(metaRole).toLowerCase().trim() !==
        String(cachedUser.role).toLowerCase().trim()
    ) {
      // Role changed on server - update local
      const newRole = String(metaRole).toLowerCase().trim();
      console.log(`Role updated: ${cachedUser.role} → ${newRole}`);

      if (db) {
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT OR REPLACE INTO users (id, email, password, role, createdAt) VALUES (?,?,?,?,?)`,
          [cachedUser.id, cachedUser.email, "", newRole, now]
        );
      }

      const updatedUser: User = { ...cachedUser, role: newRole };
      authState.user.set(updatedUser);
      await saveUserSession(updatedUser);
    }
  } catch (error) {
    // Network errors - silently fail and keep using cached session (offline-first)
    console.warn("Background session check failed:", error);
  }
}
