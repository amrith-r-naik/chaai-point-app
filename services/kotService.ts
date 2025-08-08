// services/kotService.ts
// Kitchen Order Ticket (KOT) management service
import { computeISTBusinessDate, db } from "../lib/db";
import { menuService } from "./menuService";

export interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface KotItem {
  id: string;
  kotId: string;
  itemId: string;
  quantity: number;
  priceAtTime: number;
  menuItem?: MenuItem;
}

export interface KotOrder {
  id: string;
  kotNumber: number;
  customerId: string;
  billId: string | null;
  createdAt: string;
  businessDate?: string; // IST business date (YYYY-MM-DD)
  customer?: {
    id: string;
    name: string;
    contact: string | null;
  };
  items?: KotItem[];
  total?: number;
}

export interface CreateKotData {
  customerId: string;
  items: {
    itemId: string;
    quantity: number;
    price: number;
  }[];
}

class KotService {
  /**
   * Get all KOT orders with customer and item details
   */
  async getAllKots(): Promise<KotOrder[]> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getAllAsync(`
      SELECT 
        ko.*,
        c.name as customerName,
        c.contact as customerContact
      FROM kot_orders ko
      LEFT JOIN customers c ON ko.customerId = c.id
      ORDER BY ko.createdAt DESC
    `);

    const orders: KotOrder[] = result.map((row: any) => ({
      id: row.id,
      kotNumber: row.kotNumber,
      customerId: row.customerId,
      billId: row.billId,
      createdAt: row.createdAt,
      businessDate: row.businessDate,
      customer: {
        id: row.customerId,
        name: row.customerName,
        contact: row.customerContact,
      },
    }));

    // Get items for each order
    for (const order of orders) {
      const items = await this.getKotItems(order.id);
      order.items = items;
      order.total = items.reduce(
        (sum, item) => sum + item.priceAtTime * item.quantity,
        0
      );
    }

    return orders;
  }

  /**
   * Get single KOT by ID with full details
   */
  async getKotById(kotId: string): Promise<KotOrder | null> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(
      `
      SELECT 
        ko.*,
        c.name as customerName,
        c.contact as customerContact
      FROM kot_orders ko
      LEFT JOIN customers c ON ko.customerId = c.id
      WHERE ko.id = ?
    `,
      [kotId]
    )) as any;

    if (!result) return null;

    const order: KotOrder = {
      id: result.id,
      kotNumber: result.kotNumber,
      customerId: result.customerId,
      billId: result.billId,
      createdAt: result.createdAt,
      businessDate: result.businessDate,
      customer: {
        id: result.customerId,
        name: result.customerName,
        contact: result.customerContact,
      },
    };

    // Get items for this order
    const items = await this.getKotItems(order.id);
    order.items = items;
    order.total = items.reduce(
      (sum, item) => sum + item.priceAtTime * item.quantity,
      0
    );

    return order;
  }

  /**
   * Get items for a specific KOT
   */
  async getKotItems(kotId: string): Promise<KotItem[]> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getAllAsync(
      `
      SELECT 
        ki.*,
        mi.name as itemName,
        mi.category as itemCategory
      FROM kot_items ki
      LEFT JOIN menu_items mi ON ki.itemId = mi.id
      WHERE ki.kotId = ?
    `,
      [kotId]
    );

    return result.map((row: any) => ({
      id: row.id,
      kotId: row.kotId,
      itemId: row.itemId,
      quantity: row.quantity,
      priceAtTime: row.priceAtTime,
      menuItem: row.itemName
        ? {
            id: row.itemId,
            name: row.itemName,
            category: row.itemCategory,
            price: row.priceAtTime,
            isActive: 1,
            createdAt: "",
            updatedAt: "",
          }
        : undefined,
    }));
  }

  /**
   * Create a new KOT order
   */
  async createKot(kotData: CreateKotData): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    // Validate that customer exists
    const customerExists = await db.getFirstAsync(
      `SELECT id FROM customers WHERE id = ?`,
      [kotData.customerId]
    );
    
    if (!customerExists) {
      throw new Error(`Customer with ID ${kotData.customerId} does not exist`);
    }

    // Validate that all menu items exist, and auto-seed if using hardcoded items
    for (const item of kotData.items) {
      let menuItemExists = await db.getFirstAsync(
        `SELECT id FROM menu_items WHERE id = ? AND isActive = 1`,
        [item.itemId]
      );
      
      // If item doesn't exist but it's a hardcoded item (item_1, item_2, etc.), seed it
      if (!menuItemExists && item.itemId.startsWith('item_')) {
        await this.ensureHardcodedMenuItemExists(item.itemId);
        
        // Check again after seeding
        menuItemExists = await db.getFirstAsync(
          `SELECT id FROM menu_items WHERE id = ? AND isActive = 1`,
          [item.itemId]
        );
      }
      
      if (!menuItemExists) {
        throw new Error(`Menu item with ID ${item.itemId} does not exist or is inactive`);
      }
    }

    const kotId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    const businessDate = computeISTBusinessDate(createdAt);
    const kotNumber = await this.getNextDailySequence('kot', businessDate);

    try {
      await db.runAsync("BEGIN TRANSACTION");

      // Create the KOT order
      await db.runAsync(
        `
        INSERT INTO kot_orders (id, kotNumber, customerId, createdAt, businessDate)
        VALUES (?, ?, ?, ?, ?)
      `,
        [kotId, kotNumber, kotData.customerId, createdAt, businessDate]
      );

      // Create the KOT items
      for (const item of kotData.items) {
        const itemId = `kotitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync(
          `
          INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime)
          VALUES (?, ?, ?, ?, ?)
        `,
          [itemId, kotId, item.itemId, item.quantity, item.price]
        );
      }

      await db.runAsync("COMMIT");
      return kotId;
    } catch (error) {
      await db.runAsync("ROLLBACK");
      throw error;
    }
  }

  /**
   * Get customer's KOTs for a specific date
   */
  async getCustomerKotsForDate(
    customerId: string,
    date: string,
    onlyActive: boolean = false
  ): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // Add billId filter if onlyActive is true
      const billIdFilter = onlyActive ? "AND ko.billId IS NULL" : "";

      const result = await db.getAllAsync(
        `
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.createdAt,
          ko.createdAt as updatedAt,
          ko.businessDate,
          c.name as customerName,
          CASE 
            WHEN ko.billId IS NOT NULL THEN 'completed'
            ELSE 'pending'
          END as status
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        WHERE ko.customerId = ? 
          AND (ko.businessDate = ? OR (ko.businessDate IS NULL AND DATE(ko.createdAt) = DATE(?)))
          ${billIdFilter}
        ORDER BY ko.createdAt DESC
      `,
        [customerId, date, date]
      );

      // Get items for each KOT
      const kotsWithItems = await Promise.all(
        result.map(async (kot: any) => {
          const items = await db!.getAllAsync(
            `
            SELECT 
              ki.id,
              ki.kotId,
              ki.itemId as menuItemId,
              ki.quantity,
              ki.priceAtTime as price,
              (ki.quantity * ki.priceAtTime) as totalPrice,
              mi.name as menuItemName
            FROM kot_items ki
            LEFT JOIN menu_items mi ON ki.itemId = mi.id
            WHERE ki.kotId = ?
            ORDER BY mi.name
          `,
            [kot.id]
          );

          const totalAmount = items.reduce(
            (sum: number, item: any) => sum + item.totalPrice,
            0
          );

          return {
            id: kot.id,
            kotNumber: `KOT-${kot.kotNumber}`,
            customerId: kot.customerId,
            customerName: kot.customerName,
            items,
            totalAmount,
            status: kot.status,
            createdAt: kot.createdAt,
            updatedAt: kot.updatedAt,
          };
        })
      );

      return kotsWithItems;
    } catch (error) {
      console.error("Error fetching customer KOTs:", error);
      throw error;
    }
  }

  /**
   * Get next daily sequence number for KOT
   */
  private async getNextDailySequence(key: string, businessDate: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    // sequence key pattern: key:YYYY-MM-DD
    const seqKey = `${key}:${businessDate}`;
    await db.runAsync(`INSERT OR IGNORE INTO sequences (key, value) VALUES (?, 0)`, [seqKey]);
    await db.runAsync(`UPDATE sequences SET value = value + 1 WHERE key = ?`, [seqKey]);
    const row = await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [seqKey]) as any;
    return row.value;
  }

  /**
   * Auto-seed hardcoded menu items if they don't exist
   */
  private async ensureHardcodedMenuItemExists(itemId: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // Define the hardcoded menu items
    const hardcodedItems = {
      "item_1": { name: "Lemon Tea", category: "Tea", price: 30 },
      "item_2": { name: "White Sauce Pasta", category: "Pasta", price: 110 },
      "item_3": { name: "Peri Peri Fries", category: "Snacks", price: 100 },
      "item_4": { name: "Black Tea", category: "Tea", price: 25 },
    };

    const item = hardcodedItems[itemId as keyof typeof hardcodedItems];
    if (item) {
      const currentTime = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, item.name, item.category, item.price, 1, currentTime, currentTime]
      );
      console.log(`Auto-seeded menu item: ${itemId} - ${item.name}`);
    }
  }

  /**
   * Get hardcoded menu items for testing/demo
   */
  async getHardcodedMenuItems(): Promise<MenuItem[]> {
    // Use the menuService for better menu management
    return await menuService.getHardcodedMenuItems();
  }
}

export const kotService = new KotService();
