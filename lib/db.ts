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
        await runMigrations();
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

  // Create base schema (idempotent) within an IMMEDIATE transaction
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
  createdAt TEXT NOT NULL,
  expenseDate TEXT NOT NULL
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

// --- Phase 1: Migration harness + sync-ready metadata ---
async function runMigrations() {
  if (!db) throw new Error("Database not initialized");

  const getUserVersion = async (): Promise<number> => {
    const row: any = await db!.getFirstAsync("PRAGMA user_version");
    // Row can be { user_version: 0 } or { 'user_version': 0 }
    const val = row?.user_version ?? row?.USER_VERSION ?? 0;
    return Number(val) || 0;
  };

  const setUserVersion = async (v: number) => {
    await db!.execAsync(`PRAGMA user_version = ${v}`);
  };

  const columnExists = async (table: string, column: string) => {
    const cols = (await db!.getAllAsync(
      `PRAGMA table_info(${table})`
    )) as any[];
    return cols.some((c) => c.name === column);
  };

  const addColumnIfMissing = async (
    table: string,
    column: string,
    type: string,
    defaultSql?: string
  ) => {
    const exists = await columnExists(table, column);
    if (!exists) {
      const def = defaultSql ? ` ${defaultSql}` : "";
      await db!.execAsync(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${type}${def};`
      );
    }
  };

  const backfillIfNull = async (
    table: string,
    column: string,
    exprSql: string
  ) => {
    await db!.execAsync(
      `UPDATE ${table} SET ${column} = (${exprSql}) WHERE ${column} IS NULL;`
    );
  };

  // Run migrations in transaction per version to avoid partial state
  let v = await getUserVersion();

  // v0 -> v1: establish baseline (no structural changes; ensure user_version set)
  if (v < 1) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      // Nothing to change; base schema already created idempotently
      await setUserVersion(1);
      await db!.execAsync("COMMIT");
      v = 1;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }

  // v1 -> v2: create sync_state table for tracking per-table sync checkpoints
  if (v < 2) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      await db!.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_state (
          tableName TEXT PRIMARY KEY,
          lastPushAt TEXT,
          lastPullAt TEXT
        );
      `);
      await setUserVersion(2);
      await db!.execAsync("COMMIT");
      v = 2;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }

  // vX -> vY: add expenseDate to expenses and backfill
  if (v < 8) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      await addColumnIfMissing("expenses", "expenseDate", "TEXT");
      // Backfill: set expenseDate = date part of createdAt for existing rows
      await backfillIfNull(
        "expenses",
        "expenseDate",
        "substr(createdAt, 1, 10)"
      );
      await setUserVersion(8);
      await db!.execAsync("COMMIT");
      v = 8;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }
  if (v < 3) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      const businessTables = [
        "customers",
        "menu_items",
        "kot_orders",
        "kot_items",
        "bills",
        "payments",
        "receipts",
        "expenses",
        "split_payments",
      ];

      for (const t of businessTables) {
        // shopId and deletedAt (nullable)
        await addColumnIfMissing(t, "shopId", "TEXT");
        await addColumnIfMissing(t, "deletedAt", "TEXT");
        // updatedAt (nullable; will be backfilled)
        await addColumnIfMissing(t, "updatedAt", "TEXT");
        // Index for pull queries
        await db!.execAsync(
          `CREATE INDEX IF NOT EXISTS idx_${t}_shop_updated ON ${t}(shopId, updatedAt);`
        );
        // Triggers: set updatedAt on INSERT and bump on UPDATE
        await db!.execAsync(`
          CREATE TRIGGER IF NOT EXISTS trg_${t}_updatedAt_insert
          AFTER INSERT ON ${t}
          FOR EACH ROW
          BEGIN
            UPDATE ${t} SET updatedAt = COALESCE(NEW.updatedAt, DATETIME('now')) WHERE id = NEW.id;
          END;
        `);
        await db!.execAsync(`
          CREATE TRIGGER IF NOT EXISTS trg_${t}_updatedAt
          AFTER UPDATE ON ${t}
          FOR EACH ROW
          BEGIN
            UPDATE ${t}
            SET updatedAt = COALESCE(NEW.updatedAt, DATETIME('now'))
            WHERE id = NEW.id;
          END;
        `);
      }

      // Some tables may be missing createdAt historically
      await addColumnIfMissing("kot_items", "createdAt", "TEXT");

      // Backfill shopId with constant shop_1
      for (const t of businessTables) {
        await db!.execAsync(
          `UPDATE ${t} SET shopId = 'shop_1' WHERE shopId IS NULL;`
        );
      }

      // Backfill updatedAt with createdAt where possible, else current time
      const tablesWithCreated = [
        "customers",
        "menu_items",
        "kot_orders",
        "bills",
        "payments",
        "receipts",
        "expenses",
        "split_payments",
      ];
      for (const t of tablesWithCreated) {
        await backfillIfNull(t, "updatedAt", "createdAt");
      }
      // kot_items: createdAt may be missing - set from parent kot_orders or now
      await backfillIfNull(
        "kot_items",
        "createdAt",
        "COALESCE((SELECT ko.createdAt FROM kot_orders ko WHERE ko.id = kot_items.kotId), DATETIME('now'))"
      );
      await backfillIfNull("kot_items", "updatedAt", "createdAt");

      await setUserVersion(3);
      await db!.execAsync("COMMIT");
      v = 3;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }

  // v3 -> v4: relax billNumber constraints on bills (allow NULL) and drop any UNIQUE index on billNumber
  if (v < 4) {
    // Temporarily disable FK checks for table rebuild
    await db!.execAsync("PRAGMA foreign_keys = OFF;");
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      // Drop any legacy triggers that reference bills (e.g., trg_restrict_delete_customer_bill)
      const billTriggers = (await db!.getAllAsync(
        `SELECT name FROM sqlite_master WHERE type='trigger' AND sql LIKE '%bills%'`
      )) as { name: string }[];
      for (const t of billTriggers || []) {
        try {
          await db!.execAsync(`DROP TRIGGER IF EXISTS ${t.name};`);
        } catch {}
      }
      // 1) Drop any unique indexes on bills that include billNumber
      const idxList = (await db!.getAllAsync(`PRAGMA index_list(bills)`)) as {
        name: string;
        unique: number;
      }[];
      for (const idx of idxList || []) {
        try {
          const cols = (await db!.getAllAsync(
            `PRAGMA index_info(${idx.name})`
          )) as { name: string }[];
          const hasBillNumber = cols?.some((c) => c.name === "billNumber");
          if (idx.unique && hasBillNumber) {
            await db!.execAsync(`DROP INDEX IF EXISTS ${idx.name};`);
          }
        } catch {}
      }

      // 2) Check current NOT NULL status of billNumber
      const cols = (await db!.getAllAsync(`PRAGMA table_info(bills)`)) as any[];
      const billNumberCol = cols.find((c) => c.name === "billNumber");
      const isNotNull = !!billNumberCol && Number(billNumberCol.notnull) === 1;

      if (isNotNull) {
        // Rebuild the bills table making billNumber nullable
        await db!.execAsync(`
          CREATE TABLE IF NOT EXISTS bills_new (
            id TEXT PRIMARY KEY,
            billNumber INTEGER,
            customerId TEXT NOT NULL,
            total INTEGER NOT NULL,
            createdAt TEXT NOT NULL,
            shopId TEXT,
            deletedAt TEXT,
            updatedAt TEXT,
            FOREIGN KEY (customerId) REFERENCES customers(id)
          );
        `);
        // Copy data, converting placeholder 0 to NULL to avoid accidental uniqueness collisions
        await db!.execAsync(`
          INSERT INTO bills_new (id, billNumber, customerId, total, createdAt, shopId, deletedAt, updatedAt)
          SELECT id, NULLIF(billNumber, 0), customerId, total, createdAt, shopId, deletedAt, updatedAt FROM bills;
        `);
        // Drop old table and rename
        await db!.execAsync(`DROP TABLE bills;`);
        await db!.execAsync(`ALTER TABLE bills_new RENAME TO bills;`);

        // Recreate indices lost during rebuild
        await db!.execAsync(
          `CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customerId);`
        );
        await db!.execAsync(
          `CREATE INDEX IF NOT EXISTS idx_bills_createdAt ON bills(createdAt);`
        );
        await db!.execAsync(
          `CREATE INDEX IF NOT EXISTS idx_bills_shop_updated ON bills(shopId, updatedAt);`
        );
        // Recreate updatedAt triggers for bills (these were created in v3 for all tables originally)
        await db!.execAsync(`
          CREATE TRIGGER IF NOT EXISTS trg_bills_updatedAt_insert
          AFTER INSERT ON bills
          FOR EACH ROW
          BEGIN
            UPDATE bills SET updatedAt = COALESCE(NEW.updatedAt, DATETIME('now')) WHERE id = NEW.id;
          END;
        `);
        await db!.execAsync(`
          CREATE TRIGGER IF NOT EXISTS trg_bills_updatedAt
          AFTER UPDATE ON bills
          FOR EACH ROW
          BEGIN
            UPDATE bills
            SET updatedAt = COALESCE(NEW.updatedAt, DATETIME('now'))
            WHERE id = NEW.id;
          END;
        `);
      }

      await setUserVersion(4);
      await db!.execAsync("COMMIT");
      await db!.execAsync("PRAGMA foreign_keys = ON;");
      v = 4;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      await db!.execAsync("PRAGMA foreign_keys = ON;");
      throw e;
    }
  }

  // v4 -> v5: add local counters table for provisional numbers (KOT/day, bills/year, receipts/year, expenses/year)
  if (v < 5) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      await db!.execAsync(`
        CREATE TABLE IF NOT EXISTS local_counters (
          scope TEXT NOT NULL,
          periodKey TEXT NOT NULL,
          name TEXT NOT NULL,
          value INTEGER NOT NULL,
          PRIMARY KEY (scope, periodKey, name)
        );
      `);
      await setUserVersion(5);
      await db!.execAsync("COMMIT");
      v = 5;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }

  // v5 -> v6: drop any UNIQUE indexes on receipts(receiptNo)
  if (v < 6) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      const idxList = (await db!.getAllAsync(
        `PRAGMA index_list(receipts)`
      )) as { name: string; unique: number }[];
      for (const idx of idxList || []) {
        try {
          const cols = (await db!.getAllAsync(
            `PRAGMA index_info(${idx.name})`
          )) as { name: string }[];
          const hasReceiptNo = cols?.some((c) => c.name === "receiptNo");
          if (idx.unique && hasReceiptNo) {
            await db!.execAsync(`DROP INDEX IF EXISTS ${idx.name};`);
          }
        } catch {}
      }
      await setUserVersion(6);
      await db!.execAsync("COMMIT");
      v = 6;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }

  // v6 -> v7: Add expense_settlements table + indexes + triggers, and backfill from legacy expenses.mode
  if (v < 7) {
    await db!.execAsync("BEGIN IMMEDIATE TRANSACTION");
    try {
      // Create table with sync metadata columns present from the start
      await db!.execAsync(`
        CREATE TABLE IF NOT EXISTS expense_settlements (
          id TEXT PRIMARY KEY,
          expenseId TEXT NOT NULL,
          paymentType TEXT NOT NULL,
          subType TEXT,
          amount INTEGER NOT NULL,
          remarks TEXT,
          createdAt TEXT NOT NULL,
          shopId TEXT,
          deletedAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY (expenseId) REFERENCES expenses(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_expense_settlements_expense ON expense_settlements(expenseId);
        CREATE INDEX IF NOT EXISTS idx_expense_settlements_createdAt ON expense_settlements(createdAt);
        CREATE INDEX IF NOT EXISTS idx_expense_settlements_shop_updated ON expense_settlements(shopId, updatedAt);

        -- Triggers for updatedAt management
        CREATE TRIGGER IF NOT EXISTS trg_expense_settlements_updatedAt_insert
        AFTER INSERT ON expense_settlements
        FOR EACH ROW
        BEGIN
          UPDATE expense_settlements SET updatedAt = COALESCE(NEW.updatedAt, DATETIME('now')) WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_expense_settlements_updatedAt
        AFTER UPDATE ON expense_settlements
        FOR EACH ROW
        BEGIN
          UPDATE expense_settlements
          SET updatedAt = COALESCE(NEW.updatedAt, DATETIME('now'))
          WHERE id = NEW.id;
        END;
      `);

      // Backfill: for any expense without settlements, insert a single settlement reflecting legacy mode
      // Generate deterministic IDs prefixed with 'expset_' to be idempotent.
      await db!.execAsync(`
        INSERT INTO expense_settlements (id, expenseId, paymentType, subType, amount, remarks, createdAt, shopId, deletedAt, updatedAt)
        SELECT 
          'expset_' || e.id AS id,
          e.id as expenseId,
          CASE WHEN e.mode = 'Credit' THEN 'Credit' ELSE e.mode END as paymentType,
          CASE WHEN e.mode = 'Credit' THEN 'Accrual' ELSE NULL END as subType,
          e.amount,
          e.remarks,
          e.createdAt,
          e.shopId,
          NULL as deletedAt,
          e.createdAt as updatedAt
        FROM expenses e
        WHERE NOT EXISTS (
          SELECT 1 FROM expense_settlements s WHERE s.expenseId = e.id
        );
      `);

      await setUserVersion(7);
      await db!.execAsync("COMMIT");
      v = 7;
    } catch (e) {
      await db!.execAsync("ROLLBACK");
      throw e;
    }
  }
}

// Integrity audit: verify bill totals and customer credit consistency
export async function runIntegrityAudit() {
  if (!db) throw new Error("Database not initialized");
  const billIssues: any[] = [];
  const bills = await db.getAllAsync(`SELECT id,total FROM bills`);
  for (const b of bills as any[]) {
    const payments = (await db.getAllAsync(
      `SELECT amount, mode FROM payments WHERE billId = ?`,
      [b.id]
    )) as any[];
    let paid = 0,
      credit = 0;
    payments.forEach((p) => {
      if (p.mode === "Credit") credit += p.amount;
      else paid += p.amount;
    });
    if (paid + credit !== b.total) {
      billIssues.push({
        billId: b.id,
        stored: b.total,
        recomputed: paid + credit,
        paid,
        credit,
      });
    }
  }
  // Customer credit reconciliation
  const creditIssues: any[] = [];
  const customers = await db.getAllAsync(
    `SELECT id, creditBalance FROM customers`
  );
  for (const c of customers as any[]) {
    const accrual = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as sum FROM payments WHERE customerId=? AND subType='Accrual'`,
      [c.id]
    )) as any;
    const clearance = (await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as sum FROM payments WHERE customerId=? AND subType='Clearance'`,
      [c.id]
    )) as any;
    const expected = (accrual.sum || 0) - (clearance.sum || 0);
    if (expected !== c.creditBalance) {
      creditIssues.push({
        customerId: c.id,
        stored: c.creditBalance,
        expected,
      });
    }
  }
  // Expense settlements reconciliation
  const expenseIssues: any[] = [];
  const expenses = await db.getAllAsync(
    `SELECT id, amount FROM expenses WHERE (deletedAt IS NULL)`
  );
  for (const e of expenses as any[]) {
    const sums = (await db.getFirstAsync(
      `SELECT 
         COALESCE(SUM(CASE WHEN paymentType IN ('Cash','UPI') AND (subType IS NULL OR subType='') THEN amount ELSE 0 END),0) as basePaid,
         COALESCE(SUM(CASE WHEN paymentType='Credit' AND subType='Accrual' THEN amount ELSE 0 END),0) as accrued,
         COALESCE(SUM(CASE WHEN subType='Clearance' THEN amount ELSE 0 END),0) as cleared
       FROM expense_settlements WHERE expenseId=? AND (deletedAt IS NULL)`,
      [e.id]
    )) as any;
    const basePaid = sums?.basePaid || 0;
    const accrued = sums?.accrued || 0;
    const cleared = sums?.cleared || 0;
    if (basePaid + accrued !== e.amount) {
      expenseIssues.push({
        expenseId: e.id,
        kind: "amount_mismatch",
        amount: e.amount,
        basePaid,
        accrued,
        sum: basePaid + accrued,
      });
    }
    if (cleared > accrued) {
      expenseIssues.push({
        expenseId: e.id,
        kind: "over_cleared",
        accrued,
        cleared,
        delta: cleared - accrued,
      });
    }
  }
  return { billIssues, creditIssues, expenseIssues };
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

// Local counters helper: call from within withTransaction
export async function nextLocalNumber(
  name: "kot" | "bill" | "receipt" | "expense",
  date: Date
): Promise<number> {
  if (!db) throw new Error("Database not initialized");
  const shop = "shop_1"; // single-shop local scope

  // Use IST as shop-local time (UTC+05:30). If you support multi-timezone shops later,
  // make this configurable per shop.
  const istMs = date.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);

  // Period keys: KOT resets daily (IST). Others reset by Indian fiscal year (Apr 1–Mar 31, IST).
  const istDateKey = ist.toISOString().slice(0, 10); // YYYY-MM-DD (from IST-shifted date)
  const istMonth = ist.getUTCMonth(); // 0=Jan .. 11=Dec on IST-shifted date
  const istYear = ist.getUTCFullYear();
  const fiscalStartYear = istMonth >= 3 ? istYear : istYear - 1; // Apr (3) -> next Mar
  const periodKey = name === "kot" ? istDateKey : String(fiscalStartYear);
  const scope = shop;
  // Read
  let row = (await db.getFirstAsync(
    `SELECT value FROM local_counters WHERE scope=? AND periodKey=? AND name=?`,
    [scope, periodKey, name]
  )) as { value: number } | null;
  if (!row) {
    // seed from maxima in existing tables
    let seed = 0;
    if (name === "kot") {
      // Compare by IST date
      const r = (await db.getFirstAsync(
        `SELECT COALESCE(MAX(kotNumber),0) as m
         FROM kot_orders
         WHERE DATE(createdAt, '+330 minutes') = ?`,
        [istDateKey]
      )) as any;
      seed = r?.m || 0;
    } else if (name === "bill") {
      // Fiscal year window in IST
      const fyStart = `${fiscalStartYear}-04-01`;
      const fyEnd = `${fiscalStartYear + 1}-03-31`;
      const r = (await db.getFirstAsync(
        `SELECT COALESCE(MAX(billNumber),0) as m
         FROM bills
         WHERE DATE(createdAt, '+330 minutes') >= ?
           AND DATE(createdAt, '+330 minutes') <= ?`,
        [fyStart, fyEnd]
      )) as any;
      seed = r?.m || 0;
    } else if (name === "receipt") {
      const fyStart = `${fiscalStartYear}-04-01`;
      const fyEnd = `${fiscalStartYear + 1}-03-31`;
      const r = (await db.getFirstAsync(
        `SELECT COALESCE(MAX(receiptNo),0) as m
         FROM receipts
         WHERE DATE(createdAt, '+330 minutes') >= ?
           AND DATE(createdAt, '+330 minutes') <= ?`,
        [fyStart, fyEnd]
      )) as any;
      seed = r?.m || 0;
    } else if (name === "expense") {
      const fyStart = `${fiscalStartYear}-04-01`;
      const fyEnd = `${fiscalStartYear + 1}-03-31`;
      const r = (await db.getFirstAsync(
        `SELECT COALESCE(MAX(voucherNo),0) as m
         FROM expenses
         WHERE DATE(createdAt, '+330 minutes') >= ?
           AND DATE(createdAt, '+330 minutes') <= ?`,
        [fyStart, fyEnd]
      )) as any;
      seed = r?.m || 0;
    }
    await db.runAsync(
      `INSERT INTO local_counters(scope, periodKey, name, value) VALUES(?,?,?,?)`,
      [scope, periodKey, name, seed]
    );
    row = { value: seed } as any;
  }
  const next = (row?.value ?? 0) + 1;
  // Upsert
  await db.runAsync(
    `INSERT INTO local_counters(scope, periodKey, name, value) VALUES(?,?,?,?)
     ON CONFLICT(scope, periodKey, name) DO UPDATE SET value=excluded.value`,
    [scope, periodKey, name, next]
  );
  return next;
}
