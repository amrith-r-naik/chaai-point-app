import { db } from "@/lib/db";
import { authState } from "@/state/authState";
import uuid from "react-native-uuid";

export interface Customer {
  id: string;
  name: string;
  contact?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    if (!db) throw new Error("Database not initialized");

    // Wait for database to be ready
    let retries = 0;
    while (!authState.isDbReady.get() && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (!authState.isDbReady.get()) {
      throw new Error("Database not ready after timeout");
    }

    const customers = (await db.getAllAsync(`
      SELECT * FROM customers ORDER BY name ASC
    `)) as Customer[];

    return customers;
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw error;
  }
}

// Minimal aggregated stats per customer for lightweight listing
export async function getCustomersSummary(): Promise<
  {
    id: string;
    name: string;
    contact?: string;
    creditBalance: number;
    billCount: number;
    totalBilled: number;
    lastBillAt: string | null;
  }[]
> {
  try {
    if (!db) throw new Error("Database not initialized");

    // Ensure DB ready
    let retries = 0;
    while (!authState.isDbReady.get() && retries < 50) {
      await new Promise((r) => setTimeout(r, 100));
      retries++;
    }
    if (!authState.isDbReady.get())
      throw new Error("Database not ready after timeout");

    const rows = (await db.getAllAsync(`
      SELECT 
        c.id,
        c.name,
        c.contact,
        COALESCE(c.creditBalance,0) as creditBalance,
        (SELECT COUNT(*) FROM bills b WHERE b.customerId = c.id) as billCount,
        COALESCE((SELECT SUM(total) FROM bills b2 WHERE b2.customerId = c.id),0) as totalBilled,
        (SELECT MAX(createdAt) FROM bills b3 WHERE b3.customerId = c.id) as lastBillAt
      FROM customers c
      ORDER BY c.name ASC
    `)) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      contact: r.contact || undefined,
      creditBalance: r.creditBalance || 0,
      billCount: r.billCount || 0,
      totalBilled: r.totalBilled || 0,
      lastBillAt: r.lastBillAt || null,
    }));
  } catch (error) {
    console.error("Error fetching customer summaries:", error);
    return [];
  }
}

export async function createCustomer(
  name: string,
  contact?: string
): Promise<Customer> {
  try {
    if (!db) throw new Error("Database not initialized");

    const customer: Customer = {
      id: uuid.v4() as string,
      name: name.trim(),
      contact: contact?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT INTO customers (id, name, contact, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [
        customer.id,
        customer.name,
        customer.contact || null,
        customer.createdAt,
        customer.updatedAt,
      ]
    );
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.customers();
      signalChange.any();
    } catch {}
    return customer;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
}

export async function updateCustomer(
  id: string,
  name: string,
  contact?: string
): Promise<Customer> {
  try {
    if (!db) throw new Error("Database not initialized");

    const updatedAt = new Date().toISOString();

    await db.runAsync(
      `UPDATE customers SET name = ?, contact = ?, updatedAt = ? WHERE id = ?`,
      [name.trim(), contact?.trim() || null, updatedAt, id]
    );

    const customer = (await db.getFirstAsync(
      `SELECT * FROM customers WHERE id = ?`,
      [id]
    )) as Customer;

    if (!customer) {
      throw new Error("Customer not found after update");
    }
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.customers();
      signalChange.any();
    } catch {}
    return customer;
  } catch (error) {
    console.error("Error updating customer:", error);
    throw error;
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  try {
    if (!db) throw new Error("Database not initialized");

    // Check if customer has any orders
    const orders = (await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM kot_orders WHERE customerId = ?`,
      [id]
    )) as { count: number };

    if (orders.count > 0) {
      throw new Error("Cannot delete customer with existing orders");
    }

    // Soft-delete related advance ledger entries for this customer
    await db.runAsync(
      `UPDATE customer_advances SET deletedAt = ? WHERE customerId = ? AND deletedAt IS NULL`,
      [new Date().toISOString(), id]
    );
    await db.runAsync(`DELETE FROM customers WHERE id = ?`, [id]);
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.customers();
      signalChange.any();
    } catch {}
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw error;
  }
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  try {
    if (!db) throw new Error("Database not initialized");

    const searchTerm = `%${query.trim()}%`;
    const customers = (await db.getAllAsync(
      `
      SELECT * FROM customers 
      WHERE name LIKE ? OR contact LIKE ?
      ORDER BY name ASC
    `,
      [searchTerm, searchTerm]
    )) as Customer[];

    return customers;
  } catch (error) {
    console.error("Error searching customers:", error);
    throw error;
  }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    if (!db) throw new Error("Database not initialized");

    const customer = (await db.getFirstAsync(
      `SELECT * FROM customers WHERE id = ?`,
      [id]
    )) as Customer | undefined;

    return customer || null;
  } catch (error) {
    console.error("Error fetching customer:", error);
    throw error;
  }
}
