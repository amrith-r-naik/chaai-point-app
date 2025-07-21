import { db } from "@/lib/db";

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

    return res || null;
  } catch (error) {
    console.error("Database query error:", error);
    throw error; // Re-throw to let the calling code handle it
  }
}
