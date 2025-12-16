/**
 * Test Data Generator for Debug/Development
 * Used to generate test data at various scales for performance testing
 * This should only be called from the app's admin settings screen during development
 */

import { analyzeDatabase, db, withTransaction } from "@/lib/db";

// Realistic test data templates
export const firstNames = [
  "Raj",
  "Priya",
  "Amit",
  "Sneha",
  "Rahul",
  "Neha",
  "Arjun",
  "Ananya",
  "Vikram",
  "Pooja",
  "Karan",
  "Divya",
  "Ravi",
  "Kavya",
  "Aditya",
  "Ishita",
  "Sanjay",
  "Meera",
  "Rohan",
  "Sakshi",
  "Varun",
  "Anjali",
  "Nikhil",
  "Ritu",
];

export const lastNames = [
  "Sharma",
  "Patel",
  "Kumar",
  "Singh",
  "Gupta",
  "Joshi",
  "Reddy",
  "Verma",
  "Mehta",
  "Nair",
  "Iyer",
  "Shah",
  "Rao",
  "Desai",
  "Kulkarni",
  "Bhat",
];

export const menuItemsTemplate = [
  { name: "Masala Chai", category: "Tea", price: 1500 },
  { name: "Ginger Chai", category: "Tea", price: 2000 },
  { name: "Cappuccino", category: "Hot Cups", price: 8000 },
  { name: "Latte", category: "Hot Cups", price: 9000 },
  { name: "Mint Mojito", category: "Mojito", price: 7000 },
  { name: "Lemon Mojito", category: "Mojito", price: 7000 },
  { name: "Cold Coffee", category: "Refreshers", price: 8000 },
  { name: "Chocolate Milkshake", category: "Milkshakes", price: 10000 },
  { name: "Mango Shake", category: "Milkshakes", price: 10000 },
  { name: "Veg Maggie", category: "Maggie", price: 5000 },
  { name: "Cheese Maggie", category: "Maggie", price: 6000 },
  { name: "Vada Pav", category: "Quick Bites", price: 3000 },
  { name: "Samosa", category: "Quick Bites", price: 2000 },
  { name: "Cheese Sandwich", category: "Sandwich", price: 7000 },
  { name: "Veg Burger", category: "Burger", price: 8000 },
  { name: "Cheese Burger", category: "Burger", price: 9000 },
  { name: "Plain Omelette", category: "Omlette", price: 4000 },
  { name: "Cheese Omelette", category: "Omlette", price: 5000 },
  { name: "Paneer Roll", category: "Rolls", price: 7000 },
  { name: "Veg Momos", category: "Momos", price: 6000 },
];

/**
 * Generate test data at specified scale
 * Scales: small (100), medium (500), large (1000)
 */
export async function generateTestData(scale: "small" | "medium" | "large") {
  const scaleConfig = {
    small: 100,
    medium: 500,
    large: 1000,
  };

  const customerCount = scaleConfig[scale];
  console.log(
    `\n🏗️  Starting test data generation (${scale}: ${customerCount} customers)...`
  );

  const startTime = performance.now();
  let totalOrders = 0;
  let totalItems = 0;
  let totalBills = 0;
  let idCounter = 0; // Global counter for truly unique IDs

  const generateId = (prefix: string): string => {
    return `${prefix}_${++idCounter}_${Date.now()}`;
  };

  try {
    // Wrap entire operation in transaction for consistency
    await withTransaction(async () => {
      // Ensure menu items exist
      const menuIds = await ensureMenuItems(generateId);
      console.log(`✅ Menu items ready (${menuIds.length} items)`);

      if (menuIds.length === 0) {
        throw new Error("No menu items available - cannot create orders");
      }

      // Generate customers and their orders
      for (let i = 0; i < customerCount; i++) {
        const customerId = await createTestCustomer(i, generateId);

        // Generate 5 orders per customer
        for (let j = 0; j < 5; j++) {
          const orderDate = randomDate(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            new Date()
          );
          const orderItemCount = randomInt(1, 3);

          const orderId = await createTestOrder(
            customerId,
            menuIds,
            orderDate,
            orderItemCount,
            generateId
          );
          totalOrders++;
          totalItems += orderItemCount;

          // Bill 80% of orders
          if (Math.random() * 100 < 80) {
            await createTestBill(customerId, [orderId], orderDate, generateId);
            totalBills++;
          }
        }

        // Progress indicator
        if ((i + 1) % 10 === 0) {
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
          console.log(
            `  Progress: ${i + 1}/${customerCount} (${elapsed}s elapsed)`
          );
        }
      }
    });

    const duration = performance.now() - startTime;
    console.log(`\n✅ Test data generation complete!`);
    console.log(`📊 Results:`);
    console.log(`   • Customers: ${customerCount}`);
    console.log(`   • Orders: ${totalOrders}`);
    console.log(`   • Items: ${totalItems}`);
    console.log(`   • Bills: ${totalBills}`);
    console.log(`   • Duration: ${(duration / 1000).toFixed(2)}s\n`);

    // Analyze database for optimal query performance
    await analyzeDatabase();

    return { customerCount, totalOrders, totalItems, totalBills, duration };
  } catch (error) {
    console.error("❌ Error generating test data:", error);
    throw error;
  }
}

/**
 * Clear all test data (keeps schema)
 */
export async function clearTestData() {
  console.log("\n🧹 Clearing all test data...");

  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Increase timeout for this operation
      await db!.execAsync("PRAGMA busy_timeout = 15000;");

      // Force WAL checkpoint to complete any pending writes
      try {
        await db!.execAsync("PRAGMA wal_checkpoint(RESTART);");
      } catch {
        // Ignore checkpoint errors
      }

      // Wait for any queries to complete
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));

      // Use IMMEDIATE transaction to force write lock acquisition
      await db!.execAsync("BEGIN IMMEDIATE;");
      try {
        // Disable foreign key checks
        await db!.execAsync("PRAGMA foreign_keys = OFF;");

        // Delete all data
        await db!.execAsync(`
          DELETE FROM expense_settlements;
          DELETE FROM split_payments;
          DELETE FROM payments;
          DELETE FROM receipts;
          DELETE FROM kot_items;
          DELETE FROM kot_orders;
          DELETE FROM bills;
          DELETE FROM customer_advances;
          DELETE FROM expenses;
          DELETE FROM customers;
          DELETE FROM menu_items;
        `);

        // Re-enable foreign key checks
        await db!.execAsync("PRAGMA foreign_keys = ON;");

        await db!.execAsync("COMMIT;");
      } catch (e) {
        try {
          await db!.execAsync("ROLLBACK;");
        } catch {}
        throw e;
      }

      // Clear service caches after deleting data
      const { orderService } = await import("@/services/orderService");
      orderService.clearCache();

      console.log("✅ Test data cleared\n");

      // Reset timeout back to normal
      await db!.execAsync("PRAGMA busy_timeout = 10000;");
      return;
    } catch (error: any) {
      attempt++;
      const msg = String(error?.message || error);

      if (msg.includes("locked") && attempt < maxRetries) {
        console.warn(
          `⚠️  Database locked (attempt ${attempt}/${maxRetries}), retrying...`
        );
        continue;
      }

      console.error("❌ Error clearing test data:", error);
      throw error;
    }
  }

  throw new Error("Failed to clear test data after multiple retries");
}

// ============= Private Helpers =============

async function ensureMenuItems(
  generateId: (prefix: string) => string
): Promise<string[]> {
  // Check if menu items exist
  const existing = (await db!.getFirstAsync(
    "SELECT COUNT(*) as count FROM menu_items"
  )) as any;

  if (existing?.count > 0) {
    // Load existing IDs
    const rows = (await db!.getAllAsync(
      "SELECT id FROM menu_items WHERE isActive = 1"
    )) as any[];
    return rows.map((r) => r.id);
  }

  // Create menu items
  console.log("  Creating menu items...");
  const now = new Date().toISOString();
  const createdIds: string[] = [];

  for (const item of menuItemsTemplate) {
    const id = generateId("menu");
    await db!.runAsync(
      `INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, item.name, item.category, item.price, now, now]
    );
    createdIds.push(id);
  }

  return createdIds;
}

async function createTestCustomer(
  index: number,
  generateId: (prefix: string) => string
): Promise<string> {
  const firstName = firstNames[index % firstNames.length];
  const lastName =
    lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const name = `${firstName} ${lastName} ${index}`;
  // Generate unique contact - must be truly unique
  const contact = `98${String(index + 1).padStart(8, "0")}`;
  const id = generateId("cust");
  const now = new Date().toISOString();

  await db!.runAsync(
    `INSERT INTO customers (id, name, contact, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, contact, now, now]
  );

  return id;
}

async function createTestOrder(
  customerId: string,
  menuIds: string[],
  orderDate: Date,
  itemCount: number,
  generateId: (prefix: string) => string
): Promise<string> {
  const orderId = generateId("order");
  const kotNumber = Math.floor(Math.random() * 1000000); // Use larger range for uniqueness
  const createdAt = orderDate.toISOString();

  await db!.runAsync(
    `INSERT INTO kot_orders (id, kotNumber, customerId, createdAt)
     VALUES (?, ?, ?, ?)`,
    [orderId, kotNumber, customerId, createdAt]
  );

  // Add items to order
  for (let i = 0; i < itemCount; i++) {
    const itemId = generateId("kotitem");
    const menuItemId = menuIds[Math.floor(Math.random() * menuIds.length)];
    const quantity = randomInt(1, 3);

    // Get price from menu
    const menuItem = (await db!.getFirstAsync(
      "SELECT price FROM menu_items WHERE id = ?",
      [menuItemId]
    )) as any;
    const price = menuItem?.price || 5000;

    await db!.runAsync(
      `INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [itemId, orderId, menuItemId, quantity, price, createdAt]
    );
  }

  return orderId;
}

async function createTestBill(
  customerId: string,
  orderIds: string[],
  billDate: Date,
  generateId: (prefix: string) => string
): Promise<string> {
  const billId = generateId("bill");
  const billNumber = Math.floor(Math.random() * 1000000); // Use larger range for uniqueness
  const createdAt = billDate.toISOString();

  // Calculate total from orders FIRST
  let total = 0;
  for (const orderId of orderIds) {
    const items = (await db!.getAllAsync(
      "SELECT quantity, priceAtTime FROM kot_items WHERE kotId = ?",
      [orderId]
    )) as any[];

    total += items.reduce(
      (sum, item) => sum + item.quantity * item.priceAtTime,
      0
    );
  }

  // INSERT bill FIRST (before setting billId reference)
  await db!.runAsync(
    `INSERT INTO bills (id, billNumber, customerId, total, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [billId, billNumber, customerId, total, createdAt]
  );

  // THEN link orders to bill (after bill exists)
  for (const orderId of orderIds) {
    await db!.runAsync("UPDATE kot_orders SET billId = ? WHERE id = ?", [
      billId,
      orderId,
    ]);
  }

  return billId;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
