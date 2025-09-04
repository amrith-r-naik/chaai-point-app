// services/orderService.ts
import { db, withTransaction } from "../lib/db";
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
  async getBillById(billId: string): Promise<{
    id: string;
    billNumber: number;
    customerId: string;
    customerName: string;
    total: number;
    createdAt: string;
  } | null> {
    if (!db) throw new Error("Database not initialized");

    const row = (await db.getFirstAsync(
      `
      SELECT b.id, b.billNumber, b.customerId, b.total, b.createdAt,
             c.name as customerName
      FROM bills b
      JOIN customers c ON b.customerId = c.id
      WHERE b.id = ?
    `,
      [billId]
    )) as any | null;

    if (!row) return null;

    return {
      id: row.id,
      billNumber: row.billNumber,
      customerId: row.customerId,
      customerName: row.customerName,
      total: row.total,
      createdAt: row.createdAt,
    };
  }

  async getKOTsForBill(billId: string): Promise<
    {
      id: string;
      kotNumber: number;
      createdAt: string;
      totalAmount: number;
      items: {
        id: string;
        menuItemName: string;
        quantity: number;
        price: number;
        total: number;
      }[];
    }[]
  > {
    if (!db) throw new Error("Database not initialized");

    const kots = (await db.getAllAsync(
      `
      SELECT ko.id, ko.kotNumber, ko.createdAt
      FROM kot_orders ko
      WHERE ko.billId = ?
      ORDER BY ko.createdAt ASC
    `,
      [billId]
    )) as any[];

    const withItems = await Promise.all(
      kots.map(async (kot: any) => {
        const items = (await db!.getAllAsync(
          `
          SELECT 
            ki.id,
            mi.name as menuItemName,
            ki.quantity,
            ki.priceAtTime as price,
            (ki.quantity * ki.priceAtTime) as total
          FROM kot_items ki
          LEFT JOIN menu_items mi ON ki.itemId = mi.id
          WHERE ki.kotId = ?
          ORDER BY mi.name
        `,
          [kot.id]
        )) as any[];

        const totalAmount = items.reduce((sum, it) => sum + (it.total || 0), 0);
        return {
          id: kot.id,
          kotNumber: kot.kotNumber,
          createdAt: kot.createdAt,
          totalAmount,
          items: items.map((it) => ({
            id: it.id,
            menuItemName: it.menuItemName,
            quantity: it.quantity,
            price: it.price,
            total: it.total,
          })),
        };
      })
    );

    return withItems;
  }
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

    // Batch fetch items to avoid N+1
    if (orders.length) {
      const ids = orders.map((o) => o.id);
      const placeholders = ids.map(() => "?").join(",");
      const rows = (await db.getAllAsync(
        `SELECT ki.*, mi.name as itemName
         FROM kot_items ki 
         LEFT JOIN menu_items mi ON mi.id = ki.itemId
         WHERE ki.kotId IN (${placeholders})`,
        ids
      )) as any[];
      const byOrder: Record<string, any[]> = {};
      for (const r of rows) {
        (byOrder[r.kotId] ||= []).push({
          id: r.id,
          kotId: r.kotId,
          itemId: r.itemId,
          quantity: r.quantity,
          priceAtTime: r.priceAtTime,
          name: r.itemName,
        });
      }
      for (const order of orders) {
        const items = (byOrder[order.id] || []) as any[];
        order.items = items as any;
        order.total = items.reduce(
          (sum, item) => sum + item.priceAtTime * item.quantity,
          0
        );
      }
    }

    return orders;
  }

  async getOrdersByDate(dateISO: string): Promise<KotOrder[]> {
    if (!db) throw new Error("Database not initialized");
    // dateISO expected as YYYY-MM-DD; compare in IST using '+330 minutes'
    // Compute IST day range [start, next)
    const start = new Date(dateISO + "T00:00:00.000Z");
    const startMs = start.getTime() - 5.5 * 60 * 60 * 1000; // back to UTC
    const endMs = startMs + 24 * 60 * 60 * 1000;
    const startUtc = new Date(startMs).toISOString();
    const endUtc = new Date(endMs).toISOString();

    const result = await db.getAllAsync(
      `
      SELECT 
        ko.*,
        c.name as customerName,
        c.contact as customerContact
      FROM kot_orders ko
      LEFT JOIN customers c ON ko.customerId = c.id
      WHERE ko.createdAt >= ? AND ko.createdAt < ?
      ORDER BY ko.createdAt DESC
    `,
      [startUtc, endUtc]
    );

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

    if (orders.length) {
      const ids = orders.map((o) => o.id);
      const placeholders = ids.map(() => "?").join(",");
      const rows = (await db.getAllAsync(
        `SELECT ki.*, mi.name as itemName
         FROM kot_items ki 
         LEFT JOIN menu_items mi ON mi.id = ki.itemId
         WHERE ki.kotId IN (${placeholders})`,
        ids
      )) as any[];
      const byOrder: Record<string, any[]> = {};
      for (const r of rows) {
        (byOrder[r.kotId] ||= []).push({
          id: r.id,
          kotId: r.kotId,
          itemId: r.itemId,
          quantity: r.quantity,
          priceAtTime: r.priceAtTime,
          name: r.itemName,
        });
      }
      for (const order of orders) {
        const items = (byOrder[order.id] || []) as any[];
        order.items = items as any;
        order.total = items.reduce(
          (sum, item) => sum + item.priceAtTime * item.quantity,
          0
        );
      }
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

    // Quick guard: avoid creating empty orders
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error("Cannot create an order without items");
    }

    // Validate that customer exists
    const customerExists = await db.getFirstAsync(
      `SELECT id FROM customers WHERE id = ?`,
      [orderData.customerId]
    );

    if (!customerExists) {
      throw new Error(
        `Customer with ID ${orderData.customerId} does not exist`
      );
    }

    // Validate that all menu items exist with a single query; seed hardcoded if missing
    const uniqueItemIds = Array.from(
      new Set(orderData.items.map((i) => i.itemId))
    );
    const placeholders = uniqueItemIds.map(() => "?").join(",");
    const existingRows = (await db.getAllAsync(
      `SELECT id FROM menu_items WHERE isActive = 1 AND id IN (${placeholders})`,
      uniqueItemIds
    )) as { id: string }[];
    const existing = new Set(existingRows.map((r) => r.id));
    const missing = uniqueItemIds.filter((id) => !existing.has(id));

    // Auto-seed known hardcoded catalog items
    for (const mid of missing) {
      if (mid.startsWith("item_")) {
        await this.ensureHardcodedMenuItemExists(mid);
      }
    }
    if (missing.length) {
      // Re-check after potential seeding
      const rows2 = (await db.getAllAsync(
        `SELECT id FROM menu_items WHERE isActive = 1 AND id IN (${placeholders})`,
        uniqueItemIds
      )) as { id: string }[];
      const exists2 = new Set(rows2.map((r) => r.id));
      const stillMissing = uniqueItemIds.filter((id) => !exists2.has(id));
      if (stillMissing.length) {
        throw new Error(
          `Some menu items don't exist or are inactive: ${stillMissing.join(", ")}`
        );
      }
    }

    const orderId = `order_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const now = new Date();
    const createdAt = now.toISOString();

    await withTransaction(async () => {
      // Create the KOT order
      // Assign a local KOT number unique for the day
      const kotNumber = await (async () => {
        // Use nextLocalNumber inside the same transaction context
        const { nextLocalNumber } = await import("@/lib/db");
        return nextLocalNumber("kot", now);
      })();

      await db!.runAsync(
        `
        INSERT INTO kot_orders (id, kotNumber, customerId, createdAt)
        VALUES (?, ?, ?, ?)
      `,
        [orderId, kotNumber, orderData.customerId, createdAt]
      );

      // Create all KOT items in one roundtrip
      const valuesSql: string[] = [];
      const params: any[] = [];
      for (const it of orderData.items) {
        const kid = `kotitem_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        valuesSql.push("(?, ?, ?, ?, ?, ?)");
        params.push(kid, orderId, it.itemId, it.quantity, it.price, createdAt);
      }
      await db!.runAsync(
        `INSERT INTO kot_items (id, kotId, itemId, quantity, priceAtTime, createdAt)
         VALUES ${valuesSql.join(",")}`,
        params
      );
    });
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.orders();
      signalChange.any();
    } catch {}
    return orderId;
  }

  // KOT numbers now assigned by server; no local generator

  private async ensureHardcodedMenuItemExists(itemId: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // Define the hardcoded menu items
    const hardcodedItems = {
      item_1: { name: "Lemon Tea", category: "Tea", price: 30 },
      item_2: { name: "White Sauce Pasta", category: "Pasta", price: 110 },
      item_3: { name: "Peri Peri Fries", category: "Snacks", price: 100 },
      item_4: { name: "Black Tea", category: "Tea", price: 25 },
    };

    const item = hardcodedItems[itemId as keyof typeof hardcodedItems];
    if (item) {
      const currentTime = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          item.name,
          item.category,
          item.price,
          1,
          currentTime,
          currentTime,
        ]
      );
      console.log(`Auto-seeded menu item: ${itemId} - ${item.name}`);
    }
  }

  async getHardcodedMenuItems(): Promise<MenuItem[]> {
    // Use the menuService for better menu management
    return await menuService.getHardcodedMenuItems();
  }

  async getRecentlyOrderedItems(limit: number = 10): Promise<MenuItem[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      const result = await db.getAllAsync(
        `
        SELECT 
          mi.id,
          mi.name,
          mi.category,
          mi.price,
          mi.isActive,
          mi.createdAt,
          mi.updatedAt,
          COUNT(ki.id) as orderCount,
          MAX(ko.createdAt) as lastOrdered
        FROM menu_items mi
        INNER JOIN kot_items ki ON mi.id = ki.itemId
        INNER JOIN kot_orders ko ON ki.kotId = ko.id
        WHERE mi.isActive = 1
        GROUP BY mi.id, mi.name, mi.category, mi.price, mi.isActive, mi.createdAt, mi.updatedAt
        ORDER BY MAX(ko.createdAt) DESC, COUNT(ki.id) DESC
        LIMIT ?
      `,
        [limit]
      );

      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        price: row.price,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    } catch (error) {
      console.error("Error fetching recently ordered items:", error);
      return [];
    }
  }

  async getOrdersGroupedByDate(daysWindow: number = 2): Promise<
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
            activeAmount: number;
            completedAmount: number;
            activeOrderCount: number;
            completedOrderCount: number;
            paymentMode?: string;
          }
        >;
      }
    >
  > {
    if (!db) throw new Error("Database not initialized");

    // Compute start date boundary for "Load older" window
    const startDateStr = (() => {
      const d = new Date(Date.now() - daysWindow * 86400000);
      return d.toISOString().split("T")[0];
    })();

    const orders = (await db.getAllAsync(
      `
      SELECT 
        ko.id as kotId,
        ko.kotNumber,
        ko.customerId,
        ko.billId,
        ko.createdAt,
        c.name as customerName,
        c.contact as customerContact,
        COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount,
        DATE(ko.createdAt) as orderDate,
        COALESCE(r.mode, p.mode) as paymentMode
      FROM kot_orders ko
      LEFT JOIN customers c ON ko.customerId = c.id
      LEFT JOIN kot_items ki ON ko.id = ki.kotId
      LEFT JOIN bills b ON ko.billId = b.id
      LEFT JOIN receipts r ON b.customerId = r.customerId AND DATE(b.createdAt) = DATE(r.createdAt)
      LEFT JOIN payments p ON b.id = p.billId
      WHERE DATE(ko.createdAt) >= DATE(?)
      GROUP BY ko.id, ko.kotNumber, ko.customerId, ko.billId, ko.createdAt, c.name, c.contact, DATE(ko.createdAt), r.mode, p.mode
      ORDER BY ko.createdAt DESC
    `,
      [startDateStr]
    )) as any[];

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
            paymentMode?: string;
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
          isPaidCustomer: false, // New field to track if customer has paid (non-credit)
          // Track separate amounts and counts for active vs completed
          activeAmount: 0,
          completedAmount: 0,
          activeOrderCount: 0,
          completedOrderCount: 0,
          paymentMode: order.paymentMode,
        } as any;
      }

      const customerData = dateGroups[orderDate].customers[customerId] as any;
      customerData.totalAmount += order.totalAmount || 0;
      customerData.orderCount += 1;

      // Update payment mode if we have one
      if (order.paymentMode) {
        customerData.paymentMode = order.paymentMode;
      }

      // Check billing status and track amounts and counts separately
      if (order.billId) {
        customerData.hasCompletedBilling = true;
        customerData.completedAmount += order.totalAmount || 0;
        customerData.completedOrderCount += 1;

        // Check if this is a paid customer (non-credit payment)
        if (order.paymentMode && order.paymentMode !== "Credit") {
          customerData.isPaidCustomer = true;
        }
      } else {
        customerData.hasActiveOrders = true;
        customerData.activeAmount += order.totalAmount || 0;
        customerData.activeOrderCount += 1;
      }
    });

    return dateGroups as any;
  }

  async getCustomerKOTsForDate(
    customerId: string,
    date: string,
    onlyActive: boolean = false
  ): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Use local (IST) calendar day matching similar to other date queries
      // Expect `date` as YYYY-MM-DD (local day). Apply +330 minutes to normalize UTC to IST.
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
          AND DATE(ko.createdAt, '+330 minutes') = ?
          ${billIdFilter}
        ORDER BY ko.createdAt DESC
      `,
        [customerId, date]
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

  async getOrdersByCustomerId(customerId: string): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Get all KOTs for the customer with bill and payment information
      const orders = await db.getAllAsync(
        `
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.billId,
          ko.createdAt,
          c.name as customerName,
          CASE 
            WHEN ko.billId IS NOT NULL AND p.mode = 'Credit' THEN 'credit'
            WHEN ko.billId IS NOT NULL AND p.mode != 'Credit' THEN 'paid'
            ELSE 'pending'
          END as paymentStatus,
          COALESCE(b.total, 0) as totalAmount,
          0 as amountPaid
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        LEFT JOIN bills b ON ko.billId = b.id
        LEFT JOIN payments p ON b.id = p.billId
        WHERE ko.customerId = ?
        ORDER BY ko.createdAt DESC
      `,
        [customerId]
      );

      // Get items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          if (!db) throw new Error("Database not initialized");

          const items = await db.getAllAsync(
            `
            SELECT 
              ki.id,
              ki.quantity,
              ki.priceAtTime as price,
              (ki.quantity * ki.priceAtTime) as total,
              mi.name as menuItemName
            FROM kot_items ki
            LEFT JOIN menu_items mi ON ki.itemId = mi.id
            WHERE ki.kotId = ?
          `,
            [order.id]
          );

          const calculatedTotal = items.reduce(
            (sum: number, item: any) => sum + item.total,
            0
          ); // Direct KOT total

          return {
            id: order.id,
            orderNumber: `KOT-${order.kotNumber}`,
            customerId: order.customerId,
            customerName: order.customerName,
            totalAmount: calculatedTotal, // Use calculated total directly from KOT
            amountPaid: order.paymentStatus === "paid" ? calculatedTotal : 0,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            items: items.map((item: any) => ({
              id: item.id,
              menuItemName: item.menuItemName,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })),
          };
        })
      );

      return ordersWithItems;
    } catch (error) {
      console.error("Error fetching orders by customer ID:", error);
      throw error;
    }
  }

  async processEndOfDay(
    dateString?: string
  ): Promise<{ processedKOTs: number; totalAmount: number }> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Use provided date or today's date
      const targetDate = dateString || new Date().toISOString().split("T")[0];

      // Get all active (unbilled) KOTs for the target date
      const activeKOTs = await db.getAllAsync(
        `
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.createdAt,
          c.name as customerName,
          COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        LEFT JOIN kot_items ki ON ko.id = ki.kotId
        WHERE ko.billId IS NULL 
        AND DATE(ko.createdAt) = DATE(?)
        GROUP BY ko.id, ko.kotNumber, ko.customerId, ko.createdAt, c.name
      `,
        [targetDate]
      );

      if (activeKOTs.length === 0) {
        return { processedKOTs: 0, totalAmount: 0 };
      }

      let totalProcessedAmount = 0;
      const processedCustomers = new Set<string>();

      // Group KOTs by customer
      const kotsByCustomer = activeKOTs.reduce(
        (
          acc: Record<
            string,
            { customerName: string; kots: any[]; totalAmount: number }
          >,
          kot: any
        ) => {
          if (!acc[kot.customerId]) {
            acc[kot.customerId] = {
              customerName: kot.customerName,
              kots: [],
              totalAmount: 0,
            };
          }
          acc[kot.customerId].kots.push(kot);
          acc[kot.customerId].totalAmount += kot.totalAmount;
          return acc;
        },
        {}
      );

      // Process each customer's KOTs as credit payment (each processPayment handles its own transaction)
      for (const [customerId, customerData] of Object.entries(kotsByCustomer)) {
        try {
          // Import paymentService dynamically to avoid circular imports
          const paymentServiceModule = await import("./paymentService");
          const paymentService = paymentServiceModule.paymentService;

          // Process as credit payment (amount is already in rupees from KOT calculation)
          await paymentService.processCreditSale(
            customerId,
            customerData.customerName,
            customerData.totalAmount,
            `EOD Credit Payment - ${targetDate}`
          );
          // Link older date KOTs explicitly
          // processCreditSale currently links today's KOTs; re-link with target date
          await paymentService["linkKOTsToBill"]?.(
            customerId,
            (
              (await db.getFirstAsync(
                `SELECT id FROM bills WHERE customerId=? ORDER BY createdAt DESC LIMIT 1`,
                [customerId]
              )) as any
            )?.id,
            targetDate
          );

          totalProcessedAmount += customerData.totalAmount;
          processedCustomers.add(customerId);
        } catch (customerError) {
          console.error(
            `Error processing EOD for customer ${customerId}:`,
            customerError
          );
          // Continue with other customers even if one fails
        }
      }

      const summary = {
        processedKOTs: activeKOTs.length,
        totalAmount: totalProcessedAmount, // Already in rupees from KOT calculation
      };
      try {
        const { signalChange } = await import("@/state/appEvents");
        signalChange.orders();
        signalChange.bills();
        signalChange.payments();
        signalChange.any();
      } catch {}
      return summary;
    } catch (error) {
      console.error("Error processing EOD:", error);
      throw error;
    }
  }

  // getUnbilledOrders removed: unbilled KOT concept deprecated.

  async getOrderDetailsById(orderId: string): Promise<any> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Get order details
      const order = await db.getFirstAsync(
        `
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.billId,
          ko.createdAt,
          c.name as customerName,
          CASE 
            WHEN ko.billId IS NOT NULL THEN 'paid'
            WHEN ko.billId IS NULL THEN 'credit'
          END as paymentStatus,
          COALESCE(b.total, 0) as totalAmount,
          0 as amountPaid
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        LEFT JOIN bills b ON ko.billId = b.id
        WHERE ko.id = ?
      `,
        [orderId]
      );

      if (!order) {
        throw new Error("Order not found");
      }

      // Get order items
      const items = await db.getAllAsync(
        `
        SELECT 
          ki.id,
          ki.quantity,
          ki.priceAtTime as price,
          (ki.quantity * ki.priceAtTime) as total,
          mi.name as menuItemName
        FROM kot_items ki
        LEFT JOIN menu_items mi ON ki.itemId = mi.id
        WHERE ki.kotId = ?
        ORDER BY mi.name
      `,
        [orderId]
      );

      const calculatedTotal = items.reduce(
        (sum: number, item: any) => sum + item.total,
        0
      );

      return {
        id: (order as any).id,
        orderNumber: `KOT-${(order as any).kotNumber}`,
        customerName: (order as any).customerName,
        totalAmount: (order as any).totalAmount || calculatedTotal,
        amountPaid:
          (order as any).paymentStatus === "paid"
            ? (order as any).totalAmount || calculatedTotal
            : 0,
        paymentStatus: (order as any).paymentStatus,
        paymentMethod: "Cash", // Default value since bills table doesn't have this
        notes: "", // Default value since bills table doesn't have this
        createdAt: (order as any).createdAt,
        items: items.map((item: any) => ({
          id: item.id,
          menuItemName: item.menuItemName,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      };
    } catch (error) {
      console.error("Error fetching order details by ID:", error);
      throw error;
    }
  }
}

export const orderService = new OrderService();
