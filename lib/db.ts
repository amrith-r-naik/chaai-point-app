// lib/db.ts
import * as SQLite from "expo-sqlite";

export let db: SQLite.SQLiteDatabase | null = null;
let openDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function openDatabase() {
  if (db) return db;
  if (openDbPromise) return openDbPromise;
  openDbPromise = (async () => {
    db = await SQLite.openDatabaseAsync("chaai-point.db");
    // Initialize schema with a short retry for transient locks (e.g. hot reload)
    let attempts = 0;
    while (true) {
      try {
        await initializeSchema();
        break;
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("locked") && attempts < 3) {
          attempts++;
          await new Promise((r) => setTimeout(r, 250 * attempts));
          continue;
        }
        throw err;
      }
    }
    return db!;
  })();
  return openDbPromise;
}

async function initializeSchema() {
  if (!db) {
    console.error("Database is not initialized");
    return;
  }

  // Apply PRAGMAs first to configure the connection
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(`PRAGMA busy_timeout = 5000;`);
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA synchronous = NORMAL;`);

  // Create/upgrade schema within an IMMEDIATE transaction
  await db.execAsync("BEGIN IMMEDIATE TRANSACTION");
  try {
    await db.execAsync(`
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
        mode TEXT NOT NULL,
        subType TEXT,
        remarks TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (billId) REFERENCES bills(id),
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receiptNo INTEGER NOT NULL,
        customerId TEXT NOT NULL,
        billId TEXT,
        amount INTEGER NOT NULL,
        mode TEXT NOT NULL,
        remarks TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id),
        FOREIGN KEY (billId) REFERENCES bills(id)
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

      -- Indices for performance (idempotent)
      CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customerId);
      CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(billId);
      CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customerId);
      CREATE INDEX IF NOT EXISTS idx_bills_createdAt ON bills(createdAt);
      CREATE INDEX IF NOT EXISTS idx_payments_createdAt ON payments(createdAt);
      CREATE INDEX IF NOT EXISTS idx_receipts_bill ON receipts(billId);
    `);
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}

// Integrity audit: verify bill totals and customer credit consistency
export async function runIntegrityAudit() {
  if (!db) throw new Error('Database not initialized');
  const billIssues: any[] = [];
  const bills = await db.getAllAsync(`SELECT id,total FROM bills`);
  for (const b of bills as any[]) {
    const payments = await db.getAllAsync(`SELECT amount, mode FROM payments WHERE billId = ?`, [b.id]) as any[];
    let paid = 0, credit = 0;
    payments.forEach(p=>{ if (p.mode==='Credit') credit+=p.amount; else paid+=p.amount; });
    if (paid + credit !== b.total) {
      billIssues.push({ billId: b.id, stored: b.total, recomputed: paid+credit, paid, credit });
    }
  }
  // Customer credit reconciliation
  const creditIssues: any[] = [];
  const customers = await db.getAllAsync(`SELECT id, creditBalance FROM customers`);
  for (const c of customers as any[]) {
    const accrual = await db.getFirstAsync(`SELECT COALESCE(SUM(amount),0) as sum FROM payments WHERE customerId=? AND subType='Accrual'`, [c.id]) as any;
    const clearance = await db.getFirstAsync(`SELECT COALESCE(SUM(amount),0) as sum FROM payments WHERE customerId=? AND subType='Clearance'`, [c.id]) as any;
    const expected = (accrual.sum||0) - (clearance.sum||0);
    if (expected !== c.creditBalance) {
      creditIssues.push({ customerId: c.id, stored: c.creditBalance, expected });
    }
  }
  return { billIssues, creditIssues };
}

// Helper to run a set of DB operations inside a transaction safely.
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!db) throw new Error("Database not initialized");
  let attempts = 0;
  // Retry BEGIN IMMEDIATE on SQLITE_BUSY a few times with backoff
  // to mitigate rare contention on low-end devices or hot reload.
  while (true) {
    try {
      await db.execAsync("BEGIN IMMEDIATE TRANSACTION");
      try {
        const result = await fn();
        await db.execAsync("COMMIT");
        return result;
      } catch (err) {
        await db.execAsync("ROLLBACK");
        throw err;
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("locked") && attempts < 3) {
        attempts++;
        await new Promise((r) => setTimeout(r, 150 * attempts));
        continue;
      }
      throw e;
    }
  }
}
