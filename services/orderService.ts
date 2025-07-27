// services/orderService.ts
import { db } from "../lib/db";

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
  customer?: {
    id: string;
    name: string;
    contact: string | null;
  };
  items?: KotItem[];
  total?: number;
}

export interface CreateOrderData {
  customerId: string;
  items: {
    itemId: string;
    quantity: number;
    price: number;
  }[];
}

class OrderService {
  async getAllOrders(): Promise<KotOrder[]> {
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
      customer: {
        id: row.customerId,
        name: row.customerName,
        contact: row.customerContact,
      },
    }));

    // Get items for each order
    for (const order of orders) {
      const items = await this.getOrderItems(order.id);
      order.items = items;
      order.total = items.reduce(
        (sum, item) => sum + item.priceAtTime * item.quantity,
        0
      );
    }

    return orders;
  }

  async getOrderById(orderId: string): Promise<KotOrder | null> {
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
      [orderId]
    )) as any;

    if (!result) return null;

    const order: KotOrder = {
      id: result.id,
      kotNumber: result.kotNumber,
      customerId: result.customerId,
      billId: result.billId,
      createdAt: result.createdAt,
      customer: {
        id: result.customerId,
        name: result.customerName,
        contact: result.customerContact,
      },
    };

    // Get items for this order
    const items = await this.getOrderItems(order.id);
    order.items = items;
    order.total = items.reduce(
      (sum, item) => sum + item.priceAtTime * item.quantity,
      0
    );

    return order;
  }

  async getOrderItems(kotId: string): Promise<KotItem[]> {
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

  async createOrder(orderData: CreateOrderData): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const kotNumber = await this.getNextKotNumber();
    const createdAt = new Date().toISOString();

    try {
      await db.runAsync("BEGIN TRANSACTION");

      // Create the KOT order
      await db.runAsync(
        `
        INSERT INTO kot_orders (id, kotNumber, customerId, createdAt)
        VALUES (?, ?, ?, ?)
      `,
        [orderId, kotNumber, orderData.customerId, createdAt]
      );

      // Create the KOT items
      for (const item of orderData.items) {
        const itemId = `kotitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync(
          `
          INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime)
          VALUES (?, ?, ?, ?, ?)
        `,
          [itemId, orderId, item.itemId, item.quantity, item.price]
        );
      }

      await db.runAsync("COMMIT");
      return orderId;
    } catch (error) {
      await db.runAsync("ROLLBACK");
      throw error;
    }
  }

  private async getNextKotNumber(): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(`
      SELECT MAX(kotNumber) as maxKot FROM kot_orders
    `)) as any;

    return (result?.maxKot || 0) + 1;
  }

  async getHardcodedMenuItems(): Promise<MenuItem[]> {
    // Hardcoded menu items as requested
    return [
      {
        id: "item_1",
        name: "Lemon Tea",
        category: "Tea",
        price: 30,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "item_2",
        name: "White Sauce Pasta",
        category: "Pasta",
        price: 110,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "item_3",
        name: "Peri Peri Fries",
        category: "Snacks",
        price: 100,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "item_4",
        name: "Black Tea",
        category: "Tea",
        price: 25,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export const orderService = new OrderService();
