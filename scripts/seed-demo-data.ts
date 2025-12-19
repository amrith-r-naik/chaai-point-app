import { db } from "../lib/db";

// Configuration
const START_DATE = new Date("2024-10-01T00:00:00.000Z"); // 3 months ago (approx)
const END_DATE = new Date("2025-12-19T23:59:59.999Z"); // Today per user instruction
const DAILY_ORDER_MIN = 15;
const DAILY_ORDER_MAX = 45;

// Entities
const CUSTOMERS = [
  "Walk-in Customer",
  "Amit Shah", "Priya Singh", "Rahul Gandhi", "Narendra Modi", "Arvind Kejriwal",
  "Sonia Gandhi", "Mamta Banerjee", "Yogi Adityanath", "Akhilesh Yadav", "Mayawati",
  "Uddhav Thackeray", "Eknath Shinde", "Devendra Fadnavis", "Sharad Pawar", "Ajit Pawar",
  "Nitish Kumar", "Lalu Yadav", "Tejashwi Yadav", "Hemant Soren", "Champai Soren",
  "MK Stalin", "Edappadi Palaniswami", "Pinarayi Vijayan", "Siddaramaiah", "DK Shivakumar",
  "Revanth Reddy", "Chandrababu Naidu", "Jagan Mohan Reddy", "Naveen Patnaik"
];

const CATEGORIES = ["Tea", "Coffee", "Snacks", "Meals", "Desserts", "Beverages"];
const MENU_ITEMS = [
  { name: "Masala Chai", category: "Tea", price: 20 },
  { name: "Ginger Chai", category: "Tea", price: 25 },
  { name: "Elaichi Chai", category: "Tea", price: 25 },
  { name: "Filter Coffee", category: "Coffee", price: 30 },
  { name: "Cold Coffee", category: "Coffee", price: 60 },
  { name: "Bun Maska", category: "Snacks", price: 40 },
  { name: "Samosa (2pcs)", category: "Snacks", price: 30 },
  { name: "Vada Pav", category: "Snacks", price: 25 },
  { name: "Poha", category: "Snacks", price: 35 },
  { name: "Upma", category: "Snacks", price: 35 },
  { name: "Veg Sandwich", category: "Snacks", price: 50 },
  { name: "Cheese Sandwich", category: "Snacks", price: 70 },
  { name: "Paneer Roll", category: "Meals", price: 90 },
  { name: "Veg Burger", category: "Meals", price: 80 },
  { name: "French Fries", category: "Snacks", price: 60 },
  { name: "Maggie", category: "Meals", price: 50 },
  { name: "Cheese Maggie", category: "Meals", price: 70 },
  { name: "Gulab Jamun", category: "Desserts", price: 40 },
  { name: "Brownie", category: "Desserts", price: 80 },
  { name: "Mojito", category: "Beverages", price: 90 },
  { name: "Blue Lagoon", category: "Beverages", price: 90 },
  { name: "Oreo Shake", category: "Beverages", price: 100 },
  { name: "Kitkat Shake", category: "Beverages", price: 110 }
];

const VENDORS = [
  "Amul Milk Agency", "Local Vegetable Market", "Reliance Jio Info", 
  "Bescom Utility", "Rent Owner", "Coca Cola Distributor", "Gas Agency"
];

// Helpers
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

function addTime(date: Date, hours: number, minutes: number): string {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + hours);
  newDate.setMinutes(newDate.getMinutes() + minutes);
  return newDate.toISOString();
}

// State tracking for consistency
let customerIds: Record<string, string> = {}; // Name -> ID
let menuItemIds: Record<string, string> = {}; // Name -> ID
let customerBalances: Record<string, number> = {}; // ID -> Credit Balance
let customerAdvances: Record<string, number> = {}; // ID -> Advance Balance
let globalBillNum = 1;
let globalReceiptNum = 1;
let globalKOTNum = 1;
let globalVoucherNum = 1;

export async function seedDemoData() {
  if (!db) throw new Error("Database not initialized");

  console.log("🌱 Starting demo data seeding...");
  
  // 1. Clear Tables (Disable FKs)
  await db.execAsync("PRAGMA foreign_keys = OFF;");
  const tables = [
    "split_payments", "expense_settlements", "payments", "receipts", "expenses",
    "kot_items", "kot_orders", "bills", "customer_advances", "menu_items", 
    "customers", "local_counters", "sync_state"
  ];
  for (const t of tables) await db.execAsync(`DELETE FROM ${t};`);
  await db.execAsync("PRAGMA foreign_keys = ON;");

  // 2. Insert Customers
  console.log("Creating customers...");
  for (const [index, name] of CUSTOMERS.entries()) {
    const id = generateId("cust");
    const contact = index === 0 ? null : `9${randomInt(100000000, 999999999)}`; // Walk-in has no contact
    await db.runAsync(
      `INSERT INTO customers (id, name, contact, createdAt, updatedAt, creditBalance, shopId) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, contact, START_DATE.toISOString(), START_DATE.toISOString(), 0, 'shop_1']
    );
    customerIds[name] = id;
    customerBalances[id] = 0;
    customerAdvances[id] = 0;
  }

  // 3. Insert Menu Items
  console.log("Creating menu items...");
  for (const item of MENU_ITEMS) {
    const id = generateId("menu");
    await db.runAsync(
      `INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt, shopId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, item.name, item.category, item.price, 1, START_DATE.toISOString(), START_DATE.toISOString(), 'shop_1']
    );
    menuItemIds[item.name] = id;
  }

  // 4. Daily Loop
  const currentDate = new Date(START_DATE);
  console.log(`Generating data from ${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]}...`);

  let daysProcessed = 0;
  // Start first batch transaction
  await db.execAsync("BEGIN TRANSACTION;");

  try {
    while (currentDate <= END_DATE) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const totalDays = (END_DATE.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24);
      const currentDay = (currentDate.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24);
      const percent = Math.round((currentDay / totalDays) * 100);
      
      if (currentDay % 5 === 0) {
        console.log(`[Seed] Processing ${dateStr} (${percent}% complete)...`);
      }

      // 4a. Generate Daily Orders
      const orderCount = randomInt(DAILY_ORDER_MIN, DAILY_ORDER_MAX);
      
      for (let i = 0; i < orderCount; i++) {
        // Random time between 9 AM and 9 PM
        const time = addTime(currentDate, randomInt(9, 21), randomInt(0, 59));
        
        // Select Customer
        const isWalkIn = Math.random() < 0.6; // 60% Walk-ins
        const customerName = isWalkIn ? "Walk-in Customer" : randomItem(CUSTOMERS.filter(c => c !== "Walk-in Customer"));
        const customerId = customerIds[customerName];

        // Create Bill
        const billId = generateId("bill");
        const billNum = globalBillNum++;
        
        // Items (1-5 items)
        const itemCount = randomInt(1, 5);
        let total = 0;
        const itemsToInsert = [];
        
        // 1. Calculate Total & Prepare Items
        for (let k = 0; k < itemCount; k++) {
          const item = randomItem(MENU_ITEMS);
          const itemId = menuItemIds[item.name];
          const qty = randomInt(1, 4);
          const price = item.price;
          total += (qty * price);
          itemsToInsert.push({ itemId, qty, price });
        }

        const billKotId = generateId("kot");
        const kotNum = globalKOTNum++;

        // 2. Insert Bill (Now total is correct)
        await db.runAsync(
          `INSERT INTO bills (id, billNumber, customerId, total, createdAt, shopId, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [billId, billNum, customerId, total, time, 'shop_1', time]
        );

        // 3. Add KOT Header
        await db.runAsync(
          `INSERT INTO kot_orders (id, kotNumber, customerId, billId, createdAt, shopId, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [billKotId, kotNum, customerId, billId, time, 'shop_1', time]
        );

        // 4. Add Items
        for (const item of itemsToInsert) {
          await db.runAsync(
            `INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [generateId("ki"), billKotId, item.itemId, item.qty, item.price, time, 'shop_1', time]
          );
        }

        // Payment Processing
        const receiptId = generateId("rcpt");
        const receiptNum = globalReceiptNum++;
        let mode = "Cash";
        let remarks = "";

        // Determine Mode
        const rand = Math.random();
        if (rand < 0.45) mode = "Cash";
        else if (rand < 0.85) mode = "UPI";
        else if (rand < 0.95 && !isWalkIn) mode = "Credit"; // Only named customers get credit
        else if (!isWalkIn) mode = "Split"; // Rare split

        // Handle Payment
        if (mode === "Credit") {
          // Add Receipt (Credit Mode)
          await db.runAsync(
            `INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [receiptId, receiptNum, customerId, billId, total, "Credit", "Added to ledger", time, 'shop_1', time]
          );

          // Add Payment Entry (Accrual)
          await db.runAsync(
            `INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [generateId("pay"), billId, customerId, total, "Credit", "Accrual", "Bill #" + billNum, time, 'shop_1', time]
          );
          
          customerBalances[customerId] += total;
          await db.runAsync(`UPDATE customers SET creditBalance = ? WHERE id = ?`, [customerBalances[customerId], customerId]);

        } else if (mode === "Split") {
          const cashPart = Math.floor(total * 0.4);
          const upiPart = total - cashPart;
          
          await db.runAsync(
            `INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [receiptId, receiptNum, customerId, billId, total, "Split", "Partial Cash/UPI", time, 'shop_1', time]
          );

          await db.runAsync(
            `INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [generateId("sp"), receiptId, "Cash", cashPart, time, 'shop_1', time]
          );
          await db.runAsync(
            `INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [generateId("sp"), receiptId, "UPI", upiPart, time, 'shop_1', time]
          );

        } else {
          // Cash or UPI
          await db.runAsync(
            `INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [receiptId, receiptNum, customerId, billId, total, mode, "", time, 'shop_1', time]
          );
        }
      }

      // 4b. Random Credit Clearances (Payments from Customer)
      // Chance to pay if balance is high
      for (const custName of CUSTOMERS) {
        if (custName === "Walk-in Customer") continue;
        const custId = customerIds[custName];
        if (customerBalances[custId] > 500 && Math.random() < 0.1) { // 10% chance to pay if debt > 500
          const payAmount = Math.floor(customerBalances[custId] * (Math.random() < 0.5 ? 1 : 0.5)); // Full or half pay
          if (payAmount <= 0) continue;

          const time = addTime(currentDate, 10, 0);
          const payMode = Math.random() < 0.7 ? "UPI" : "Cash";
          
          await db.runAsync(
             `INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt, shopId, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
             [generateId("pay_clear"), null, custId, payAmount, payMode, "Clearance", "Payment Received", time, 'shop_1', time]
          );

          customerBalances[custId] -= payAmount;
          await db.runAsync(`UPDATE customers SET creditBalance = ? WHERE id = ?`, [customerBalances[custId], custId]);
        }
      }

      // 4c. Generate DAILY Expenses
      if (Math.random() < 0.8) { // 80% days have expenses
        const expCount = randomInt(1, 3);
        
        for (let e = 0; e < expCount; e++) {
          const time = addTime(currentDate, randomInt(10, 18), 0);
          const vendor = randomItem(VENDORS);
          const amount = randomInt(50, 500);
          const expenseId = generateId("exp");
          const voucherNo = globalVoucherNum++;
          
          // Payment Mode
          let mode = "Cash";
          const r = Math.random();
          if (r < 0.4) mode = "UPI";
          else if (r < 0.6) mode = "Credit";

          await db.runAsync(
            `INSERT INTO expenses (id, voucherNo, amount, towards, mode, remarks, createdAt, expenseDate, shopId, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [expenseId, voucherNo, amount, vendor, mode, "Daily Purchase", time, time.split('T')[0], 'shop_1', time]
          );

          if (mode === "Credit") {
             // Credit Settlement (Accrual)
             await db.runAsync(
               `INSERT INTO expense_settlements (id, expenseId, paymentType, subType, amount, remarks, createdAt, shopId, deletedAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
               [generateId("es"), expenseId, "Credit", "Accrual", amount, "", time, 'shop_1', null, time]
             );
             // Later clearance? Let's simplify and say they cleared it 5 days later? 
             // Implementing "future" clearance in a stream is tricky, so we'll just leave it as outstanding credit 
             // or check "Credit" expenses from 5 days ago to clear today. 
             // Actually, to correctly clear, I need the expenseId.
             // Let's settle it immediately 50% of the time, or leave it.
          } else {
             // Immediate settlement
             await db.runAsync(
               `INSERT INTO expense_settlements (id, expenseId, paymentType, subType, amount, remarks, createdAt, shopId, deletedAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
               [generateId("es"), expenseId, mode, null, amount, "", time, 'shop_1', null, time]
             );
          }
        }
      }

      // Advance one day
      currentDate.setDate(currentDate.getDate() + 1);
      daysProcessed++;

      // Commit Batch every 7 days
      if (daysProcessed % 7 === 0) {
        await db.execAsync("COMMIT;");
        // Yield to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 20));
        // Start next batch if not done
        if (currentDate <= END_DATE) {
          await db.execAsync("BEGIN TRANSACTION;");
        }
      }
    }
    
    // Commit remaining items if any
    if (daysProcessed % 7 !== 0) {
        await db.execAsync("COMMIT;");
    }

    // 5. Update Local Counters (so app continues efficiently)
    console.log("Updating local counters...");
    const upsertCounter = async (name: string, val: number) => {
       await db?.runAsync(
        `INSERT INTO local_counters(scope, periodKey, name, value) VALUES('shop_1', ?, ?, ?)
         ON CONFLICT(scope, periodKey, name) DO UPDATE SET value=excluded.value`,
        [END_DATE.toISOString().split('T')[0], name, val] // Using today's date key for simplicity, though bills use fiscal year
       );
       // Also update fiscal year counters if needed (bill, receipt, expense)
       // KOT uses date key. Bill/Receipt use fiscal year '2025'.
       await db?.runAsync(
        `INSERT INTO local_counters(scope, periodKey, name, value) VALUES('shop_1', ?, ?, ?)
         ON CONFLICT(scope, periodKey, name) DO UPDATE SET value=excluded.value`,
        ['2025', name, val] // Assuming fiscal year 2025 covers dec 2025
       );
    };

    await upsertCounter("bill", globalBillNum);
    await upsertCounter("receipt", globalReceiptNum);
    await upsertCounter("kot", globalKOTNum);
    await upsertCounter("expense", globalVoucherNum);

    console.log("✅ Demo data setup complete!");

  } catch (err) {
    await db.execAsync("ROLLBACK;");
    console.error("❌ Seeding failed:", err);
    throw err;
  }
}
