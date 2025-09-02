import { db } from "@/lib/db";

class SettingsService {
  private ensure() {
    if (!db) throw new Error("Database not initialized");
  }

  async get(key: string): Promise<string | null> {
    this.ensure();
    const row = (await db!.getFirstAsync(
      `SELECT value FROM app_settings WHERE key = ?`,
      [key]
    )) as { value?: string } | null;
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.ensure();
    const now = new Date().toISOString();
    await db!.runAsync(
      `INSERT INTO app_settings (key, value, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt`,
      [key, value, now]
    );
  }

  async getBool(key: string, defaultVal = false): Promise<boolean> {
    const v = await this.get(key);
    if (v === null || v === undefined) return defaultVal;
    return v === "true" || v === "1";
  }

  async setBool(key: string, value: boolean): Promise<void> {
    await this.set(key, value ? "true" : "false");
  }
}

export const settingsService = new SettingsService();
export default settingsService;
