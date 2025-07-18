// lib/db.ts
import * as SQLite from "expo-sqlite";

export let db: SQLite.SQLiteDatabase | null = null;

export async function openDatabase() {
  db = await SQLite.openDatabaseAsync("chaai-point.db");
  await initializeSchema();
  return db;
}

async function initializeSchema() {
  if (!db) return;

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
      updatedAt TEXT NOT NULL
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
      mode TEXT NOT NULL,
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
      mode TEXT NOT NULL,
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
  `);
}
