// services/testService.ts
import { db } from '@/lib/db';

export const testService = {
  async createSampleData() {
    if (!db) throw new Error("Database not initialized");

    try {
      console.log('Creating sample data for testing...');
      
      // Insert sample customer
      const customerId = 'test-customer-1';
      await db.runAsync(`
        INSERT OR REPLACE INTO customers (id, name, contact, createdAt, updatedAt, creditBalance)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [customerId, 'Test Customer', '9876543210', new Date().toISOString(), new Date().toISOString(), 0]);
      
      // Insert sample expense
      await db.runAsync(`
        INSERT OR REPLACE INTO expenses (id, voucherNo, amount, towards, mode, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test-expense-1', 1, 500, 'Tea Supplies', 'Cash', 'Monthly supplies', new Date().toISOString()]);
      
      // Insert sample menu item
      const menuItemId = 'test-menu-1';
      await db.runAsync(`
        INSERT OR REPLACE INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [menuItemId, 'Test Tea', 'Tea', 20, 1, new Date().toISOString(), new Date().toISOString()]);
      
      // Insert sample KOT order
      const kotId = 'test-kot-1';
      await db.runAsync(`
        INSERT OR REPLACE INTO kot_orders (id, kotNumber, customerId, createdAt)
        VALUES (?, ?, ?, ?)
      `, [kotId, 1, customerId, new Date().toISOString()]);
      
      // Insert sample KOT item
      await db.runAsync(`
        INSERT OR REPLACE INTO kot_items (id, kotId, itemId, quantity, priceAtTime)
        VALUES (?, ?, ?, ?, ?)
      `, ['test-kot-item-1', kotId, menuItemId, 2, 20]);
      
      console.log('Sample data created successfully');
      
      // Verify the data
      const customers = await db.getAllAsync('SELECT * FROM customers');
      const expenses = await db.getAllAsync('SELECT * FROM expenses');
      const orders = await db.getAllAsync('SELECT * FROM kot_orders');
      
      console.log('Created customers:', customers.length);
      console.log('Created expenses:', expenses.length);
      console.log('Created orders:', orders.length);
      
      return { customers: customers.length, expenses: expenses.length, orders: orders.length };
    } catch (error) {
      console.error('Error creating sample data:', error);
      throw error;
    }
  },

  async clearAllData() {
    if (!db) throw new Error("Database not initialized");

    try {
      console.log('Clearing all data...');
      
      await db.runAsync('DELETE FROM kot_items');
      await db.runAsync('DELETE FROM kot_orders');
      await db.runAsync('DELETE FROM expenses');
      await db.runAsync('DELETE FROM customers');
      await db.runAsync('DELETE FROM menu_items');
      
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
};
