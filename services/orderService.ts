// services/orderService.ts
import { db } from "../lib/db";
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

    // Validate that customer exists
    const customerExists = await db.getFirstAsync(
      `SELECT id FROM customers WHERE id = ?`,
      [orderData.customerId]
    );
    
    if (!customerExists) {
      throw new Error(`Customer with ID ${orderData.customerId} does not exist`);
    }

    // Validate that all menu items exist, and auto-seed if using hardcoded items
    for (const item of orderData.items) {
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

  async getHardcodedMenuItems(): Promise<MenuItem[]> {
    // Use the menuService for better menu management
    return await menuService.getHardcodedMenuItems();
  }

  async getOrdersGroupedByDate(): Promise<
    Record<
      string,
      {
        date: string;
        displayDate: string;
        customers: Record<
          string,
          {
            customer: any;
            totalAmount: number;
            orderCount: number;
            hasCompletedBilling: boolean;
            hasActiveOrders: boolean;
          }
        >;
      }
    >
  > {
    if (!db) throw new Error("Database not initialized");

    const orders = (await db.getAllAsync(`
      SELECT 
        ko.*,
        c.name as customerName,
        c.contact as customerContact,
        COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount,
        DATE(ko.createdAt) as orderDate
      FROM kot_orders ko
      LEFT JOIN customers c ON ko.customerId = c.id
      LEFT JOIN kot_items ki ON ko.id = ki.kotId
      GROUP BY ko.id, c.name, c.contact, DATE(ko.createdAt)
      ORDER BY ko.createdAt DESC
    `)) as any[];

    // Group orders by date
    const dateGroups: Record<
      string,
      {
        date: string;
        displayDate: string;
        customers: Record<
          string,
          {
            customer: any;
            totalAmount: number;
            orderCount: number;
            hasCompletedBilling: boolean;
            hasActiveOrders: boolean;
          }
        >;
      }
    > = {};

    orders.forEach((order: any) => {
      const orderDate = order.orderDate;
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      let displayDate: string;
      if (orderDate === today) {
        displayDate = "Today";
      } else if (orderDate === yesterday) {
        displayDate = "Yesterday";
      } else {
        const date = new Date(orderDate);
        const options: Intl.DateTimeFormatOptions = {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          weekday: "long",
        };
        displayDate = date.toLocaleDateString("en-GB", options);
      }

      if (!dateGroups[orderDate]) {
        dateGroups[orderDate] = {
          date: orderDate,
          displayDate,
          customers: {},
        };
      }

      const customerId = order.customerId;
      if (!dateGroups[orderDate].customers[customerId]) {
        dateGroups[orderDate].customers[customerId] = {
          customer: {
            id: order.customerId,
            name: order.customerName,
            contact: order.customerContact,
          },
          totalAmount: 0,
          orderCount: 0,
          hasCompletedBilling: false,
          hasActiveOrders: false,
        };
      }

      const customerData = dateGroups[orderDate].customers[customerId];
      customerData.totalAmount += order.totalAmount || 0;
      customerData.orderCount += 1;

      // Check billing status
      if (order.billId) {
        customerData.hasCompletedBilling = true;
      } else {
        customerData.hasActiveOrders = true;
      }
    });

    return dateGroups;
  }

  async getCustomerKOTsForDate(
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
          c.name as customerName,
          CASE 
            WHEN ko.billId IS NOT NULL THEN 'completed'
            ELSE 'pending'
          END as status
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        WHERE ko.customerId = ? 
        AND datetime(ko.createdAt) >= datetime(?)
        AND datetime(ko.createdAt) <= datetime(?)
        ${billIdFilter}
        ORDER BY ko.createdAt DESC
      `,
        [customerId, startDate.toISOString(), endDate.toISOString()]
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
}

export const orderService = new OrderService();
