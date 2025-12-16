/**
 * Test Data Generator - Phase 1.2
 * Generates realistic test data at various scales to measure performance impact
 */

import * as SQLite from "expo-sqlite";

// Realistic test data templates
const firstNames = [
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

const lastNames = [
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

const menuItemsTemplate = [
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

interface GenerateOptions {
  customers?: number;
  ordersPerCustomer?: number;
  itemsPerOrder?: number;
  billPercentage?: number; // % of orders to bill
  startDate?: Date;
  endDate?: Date;
}

export class TestDataGenerator {
  private createdMenuItemIds: string[] = [];
  private db: SQLite.SQLiteDatabase | null = null;

  /**
   * Initialize database connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync("chaai-point.db");
    // Initialize schema if needed
    try {
      const tableCheck = await this.db!.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='customers'"
      );
      if (tableCheck.length === 0) {
        console.log("⚠️  Database tables not found. Initializing...");
      }
    } catch {
      // Ignore - schema likely exists
    }
  }

  /**
   * Generate test data at specified scale
   */
  async generate(options: GenerateOptions = {}): Promise<{
    customers: number;
    orders: number;
    items: number;
    bills: number;
    duration: number;
  }> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const {
      customers = 50,
      ordersPerCustomer = 10,
      itemsPerOrder = 3,
      billPercentage = 70,
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
    } = options;

    console.log("🏗️  Starting test data generation...");
    console.log(`  Customers: ${customers}`);
    console.log(`  Orders per customer: ${ordersPerCustomer}`);
    console.log(`  Items per order: ${itemsPerOrder}`);
    console.log(`  Bill percentage: ${billPercentage}%`);

    const startTime = performance.now();
    let totalOrders = 0;
    let totalItems = 0;
    let totalBills = 0;

    // Ensure menu items exist
    await this.ensureMenuItems();

    // Generate customers and their orders
    for (let i = 0; i < customers; i++) {
      const customerId = await this.createCustomer(i);

      // Generate orders for this customer spread over date range
      for (let j = 0; j < ordersPerCustomer; j++) {
        const orderDate = this.randomDate(startDate, endDate);
        const orderItemCount = this.randomInt(1, itemsPerOrder);

        const orderId = await this.createOrder(
          customerId,
          orderDate,
          orderItemCount
        );
        totalOrders++;
        totalItems += orderItemCount;

        // Bill some orders
        if (Math.random() * 100 < billPercentage) {
          await this.createBill(customerId, [orderId], orderDate);
          totalBills++;
        }
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${customers} customers`);
      }
    }

    const duration = performance.now() - startTime;

    console.log("✅ Test data generation complete!");
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  Total orders: ${totalOrders}`);
    console.log(`  Total items: ${totalItems}`);
    console.log(`  Total bills: ${totalBills}`);

    return {
      customers,
      orders: totalOrders,
      items: totalItems,
      bills: totalBills,
      duration,
    };
  }

  /**
   * Clear all test data (keeps structure)
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    console.log("🧹 Clearing test data...");

    await this.db!.withTransactionAsync(async () => {
      // Delete in order respecting foreign keys
      await this.db!.execAsync("DELETE FROM expense_settlements");
      await this.db!.execAsync("DELETE FROM expenses");
      await this.db!.execAsync("DELETE FROM split_payments");
      await this.db!.execAsync("DELETE FROM payments");
      await this.db!.execAsync("DELETE FROM receipts");
      await this.db!.execAsync("DELETE FROM kot_items");
      await this.db!.execAsync("DELETE FROM kot_orders");
      await this.db!.execAsync("DELETE FROM bills");
      await this.db!.execAsync("DELETE FROM customer_advances");
      await this.db!.execAsync("DELETE FROM customers");
      await this.db!.execAsync("DELETE FROM menu_items");
    });

    console.log("✅ Test data cleared");
  }

  /**
   * Get current data counts
   */
  async getCounts(): Promise<Record<string, number>> {
    if (!this.db) throw new Error("Database not initialized");

    const tables = [
      "customers",
      "kot_orders",
      "kot_items",
      "bills",
      "receipts",
      "payments",
      "menu_items",
    ];

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const result = (await this.db.getFirstAsync(
        `SELECT COUNT(*) as count FROM ${table}`
      )) as any;
      counts[table] = result?.count || 0;
    }

    return counts;
  }

  // Private helper methods

  private async ensureMenuItems(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    // Check if menu items exist
    const existing = (await this.db.getFirstAsync(
      "SELECT COUNT(*) as count FROM menu_items"
    )) as any;

    if (existing?.count > 0) {
      // Load existing IDs
      const rows = (await this.db.getAllAsync(
        "SELECT id FROM menu_items WHERE isActive = 1"
      )) as any[];
      this.createdMenuItemIds = rows.map((r) => r.id);
      return;
    }

    // Create menu items
    console.log("  Creating menu items...");
    const now = new Date().toISOString();

    for (const item of menuItemsTemplate) {
      const id = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [id, item.name, item.category, item.price, now, now]
      );
      this.createdMenuItemIds.push(id);
    }
  }

  private async createCustomer(index: number): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const firstName = firstNames[index % firstNames.length];
    const lastName =
      lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const name = `${firstName} ${lastName} ${index}`;
    const contact = `98${String(1000000000 + index).substr(-8)}`;
    const id = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO customers (id, name, contact, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, contact, now, now]
    );

    return id;
  }

  private async createOrder(
    customerId: string,
    orderDate: Date,
    itemCount: number
  ): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const kotNumber = Math.floor(Math.random() * 100000);
    const createdAt = orderDate.toISOString();

    await this.db.runAsync(
      `INSERT INTO kot_orders (id, kotNumber, customerId, createdAt)
       VALUES (?, ?, ?, ?)`,
      [orderId, kotNumber, customerId, createdAt]
    );

    // Add items to order
    for (let i = 0; i < itemCount; i++) {
      const itemId = `kotitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const menuItemId =
        this.createdMenuItemIds[
          Math.floor(Math.random() * this.createdMenuItemIds.length)
        ];
      const quantity = this.randomInt(1, 3);

      // Get price from menu
      const menuItem = (await this.db.getFirstAsync(
        "SELECT price FROM menu_items WHERE id = ?",
        [menuItemId]
      )) as any;
      const price = menuItem?.price || 5000;

      await this.db.runAsync(
        `INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, orderId, menuItemId, quantity, price, createdAt]
      );
    }

    return orderId;
  }

  private async createBill(
    customerId: string,
    orderIds: string[],
    billDate: Date
  ): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const billId = `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const billNumber = Math.floor(Math.random() * 100000);
    const createdAt = billDate.toISOString();

    // Calculate total from orders
    let total = 0;
    for (const orderId of orderIds) {
      const items = (await this.db.getAllAsync(
        "SELECT quantity, priceAtTime FROM kot_items WHERE kotId = ?",
        [orderId]
      )) as any[];

      total += items.reduce(
        (sum, item) => sum + item.quantity * item.priceAtTime,
        0
      );

      // Link order to bill
      await this.db.runAsync("UPDATE kot_orders SET billId = ? WHERE id = ?", [
        billId,
        orderId,
      ]);
    }

    await this.db.runAsync(
      `INSERT INTO bills (id, billNumber, customerId, total, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [billId, billNumber, customerId, total, createdAt]
    );

    return billId;
  }

  private randomDate(start: Date, end: Date): Date {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Singleton instance
export const testDataGenerator = new TestDataGenerator();

// Main execution
async function main() {
  const scale = process.argv[2] || "small";

  // Map scale to customer count
  const scaleMap: { [key: string]: number } = {
    small: 100,
    medium: 500,
    large: 1000,
  };

  if (!scaleMap[scale]) {
    console.error(`❌ Invalid scale: ${scale}`);
    console.log(`Valid scales: small, medium, large`);
    console.log(
      `Usage: npx ts-node ./scripts/test-data-generator.ts [small|medium|large]\n`
    );
    process.exit(1);
  }

  console.log(`\n📊 Phase 1.2 - Test Data Generator`);
  console.log(
    `🎯 Generating ${scale.toUpperCase()} scale test data (${scaleMap[scale]} customers)...\n`
  );

  try {
    const result = await testDataGenerator.generate({
      customers: scaleMap[scale],
      ordersPerCustomer: 5,
      itemsPerOrder: 3,
      billPercentage: 80,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date(),
    });

    console.log(`\n✅ Test data generated successfully!`);
    console.log(`\n📊 Generation Results:`);
    console.log(`   • Customers created: ${result.customers}`);
    console.log(`   • Orders created: ${result.orders}`);
    console.log(`   • Order items created: ${result.items}`);
    console.log(`   • Bills created: ${result.bills}`);
    console.log(`   • Time taken: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`\n📈 Next steps:`);
    console.log(`   1. Open the app and navigate to Dashboard`);
    console.log(`   2. View Admin Settings > Print Performance Report`);
    console.log(`   3. Document the query timing results for scale: ${scale}`);
    console.log(`   4. Clear logs and re-run with other scales`);
    console.log(`      npm run test:perf medium`);
    console.log(`      npm run test:perf large`);
    console.log(
      `   5. Compare performance curves to identify scaling issues\n`
    );
  } catch (error) {
    console.error(`❌ Error generating test data:`, error);
    process.exit(1);
  }
}

main();
