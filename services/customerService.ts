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

export async function createCustomer(
  name: string,
  contact?: string
): Promise<Customer> {
  try {
    if (!db) throw new Error("Database not initialized");

    // Generate unique walk-in customer ID for customers without contact
    let customerId: string;
    if (!contact || contact.trim() === '') {
      customerId = await generateWalkInCustomerId();
    } else {
      customerId = uuid.v4() as string;
    }

    const customer: Customer = {
      id: customerId,
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

    return customer;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
}

async function generateWalkInCustomerId(): Promise<string> {
  if (!db) throw new Error("Database not initialized");

  try {
    // Get the next customer number by finding the highest existing walk-in customer ID
    const result = await db.getFirstAsync(`
      SELECT id FROM customers 
      WHERE id LIKE 'C%' 
      AND id REGEXP '^C[0-9]+$'
      ORDER BY CAST(SUBSTR(id, 2) AS INTEGER) DESC 
      LIMIT 1
    `) as { id?: string } | null;

    let nextNumber = 1;
    if (result?.id) {
      const currentNumber = parseInt(result.id.substring(1));
      nextNumber = currentNumber + 1;
    }

    // Format as C001, C002, etc.
    return `C${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating walk-in customer ID:", error);
    // Fallback to timestamp-based ID if regex fails
    return `C${Date.now().toString().slice(-6)}`;
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

    await db.runAsync(`DELETE FROM customers WHERE id = ?`, [id]);
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
