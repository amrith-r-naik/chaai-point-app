import { db } from "@/lib/db";
import { menuService } from "./menuService";

class AdminService {
  // Clear all data from all tables
  async clearAllTables(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Clear all tables in order (respecting foreign key constraints)
      await db.runAsync(`DELETE FROM kot_items`);
      await db.runAsync(`DELETE FROM kot_orders`);
      await db.runAsync(`DELETE FROM menu_items`);
      await db.runAsync(`DELETE FROM customers`);
      await db.runAsync(`DELETE FROM users`);

      console.log("All tables cleared successfully");
    } catch (error) {
      console.error("Error clearing all tables:", error);
      throw error;
    }
  }

  // Clear specific table
  async clearTable(tableName: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    const allowedTables = [
      "kot_items",
      "kot_orders",
      "menu_items",
      "customers",
      "users",
    ];

    if (!allowedTables.includes(tableName)) {
      throw new Error(`Table ${tableName} is not allowed to be cleared`);
    }

    try {
      await db.runAsync(`DELETE FROM ${tableName}`);
      console.log(`Table ${tableName} cleared successfully`);
    } catch (error) {
      console.error(`Error clearing table ${tableName}:`, error);
      throw error;
    }
  }

  // Get table row counts
  async getTableCounts(): Promise<Record<string, number>> {
    if (!db) throw new Error("Database not initialized");

    try {
      const tables = [
        "users",
        "customers",
        "menu_items",
        "kot_orders",
        "kot_items",
      ];
      const counts: Record<string, number> = {};

      for (const table of tables) {
        const result = (await db.getFirstAsync(
          `SELECT COUNT(*) as count FROM ${table}`
        )) as { count: number };
        counts[table] = result.count || 0;
      }

      return counts;
    } catch (error) {
      console.error("Error getting table counts:", error);
      throw error;
    }
  }

  // Setup demo data
  async setupDemoData(): Promise<void> {
    try {
      // Clear existing data first
      await this.clearAllTables();

      // Add demo menu items
      await menuService.addDemoMenuItems();

      console.log("Demo data setup completed");
    } catch (error) {
      console.error("Error setting up demo data:", error);
      throw error;
    }
  }

  // Reset database to initial state
  async resetDatabase(): Promise<void> {
    try {
      await this.clearAllTables();
      console.log("Database reset completed");
    } catch (error) {
      console.error("Error resetting database:", error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
