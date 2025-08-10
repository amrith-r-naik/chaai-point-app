import { PaymentMode } from "@/constants/paymentConstants";
import { db } from "@/lib/db";
import { creditStateActions } from "@/state/creditState";
import { enhancedPaymentService } from "./enhancedPaymentService";

/**
 * Credit Management Service - Replaces dueService with new unified payment flow
 * Provides credit balance management and due collection functionality
 */

export interface CustomerCredit {
  customerId: string;
  customerName: string;
  customerContact: string | null;
  creditBalance: number;
  lastTransactionDate: string;
}

export interface CreditCollectionData {
  customerId: string;
  amount: number;
  remarks?: string;
  paymentComponents: Array<{
    type: 'Cash' | 'UPI';
    amount: number;
  }>;
}

class CreditService {
  
  /**
   * Get all customers with credit balances
   */
  async getCustomersWithCredit(): Promise<CustomerCredit[]> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getAllAsync(`
      SELECT 
        c.id as customerId,
        c.name as customerName,
        c.contact as customerContact,
        COALESCE(c.creditBalance, 0) as creditBalance,
        COALESCE(MAX(p.createdAt), c.createdAt) as lastTransactionDate
      FROM customers c
      LEFT JOIN payments p ON c.id = p.customerId
      WHERE COALESCE(c.creditBalance, 0) > 0
      GROUP BY c.id, c.name, c.contact, c.creditBalance, c.createdAt
      ORDER BY creditBalance DESC, lastTransactionDate DESC
    `) as CustomerCredit[];

    return result;
  }

  /**
   * Get total pending credit across all customers
   */
  async getTotalCreditBalance(): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(`
      SELECT COALESCE(SUM(creditBalance), 0) as totalCredit
      FROM customers
      WHERE creditBalance > 0
    `) as { totalCredit: number };

    return result?.totalCredit || 0;
  }

  /**
   * Get credit balance for specific customer
   */
  async getCustomerCreditBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(`
      SELECT COALESCE(creditBalance, 0) as creditBalance 
      FROM customers 
      WHERE id = ?
    `, [customerId]) as { creditBalance: number };

    return result?.creditBalance || 0;
  }

  /**
   * Process credit collection/clearance using unified payment flow
   */
  async collectCredit(collectionData: CreditCollectionData): Promise<{
    receipt: any;
    toastMessage: string;
  }> {
    const { customerId, amount, paymentComponents, remarks } = collectionData;

    // Validate collection amount
    const currentBalance = await this.getCustomerCreditBalance(customerId);
    if (amount > currentBalance) {
      throw new Error(`Collection amount (₹${amount}) exceeds credit balance (₹${currentBalance})`);
    }

    // Convert to payment components format
    const components = paymentComponents.map(comp => ({
      mode: comp.type === 'Cash' ? PaymentMode.CASH : PaymentMode.UPI,
      amount: comp.amount
    }));

    // Validate components sum to total
    const componentSum = components.reduce((sum, c) => sum + c.amount, 0);
    if (Math.abs(componentSum - amount) > 0.01) {
      throw new Error("Payment components do not sum to collection amount");
    }

    // Use enhanced payment service for credit clearance
    const result = await enhancedPaymentService.clearCredit({
      customerId,
      components,
      remarks
    });

    // Update global credit state after successful collection
    const newBalance = currentBalance - amount;
    if (newBalance <= 0) {
      creditStateActions.removeCustomerCredit(customerId);
    } else {
      creditStateActions.updateCustomerCredit(customerId, newBalance);
    }

    // Trigger refresh across all screens
    creditStateActions.triggerRefresh();

    return result;
  }

  /**
   * Get customer credit transaction history
   */
  async getCreditHistory(customerId: string): Promise<Array<{
    id: string;
    type: 'Credit' | 'CreditClear';
    amount: number;
    remarks: string | null;
    createdAt: string;
  }>> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getAllAsync(`
      SELECT 
        id,
        mode as type,
        amount,
        remarks,
        createdAt
      FROM payments
      WHERE customerId = ? 
        AND mode IN (?, ?)
      ORDER BY createdAt DESC
    `, [customerId, PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR]) as any[];

    return result;
  }

  /**
   * Get revenue metrics from paid transactions (non-credit)
   */
  async getRevenueMetrics(startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    cashRevenue: number;
    upiRevenue: number;
    transactionCount: number;
  }> {
    if (!db) throw new Error("Database not initialized");

    let dateFilter = '';
    const params: any[] = [];

    if (startDate && endDate) {
      dateFilter = 'AND DATE(p.createdAt) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const result = await db.getFirstAsync(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.mode NOT IN (?, ?) THEN p.amount ELSE 0 END), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN p.mode = ? THEN p.amount ELSE 0 END), 0) as cashRevenue,
        COALESCE(SUM(CASE WHEN p.mode = ? THEN p.amount ELSE 0 END), 0) as upiRevenue,
        COUNT(CASE WHEN p.mode NOT IN (?, ?) THEN 1 END) as transactionCount
      FROM payments p
      WHERE 1=1 ${dateFilter}
    `, [PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR, PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR, ...params]) as any;

    return {
      totalRevenue: result?.totalRevenue || 0,
      cashRevenue: result?.cashRevenue || 0,
      upiRevenue: result?.upiRevenue || 0,
      transactionCount: result?.transactionCount || 0,
    };
  }

  /**
   * Load and update global credit state
   */
  async loadAndUpdateCreditState(): Promise<void> {
    try {
      creditStateActions.setLoading(true);
      creditStateActions.clearError();

      const [customers, totalBalance] = await Promise.all([
        this.getCustomersWithCredit(),
        this.getTotalCreditBalance()
      ]);

      creditStateActions.setCreditData({
        totalCreditBalance: totalBalance,
        customersWithCredit: customers, // Use full CustomerCredit objects
      });
    } catch (error: any) {
      console.error("Error loading credit state:", error);
      creditStateActions.setError(error.message || "Failed to load credit data");
    } finally {
      creditStateActions.setLoading(false);
    }
  }
}

export const creditService = new CreditService();
