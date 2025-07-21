import { db } from "@/lib/db";
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
    if (!db) {
      throw new Error("Database is not initialized");
    }

    const res = (await db.getFirstAsync(
      `SELECT id, email, role FROM users WHERE email = ? AND password = ?`,
      [email, password]
    )) as User | undefined;

    if (res) {
      // Save user to state and session
      authState.user.set(res);
      await saveUserSession(res);
      return res;
    }

    return null;
  } catch (error) {
    console.error("Database query error:", error);
    throw error; // Re-throw to let the calling code handle it
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
