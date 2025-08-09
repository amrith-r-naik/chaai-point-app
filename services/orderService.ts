// services/orderService.ts
import { db } from "../lib/db"; // Still used for per-customer queries; keep until migrated
import { EodResult, eodService } from "./eodService";
import { CreateKotData, KotItem, KotOrder, kotService, MenuItem } from "./kotService";
import { statsService } from './statsService';

// Re-export interfaces for backward compatibility
export { CreateKotData, KotItem, KotOrder, MenuItem } from "./kotService";
export type CreateOrderData = CreateKotData;

class OrderService {
  /**
   * Get all orders - delegates to kotService
   */
  async getAllOrders(): Promise<KotOrder[]> {
    return await kotService.getAllKots();
  }

  /**
   * Get order by ID - delegates to kotService
   */
  async getOrderById(orderId: string): Promise<KotOrder | null> {
    return await kotService.getKotById(orderId);
  }

  /**
   * Get order items - delegates to kotService
   */
  async getOrderItems(kotId: string): Promise<KotItem[]> {
    return await kotService.getKotItems(kotId);
  }

  /**
   * Create order - delegates to kotService
   */
  async createOrder(orderData: CreateOrderData): Promise<string> {
    return await kotService.createKot(orderData);
  }

  /**
   * Get customer KOTs for date - delegates to kotService
   */
  async getCustomerKOTsForDate(
    customerId: string,
    date: string,
    onlyActive: boolean = false
  ): Promise<any[]> {
    return await kotService.getCustomerKotsForDate(customerId, date, onlyActive);
  }

  /**
   * Process End of Day - delegates to eodService
   */
  async processEndOfDay(dateString?: string): Promise<EodResult> {
    return await eodService.processEndOfDay(dateString);
  }

  /**
   * Get hardcoded menu items - delegates to kotService
   */
  async getHardcodedMenuItems(): Promise<MenuItem[]> {
    return await kotService.getHardcodedMenuItems();
  }

  /**
   * @deprecated Use statsService.getOrdersGroupedByDate directly for aggregation.
   * Kept as a thin delegation for backward compatibility.
   */
  async getOrdersGroupedByDate() {
    return await statsService.getOrdersGroupedByDate();
  }

  async getOrdersByCustomerId(customerId: string): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Get all KOTs for the customer with bill and payment information
      const orders = await db.getAllAsync(`
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.billId,
          ko.createdAt,
          ko.businessDate,
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
      `, [customerId]);

      // Get items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await db!.getAllAsync(`
            SELECT 
              ki.id,
              ki.quantity,
              ki.priceAtTime as price,
              (ki.quantity * ki.priceAtTime) as total,
              mi.name as menuItemName
            FROM kot_items ki
            LEFT JOIN menu_items mi ON ki.itemId = mi.id
            WHERE ki.kotId = ?
          `, [order.id]);

          const calculatedTotal = items.reduce((sum: number, item: any) => sum + item.total, 0); // Direct KOT total

          return {
            id: order.id,
            orderNumber: `KOT-${order.kotNumber}`,
            customerId: order.customerId,
            customerName: order.customerName,
            totalAmount: calculatedTotal, // Use calculated total directly from KOT
            amountPaid: order.paymentStatus === 'paid' ? calculatedTotal : 0,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            items: items.map((item: any) => ({
              id: item.id,
              menuItemName: item.menuItemName,
              quantity: item.quantity,
              price: item.price,
              total: item.total
            }))
          };
        })
      );

      return ordersWithItems;
    } catch (error) {
      console.error("Error fetching orders by customer ID:", error);
      throw error;
    }
  }

  async getOrderDetailsById(orderId: string): Promise<any> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Get order details
      const order = await db.getFirstAsync(`
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.billId,
          ko.createdAt,
          ko.businessDate,
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
      `, [orderId]);

      if (!order) {
        throw new Error("Order not found");
      }

      // Get order items
      const items = await db.getAllAsync(`
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
      `, [orderId]);

      const calculatedTotal = items.reduce((sum: number, item: any) => sum + item.total, 0);

      return {
        id: (order as any).id,
        orderNumber: `KOT-${(order as any).kotNumber}`,
        customerName: (order as any).customerName,
        totalAmount: (order as any).totalAmount || calculatedTotal,
        amountPaid: (order as any).paymentStatus === 'paid' ? ((order as any).totalAmount || calculatedTotal) : 0,
        paymentStatus: (order as any).paymentStatus,
        paymentMethod: 'Cash', // Default value since bills table doesn't have this
        notes: '', // Default value since bills table doesn't have this
        createdAt: (order as any).createdAt,
        items: items.map((item: any) => ({
          id: item.id,
          menuItemName: item.menuItemName,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }))
      };
    } catch (error) {
      console.error("Error fetching order details by ID:", error);
      throw error;
    }
  }
}

export const orderService = new OrderService();
