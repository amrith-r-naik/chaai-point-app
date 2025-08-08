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
      creditBalance INTEGER DEFAULT 0
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
      businessDate TEXT, -- YYYY-MM-DD IST business date
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
      businessDate TEXT,
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
      businessDate TEXT,
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

    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sequences (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eod_runs (
      id TEXT PRIMARY KEY,
      businessDate TEXT NOT NULL,
      runType TEXT NOT NULL, -- manual | auto
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      processedKots INTEGER NOT NULL,
      totalAmount INTEGER NOT NULL,
      success INTEGER NOT NULL,
      errorSummary TEXT
    );
  `);

  // After tables exist, ensure new columns for legacy installations before creating indexes
  await ensureLegacyColumns();

  // Create indexes (guard each in case of legacy missing columns)
  await createBaseIndexes();

  await runMigrations();
}

async function columnExists(table: string, column: string): Promise<boolean> {
  if (!db) return false;
  const info = await db.getAllAsync(`PRAGMA table_info(${table})`);
  return (info as any[]).some(r => r.name === column);
}

async function ensureLegacyColumns() {
  if (!db) return;
  // businessDate columns might be missing on older installs
  const targets: Array<[string, string]> = [
    ['kot_orders', 'businessDate'],
    ['bills', 'businessDate'],
    ['receipts', 'businessDate']
  ];
  for (const [table, col] of targets) {
    if (!(await columnExists(table, col))) {
      try {
        await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
        console.log(`[schema] Added missing column ${col} on ${table}`);
      } catch (e) {
        console.warn(`[schema] Could not add column ${col} on ${table}:`, e);
      }
    }
  }
}

async function createIndexSafe(sql: string) {
  if (!db) return;
  try {
    await db.runAsync(sql);
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.includes('no such column')) {
      console.warn('[indexes] Skipping index due to missing column:', sql);
    } else {
      console.warn('[indexes] Failed creating index:', sql, e);
    }
  }
}

async function createBaseIndexes() {
  // These indexes existed previously inside the big exec; we now add them conditionally.
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_kot_orders_businessDate ON kot_orders(businessDate)`);
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_bills_businessDate ON bills(businessDate)`);
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_receipts_businessDate ON receipts(businessDate)`);
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_kot_orders_customer ON kot_orders(customerId, createdAt)`);
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_kot_items_kot ON kot_items(kotId)`);
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(billId)`);
  await createIndexSafe(`CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customerId, createdAt)`);
}

async function runMigrations() {
  if (!db) return;
  // Helper to ensure a column exists (for users upgrading from older schema versions)
  async function ensureColumn(table: string, column: string, definition: string) {
    if (!db) return;
    try {
      const info = await db.getAllAsync(`PRAGMA table_info(${table})`);
      const exists = (info as any[]).some(r => r.name === column);
      if (!exists) {
        console.log(`[migrations] Adding missing column ${column} to ${table}`);
        await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    } catch (e) {
      console.warn(`[migrations] Failed ensuring column ${column} on ${table}:`, e);
    }
  }

  // Ensure new columns required by newer code exist before running data migrations
  await ensureColumn('kot_orders', 'businessDate', 'TEXT');
  await ensureColumn('bills', 'businessDate', 'TEXT');
  await ensureColumn('receipts', 'businessDate', 'TEXT');

  const applied = await db.getAllAsync(`SELECT id FROM migrations`);
  const appliedSet = new Set(applied.map(r => (r as any).id));

  // Migration: backfill businessDate where null using createdAt (IST derivation) & ensure kot daily reset sequences base
  const MIGRATION_ID = '20250808_business_date_backfill_sequences';
  if (!appliedSet.has(MIGRATION_ID)) {
    try {
      // Backfill businessDate columns (after ensuring column exists)
      const rows = await db.getAllAsync(`SELECT id, createdAt FROM kot_orders WHERE businessDate IS NULL`);
      for (const row of rows as any[]) {
        const bd = computeISTBusinessDate(row.createdAt);
        await db.runAsync(`UPDATE kot_orders SET businessDate = ? WHERE id = ?`, [bd, row.id]);
      }
      const billRows = await db.getAllAsync(`SELECT id, createdAt FROM bills WHERE businessDate IS NULL`);
      for (const row of billRows as any[]) {
        const bd = computeISTBusinessDate(row.createdAt);
        await db.runAsync(`UPDATE bills SET businessDate = ? WHERE id = ?`, [bd, row.id]);
      }
      const receiptRows = await db.getAllAsync(`SELECT id, createdAt FROM receipts WHERE businessDate IS NULL`);
      for (const row of receiptRows as any[]) {
        const bd = computeISTBusinessDate(row.createdAt);
        await db.runAsync(`UPDATE receipts SET businessDate = ? WHERE id = ?`, [bd, row.id]);
      }
      // Record migration
      await db.runAsync(`INSERT INTO migrations (id, appliedAt) VALUES (?, ?)`, [MIGRATION_ID, new Date().toISOString()]);
    } catch (err) {
      console.error('Backfill migration failed (businessDate):', err);
      // Do not throw to avoid blocking app start; future restart can retry
    }
  }

  // Migration: Phase 2 Schema Hardening - Unique constraints and additional indexes
  const PHASE2_MIGRATION_ID = '20250808_phase2_schema_hardening';
  if (!appliedSet.has(PHASE2_MIGRATION_ID)) {
    console.log('Running Phase 2 Schema Hardening migration...');
    
    try {
      // Add unique constraints for important business identifiers
      // Note: SQLite doesn't support adding UNIQUE constraints to existing tables easily
      // We'll create unique indexes instead which provide the same functionality
      
      // Unique constraints via indexes
      await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_kot_orders_kotNumber_businessDate 
                        ON kot_orders(kotNumber, businessDate)`);
      
      await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_billNumber 
                        ON bills(billNumber)`);
      
      await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_receiptNo 
                        ON receipts(receiptNo)`);
      
      await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_voucherNo 
                        ON expenses(voucherNo)`);
      
      // Additional performance indexes for common query patterns
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_kot_orders_billId 
                        ON kot_orders(billId) WHERE billId IS NOT NULL`);
      
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_payments_customer_date 
                        ON payments(customerId, createdAt)`);
      
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_bills_customer_businessDate 
                        ON bills(customerId, businessDate)`);
      
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_menu_items_active 
                        ON menu_items(isActive, category)`);
      
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_eod_runs_businessDate_success 
                        ON eod_runs(businessDate, success)`);
      
      // Additional composite indexes for analytics queries
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_kot_orders_customer_businessDate 
                        ON kot_orders(customerId, businessDate, billId)`);
      
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_receipts_mode_businessDate 
                        ON receipts(mode, businessDate)`);
      
      console.log('Phase 2 Schema Hardening: Added unique constraints and performance indexes');
      
      // Record migration
      await db.runAsync(`INSERT INTO migrations (id, appliedAt) VALUES (?, ?)`, 
                       [PHASE2_MIGRATION_ID, new Date().toISOString()]);
      
      console.log('Phase 2 Schema Hardening migration completed successfully');
    } catch (error) {
      console.error('Phase 2 Schema Hardening migration failed:', error);
      throw error;
    }
  }
}

export function computeISTBusinessDate(iso: string): string {
  const d = new Date(iso);
  const istMs = d.getTime() + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  return ist.toISOString().split('T')[0];
}
