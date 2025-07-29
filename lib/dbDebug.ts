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
          `INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime)
           VALUES (?, ?, ?, ?, ?)`,
          [itemId, order.id, item.itemId, item.quantity, item.price]
        );
      }
    }

    console.log("Test orders seeded successfully");
  } catch (error) {
    console.error("Orders seed error:", error);
  }
}
