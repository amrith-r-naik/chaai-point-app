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

export async function seedTestData() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    // First, seed some test customers
    await db.runAsync(
      `INSERT OR IGNORE INTO customers (id, name, contact, createdAt, updatedAt) 
       VALUES ('cust1', 'John Doe', '9876543210', datetime('now'), datetime('now'))`
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO customers (id, name, contact, createdAt, updatedAt) 
       VALUES ('cust2', 'Jane Smith', '9876543211', datetime('now'), datetime('now'))`
    );

    // Seed some menu items
    await db.runAsync(
      `INSERT OR IGNORE INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt) 
       VALUES ('item1', 'Masala Chai', 'Beverages', 1500, 1, datetime('now'), datetime('now'))`
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt) 
       VALUES ('item2', 'Samosa', 'Snacks', 2000, 1, datetime('now'), datetime('now'))`
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt) 
       VALUES ('item3', 'Sandwich', 'Snacks', 5000, 1, datetime('now'), datetime('now'))`
    );

    // Create some test orders from today
    const today = new Date().toISOString();

    // Order 1
    await db.runAsync(
      `INSERT OR IGNORE INTO kot_orders (id, kotNumber, customerId, createdAt) 
       VALUES ('order1', 1001, 'cust1', ?)`,
      [today]
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt) 
       VALUES ('item_1_1', 'order1', 'item1', 2, 1500, datetime('now'))`
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt) 
       VALUES ('item_1_2', 'order1', 'item2', 1, 2000, datetime('now'))`
    );

    // Order 2
    await db.runAsync(
      `INSERT OR IGNORE INTO kot_orders (id, kotNumber, customerId, createdAt) 
       VALUES ('order2', 1002, 'cust2', ?)`,
      [today]
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt) 
       VALUES ('item_2_1', 'order2', 'item3', 1, 5000, datetime('now'))`
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt) 
       VALUES ('item_2_2', 'order2', 'item1', 3, 1500, datetime('now'))`
    );

    // Add some expenses
    await db.runAsync(
      `INSERT OR IGNORE INTO expenses (id, voucherNo, amount, towards, mode, remarks, createdAt) 
       VALUES ('exp1', 1, 25000, 'Rent', 'Cash', 'Monthly shop rent', ?)`,
      [today]
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO expenses (id, voucherNo, amount, towards, mode, remarks, createdAt) 
       VALUES ('exp2', 2, 5000, 'Supplies', 'UPI', 'Tea leaves and milk', ?)`,
      [today]
    );

    console.log("Test data seeded successfully");
  } catch (error) {
    console.error("Error seeding test data:", error);
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
      DROP TABLE IF EXISTS split_payments;
      DROP TABLE IF EXISTS receipts;
      DROP TABLE IF EXISTS expenses;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS bills;
      DROP TABLE IF EXISTS kot_items;
      DROP TABLE IF EXISTS kot_orders;
      DROP TABLE IF EXISTS menu_items;
      DROP TABLE IF EXISTS customers;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS sync_state;
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
        updatedAt TEXT NOT NULL,
        creditBalance INTEGER NOT NULL DEFAULT 0
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
        createdAt TEXT NOT NULL,
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
        subType TEXT,
        remarks TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (billId) REFERENCES bills(id),
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );

      CREATE TABLE receipts (
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

      CREATE TABLE expenses (
        id TEXT PRIMARY KEY,
        voucherNo INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        towards TEXT NOT NULL,
        mode TEXT NOT NULL,
        remarks TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE split_payments (
        id TEXT PRIMARY KEY,
        receiptId TEXT NOT NULL,
        paymentType TEXT NOT NULL,
        amount INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (receiptId) REFERENCES receipts(id)
      );

      -- Indices for performance
      CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customerId);
      CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(billId);
      CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customerId);
      CREATE INDEX IF NOT EXISTS idx_bills_createdAt ON bills(createdAt);
      CREATE INDEX IF NOT EXISTS idx_payments_createdAt ON payments(createdAt);
      CREATE INDEX IF NOT EXISTS idx_receipts_bill ON receipts(billId);
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
    const testAdminUserId = "test-user-1";
    const testStaffUserId = "test-user-2";
    const currentTime = new Date().toISOString();

    await db.runAsync(
      `
      INSERT OR REPLACE INTO users (id, email, password, role, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        testAdminUserId,
        "admin@chaaipoint.com",
        "password123",
        "admin",
        currentTime,
      ]
    );

    await db.runAsync(
      `
      INSERT OR REPLACE INTO users (id, email, password, role, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        testStaffUserId,
        "staff@chaaipoint.com",
        "password123",
        "staff",
        currentTime,
      ]
    );

    console.log("Test users created successfully");
    console.log("Email: admin@chaaipoint.com");
    console.log("Password: password123");
    console.log("Email: staff@chaaipoint.com");
    console.log("Password: password123");
  } catch (error) {
    console.error("Seed error:", error);
  }
}

export async function seedTestCustomers() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    const currentTime = new Date().toISOString();

    const testCustomers = [
      {
        id: "customer-1",
        name: "Arjun Kumar",
        contact: "9876543210",
      },
      {
        id: "customer-2",
        name: "Priya Sharma",
        contact: "9123456789",
      },
      {
        id: "customer-3",
        name: "Rajesh Gupta",
        contact: "9234567890",
      },
      {
        id: "customer-4",
        name: "Meera Patel",
        contact: "9345678901",
      },
      {
        id: "customer-5",
        name: "Vikash Singh",
        contact: null,
      },
    ];

    for (const customer of testCustomers) {
      await db.runAsync(
        `INSERT OR REPLACE INTO customers (id, name, contact, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [customer.id, customer.name, customer.contact, currentTime, currentTime]
      );
    }

    console.log("Test customers seeded successfully");
  } catch (error) {
    console.error("Customer seed error:", error);
  }
}

export async function seedTestMenuItems() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    // Check if test menu items already exist
    const existingItems = await db.getAllAsync(`
      SELECT id FROM menu_items WHERE id LIKE 'item_%' LIMIT 1
    `);

    if (existingItems.length > 0) {
      console.log("Test menu items already exist, skipping seed");
      return;
    }

    const currentTime = new Date().toISOString();

    const testMenuItems = [
      {
        id: "item_1",
        name: "Lemon Tea",
        category: "Tea",
        price: 30,
      },
      {
        id: "item_2",
        name: "White Sauce Pasta",
        category: "Pasta",
        price: 110,
      },
      {
        id: "item_3",
        name: "Peri Peri Fries",
        category: "Snacks",
        price: 100,
      },
      {
        id: "item_4",
        name: "Black Tea",
        category: "Tea",
        price: 25,
      },
    ];

    for (const item of testMenuItems) {
      await db.runAsync(
        `INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.name,
          item.category,
          item.price,
          1,
          currentTime,
          currentTime,
        ]
      );
    }

    console.log("Test menu items seeded successfully");
  } catch (error) {
    console.error("Menu items seed error:", error);
  }
}

export async function seedTestOrders() {
  if (!db) {
    console.log("Database is not initialized");
    return;
  }

  try {
    // Check if test orders already exist
    const existingOrders = await db.getAllAsync(`
      SELECT id FROM kot_orders WHERE id LIKE 'test-order-%' LIMIT 1
    `);

    if (existingOrders.length > 0) {
      console.log("Test orders already exist, skipping seed");
      return;
    }

    // Test orders with different timestamps
    const testOrders = [
      {
        id: "test-order-1",
        kotNumber: 1,
        customerId: "customer-1",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        items: [
          { itemId: "item_1", quantity: 2, price: 30 }, // Lemon Tea
          { itemId: "item_3", quantity: 1, price: 100 }, // Peri Peri Fries
        ],
      },
      {
        id: "test-order-2",
        kotNumber: 2,
        customerId: "customer-2",
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        items: [
          { itemId: "item_2", quantity: 1, price: 110 }, // White Sauce Pasta
          { itemId: "item_4", quantity: 3, price: 25 }, // Black Tea
        ],
      },
      {
        id: "test-order-3",
        kotNumber: 3,
        customerId: "customer-3",
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        items: [
          { itemId: "item_1", quantity: 5, price: 30 }, // Lemon Tea
        ],
      },
    ];

    for (const order of testOrders) {
      // Insert KOT order
      await db.runAsync(
        `INSERT INTO kot_orders (id, kotNumber, customerId, createdAt)
         VALUES (?, ?, ?, ?)`,
        [order.id, order.kotNumber, order.customerId, order.createdAt]
      );

      // Insert KOT items
      for (const item of order.items) {
        const itemId = `kotitem_${order.id}_${item.itemId}`;
        await db.runAsync(
          `INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            order.id,
            item.itemId,
            item.quantity,
            item.price,
            order.createdAt,
          ]
        );
      }
    }

    console.log("Test orders seeded successfully");
  } catch (error) {
    console.error("Orders seed error:", error);
  }
}
