// lib/db.ts
import * as SQLite from "expo-sqlite";

export let db: SQLite.SQLiteDatabase | null = null;

export async function openDatabase() {
  db = await SQLite.openDatabaseAsync("chaai-point.db");
  await initializeSchema();
  return db;
}

async function initializeSchema() {
  if (!db) {
    console.error("Database is not initialized");
    return;
  }

  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT UNIQUE,
      createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  creditBalance INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      price INTEGER NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kot_orders (
      id TEXT PRIMARY KEY,
      kotNumber INTEGER NOT NULL,
      customerId TEXT NOT NULL,
      billId TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id),
      FOREIGN KEY (billId) REFERENCES bills(id)
    );

    CREATE TABLE IF NOT EXISTS kot_items (
      id TEXT PRIMARY KEY,
      kotId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      priceAtTime INTEGER NOT NULL,
      FOREIGN KEY (kotId) REFERENCES kot_orders(id),
      FOREIGN KEY (itemId) REFERENCES menu_items(id)
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      billNumber INTEGER NOT NULL,
      customerId TEXT NOT NULL,
      total INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      billId TEXT,
      customerId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('Cash', 'UPI', 'Credit', 'CreditClear', 'Split')),
      remarks TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (billId) REFERENCES bills(id),
      FOREIGN KEY (customerId) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      receiptNo INTEGER NOT NULL,
      customerId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('Cash', 'UPI', 'Credit', 'Split')),
      remarks TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      voucherNo INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      towards TEXT NOT NULL,
      mode TEXT NOT NULL,
      remarks TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS split_payments (
      id TEXT PRIMARY KEY,
      receiptId TEXT NOT NULL,
      paymentType TEXT NOT NULL,
      amount INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (receiptId) REFERENCES receipts(id)
    );
  `);
}

// Helper to run a set of DB operations inside a transaction safely.
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!db) throw new Error("Database not initialized");
  await db.execAsync("BEGIN TRANSACTION");
  try {
    const result = await fn();
    await db.execAsync("COMMIT");
    return result;
  } catch (err) {
    await db.execAsync("ROLLBACK");
    throw err;
  }
}
