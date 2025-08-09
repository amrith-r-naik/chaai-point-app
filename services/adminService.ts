import { db } from "@/lib/db";
import { createCustomer } from "./customerService";
import { menuService } from "./menuService";

class AdminService {
  // Clear all data from all tables (PRESERVES USERS TABLE)
  async clearAllTables(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Temporarily disable foreign key constraints
      await db.runAsync(`PRAGMA foreign_keys = OFF`);

      // Clear all tables in order (respecting foreign key constraints)
      // NOTE: Users table is preserved to maintain authentication
  // 1. Child rows of kot_orders
  await db.runAsync(`DELETE FROM kot_items`);
  // 2. Rows referencing bills (payments) before deleting bills
  await db.runAsync(`DELETE FROM payments`);
  // 3. KOT orders BEFORE bills to satisfy restrict trigger (kot_orders -> bills)
  await db.runAsync(`DELETE FROM kot_orders`);
  // 4. Now safe to delete bills
  await db.runAsync(`DELETE FROM bills`);
  // 5. Independent tables
  await db.runAsync(`DELETE FROM receipts`);
      await db.runAsync(`DELETE FROM expenses`);
      await db.runAsync(`DELETE FROM menu_items`);
      await db.runAsync(`DELETE FROM customers`);
      // Clear sequence and eod run data
      await db.runAsync(`DELETE FROM sequences`);
      await db.runAsync(`DELETE FROM eod_runs`);

      // Re-enable foreign key constraints
      await db.runAsync(`PRAGMA foreign_keys = ON`);

      console.log("All data tables cleared successfully (users preserved)");
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
      "expenses",
      "menu_items",
      "customers",
      "sequences",
      "eod_runs",
      // "users", // Users table is protected and not allowed to be cleared individually
    ];

    if (!allowedTables.includes(tableName)) {
      throw new Error(`Table ${tableName} is not allowed to be cleared`);
    }

    try {
      // Temporarily disable foreign key constraints for individual table clearing
      await db.runAsync(`PRAGMA foreign_keys = OFF`);
      if (tableName === 'bills') {
        // Ensure no kot_orders reference bills to satisfy restrict trigger
        const ref = await db.getFirstAsync(`SELECT 1 as x FROM kot_orders WHERE billId IS NOT NULL LIMIT 1`) as any;
        if (ref) {
          throw new Error('Cannot clear bills while kot_orders still reference them. Clear kot_orders first (or clearAllTables).');
        }
      }
      if (tableName === 'customers') {
        // Quick safety: ensure no child refs (dev convenience). Not strictly needed; restrict triggers will catch.
        const ref = await db.getFirstAsync(`SELECT 1 as x FROM kot_orders LIMIT 1`) as any;
        if (ref) {
          throw new Error('Cannot clear customers while related transactional data exists. Use clearAllTables instead.');
        }
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
        "expenses",
        "bills",
        "receipts",
        "payments",
        "sequences",
        "eod_runs",
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
