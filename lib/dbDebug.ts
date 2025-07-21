// lib/dbDebug.ts
import { db } from "./db";

export async function debugDatabase() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    // List all tables
    const allTables = await db.getAllAsync(`
      SELECT name FROM sqlite_master WHERE type='table';
    `);
    console.log(
      "All tables:",
      allTables.map((t) => (t as any).name)
    );
  } catch (error) {
    console.error("Debug error:", error);
  }
}

export async function recreateDatabase() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    // Drop all tables first
    await db.execAsync(`
      DROP TABLE IF EXISTS receipts;
      DROP TABLE IF EXISTS expenses;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS bills;
      DROP TABLE IF EXISTS kot_items;
      DROP TABLE IF EXISTS kot_orders;
      DROP TABLE IF EXISTS menu_items;
      DROP TABLE IF EXISTS customers;
      DROP TABLE IF EXISTS users;
    `);

    console.log("All tables dropped");

    // Recreate schema
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact TEXT UNIQUE,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        price INTEGER NOT NULL,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE kot_orders (
        id TEXT PRIMARY KEY,
        kotNumber INTEGER NOT NULL,
        customerId TEXT NOT NULL,
        billId TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id),
        FOREIGN KEY (billId) REFERENCES bills(id)
      );

      CREATE TABLE kot_items (
        id TEXT PRIMARY KEY,
        kotId TEXT NOT NULL,
        itemId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        priceAtTime INTEGER NOT NULL,
        FOREIGN KEY (kotId) REFERENCES kot_orders(id),
        FOREIGN KEY (itemId) REFERENCES menu_items(id)
      );

      CREATE TABLE bills (
        id TEXT PRIMARY KEY,
        billNumber INTEGER NOT NULL,
        customerId TEXT NOT NULL,
        total INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );

      CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        billId TEXT,
        customerId TEXT NOT NULL,
        amount INTEGER NOT NULL,
        mode TEXT NOT NULL,
        remarks TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (billId) REFERENCES bills(id),
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );

      CREATE TABLE receipts (
        id TEXT PRIMARY KEY,
        receiptNo INTEGER NOT NULL,
        customerId TEXT NOT NULL,
        amount INTEGER NOT NULL,
        mode TEXT NOT NULL,
        remarks TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );

      CREATE TABLE expenses (
        id TEXT PRIMARY KEY,
        voucherNo INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        towards TEXT NOT NULL,
        mode TEXT NOT NULL,
        remarks TEXT,
        createdAt TEXT NOT NULL
      );
    `);

    console.log("Database schema recreated successfully");
  } catch (error) {
    console.error("Recreation error:", error);
  }
}

export async function seedTestUser() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    const testUserId = "test-user-1";
    const currentTime = new Date().toISOString();

    await db.runAsync(
      `
      INSERT OR REPLACE INTO users (id, email, password, role, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
      [testUserId, "admin@chaaipoint.com", "password123", "admin", currentTime]
    );

    console.log("Test user created successfully");
    console.log("Email: admin@chaaipoint.com");
    console.log("Password: password123");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
