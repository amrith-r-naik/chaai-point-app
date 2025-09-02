import { db } from "@/lib/db";
import { createCustomer } from "./customerService";
import { menuService } from "./menuService";

class AdminService {
  // Helper: check if a table exists in the current SQLite database
  private async tableExists(table: string): Promise<boolean> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [table]
    )) as { name?: string } | null;
    return !!row?.name;
  }

  // Helper: delete from table if it exists
  private async deleteFromIfExists(table: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    const exists = await this.tableExists(table);
    if (exists) {
      await db.runAsync(`DELETE FROM ${table}`);
    } else {
      console.log(`[admin] skip delete, table missing: ${table}`);
    }
  }
  // Clear all business data while preserving users and menu items
  async clearAllTables(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Temporarily disable foreign key constraints
      await db.runAsync(`PRAGMA foreign_keys = OFF`);

      // Clear all tables in correct order to respect foreign key constraints
      // NOTE: Users and menu_items are preserved
      await this.deleteFromIfExists(`kot_items`);
      await this.deleteFromIfExists(`split_payments`);
      await this.deleteFromIfExists(`payments`);
      await this.deleteFromIfExists(`receipts`);
      await this.deleteFromIfExists(`kot_orders`);
      await this.deleteFromIfExists(`bills`);
      await this.deleteFromIfExists(`customer_advances`);
      // Clear expense_settlements BEFORE expenses when FKs are off to avoid orphans
      await this.deleteFromIfExists(`expense_settlements`);
      await this.deleteFromIfExists(`expenses`);
      // Preserve product catalog
      // await db.runAsync(`DELETE FROM menu_items`);
      await this.deleteFromIfExists(`customers`);
      await this.deleteFromIfExists(`app_settings`);
      // Reset local counters so numbering restarts from maxima (now 0 after clears)
      await this.deleteFromIfExists(`local_counters`);
      // Also clear sync checkpoints so next sync re-pulls everything
      await this.deleteFromIfExists(`sync_state`);

      // Re-enable foreign key constraints
      await db.runAsync(`PRAGMA foreign_keys = ON`);

      console.log(
        "All business data cleared (users and menu items preserved). Counters reset and sync_state cleared."
      );
    } catch (error) {
      // Make sure to re-enable foreign keys even if there's an error
      try {
        await db.runAsync(`PRAGMA foreign_keys = ON`);
      } catch (pragmaError) {
        console.error("Error re-enabling foreign keys:", pragmaError);
      }
      console.error("Error clearing data tables:", error);
      throw error;
    }
  }

  // Clear specific table
  async clearTable(tableName: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    const allowedTables = [
      "kot_items",
      "payments",
      "receipts",
      "bills",
      "kot_orders",
      "split_payments",
      "expense_settlements",
      "expenses",
      "menu_items",
      "customers",
      "customer_advances",
      "app_settings",
      "sync_state",
      "local_counters",
      // "users", // Users table is protected and not allowed to be cleared individually
    ];

    if (!allowedTables.includes(tableName)) {
      throw new Error(`Table ${tableName} is not allowed to be cleared`);
    }

    try {
      // Temporarily disable foreign key constraints for individual table clearing
      await db.runAsync(`PRAGMA foreign_keys = OFF`);
      const exists = await this.tableExists(tableName);
      if (!exists) {
        console.log(`[admin] table not found, skipping clear: ${tableName}`);
        await db.runAsync(`PRAGMA foreign_keys = ON`);
        return;
      }
      await db.runAsync(`DELETE FROM ${tableName}`);
      await db.runAsync(`PRAGMA foreign_keys = ON`);

      console.log(`Table ${tableName} cleared successfully`);
    } catch (error) {
      // Make sure to re-enable foreign keys even if there's an error
      try {
        await db.runAsync(`PRAGMA foreign_keys = ON`);
      } catch (pragmaError) {
        console.error("Error re-enabling foreign keys:", pragmaError);
      }
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
        "bills",
        "payments",
        "receipts",
        "split_payments",
        "expenses",
        "expense_settlements",
        "customer_advances",
        "app_settings",
        "sync_state",
        "local_counters",
      ];
      const counts: Record<string, number> = {};

      for (const table of tables) {
        const exists = await this.tableExists(table);
        if (!exists) {
          counts[table] = 0;
          continue;
        }
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
      // Clear existing data first (preserves users)
      await this.clearAllTables();

      // Add demo menu items
      await menuService.addDemoMenuItems();

      // Add demo customers
      await this.addDemoCustomers();

      console.log("Demo data setup completed");
    } catch (error) {
      console.error("Error setting up demo data:", error);
      throw error;
    }
  }

  // Add demo customers
  async addDemoCustomers(): Promise<void> {
    try {
      const demoCustomers = [
        { name: "Walk-in Customer", contact: undefined },
        { name: "John Doe", contact: "9876543210" },
        { name: "Jane Smith", contact: "9876543211" },
        { name: "Rajesh Kumar", contact: "9876543212" },
        { name: "Priya Sharma", contact: "9876543213" },
        { name: "Corporate Office", contact: "9876543214" },
      ];

      for (const customer of demoCustomers) {
        await createCustomer(customer.name, customer.contact);
      }

      console.log("Demo customers added successfully");
    } catch (error) {
      console.error("Error adding demo customers:", error);
      throw error;
    }
  }

  // Reset database to initial state (preserves users)
  async resetDatabase(): Promise<void> {
    try {
      await this.clearAllTables();
      console.log("Database reset completed (users preserved)");
    } catch (error) {
      console.error("Error resetting database:", error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
