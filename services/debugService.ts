// services/debugService.ts
import { db } from "@/lib/db";

interface TableRow {
  name: string;
}

interface CountResult {
  count: number;
}

export const debugService = {
  async getTableInfo() {
    if (!db) {
      throw new Error("Database not initialized");
    }

    try {
      // Get all table names
      const tables = await db.getAllAsync(`
        SELECT name FROM sqlite_master WHERE type='table'
      `) as TableRow[];
      console.log("Tables:", tables);

      // Get row counts for each table
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const result = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${table.name}`) as CountResult;
        counts[table.name] = result?.count || 0;
      }

      return { tables, counts };
    } catch (error) {
      console.error("Debug service error:", error);
      throw error;
    }
  },

  async getSampleData() {
    if (!db) {
      throw new Error("Database not initialized");
    }

    try {
      // Get sample customers
      const customers = await db.getAllAsync(`
        SELECT * FROM customers LIMIT 5
      `);

      // Get sample orders
      const orders = await db.getAllAsync(`
        SELECT * FROM kot_orders LIMIT 5
      `);

      // Get sample expenses
      const expenses = await db.getAllAsync(`
        SELECT * FROM expenses LIMIT 5
      `);

      return { customers, orders, expenses };
    } catch (error) {
      console.error("Debug service sample data error:", error);
      throw error;
    }
  },

  async checkDataExists() {
    if (!db) {
      throw new Error("Database not initialized");
    }

    try {
      const customerCount = await db.getFirstAsync(`SELECT COUNT(*) as count FROM customers`) as CountResult;
      const orderCount = await db.getFirstAsync(`SELECT COUNT(*) as count FROM kot_orders`) as CountResult;
      const expenseCount = await db.getFirstAsync(`SELECT COUNT(*) as count FROM expenses`) as CountResult;

      return {
        customers: customerCount?.count || 0,
        orders: orderCount?.count || 0,
        expenses: expenseCount?.count || 0
      };
    } catch (error) {
      console.error("Debug service check data error:", error);
      return { customers: 0, orders: 0, expenses: 0 };
    }
  }
};
