import { db } from "@/lib/db";
import { createCustomer } from "./customerService";
import { menuService } from "./menuService";

class AdminService {
  // Clear all data from all tables
  async clearAllTables(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Clear all tables in order (respecting foreign key constraints)
      await db.runAsync(`DELETE FROM kot_items`);
      await db.runAsync(`DELETE FROM payments`);
      await db.runAsync(`DELETE FROM receipts`);
      await db.runAsync(`DELETE FROM bills`);
      await db.runAsync(`DELETE FROM kot_orders`);
      await db.runAsync(`DELETE FROM expenses`);
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
      "payments", 
      "receipts",
      "bills",
      "kot_orders",
      "expenses",
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
        "expenses",
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
