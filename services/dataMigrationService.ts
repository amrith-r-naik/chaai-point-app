import { PaymentMode } from "@/constants/paymentConstants";
import { db } from "@/lib/db";

/**
 * Data Migration Service - Handle transition from legacy to unified payment flow
 * Provides utilities to migrate existing data and validate data integrity
 */

interface MigrationResult {
  success: boolean;
  migratedRecords: number;
  errors: string[];
  summary: string;
}

class DataMigrationService {
  
  /**
   * Validate data consistency between old and new payment systems
   */
  async validateDataConsistency(): Promise<{
    creditBalanceConsistency: boolean;
    paymentRecordConsistency: boolean;
    billKotLinkageConsistency: boolean;
    errors: string[];
  }> {
    if (!db) throw new Error("Database not initialized");

    const errors: string[] = [];
    let creditBalanceConsistency = true;
    let paymentRecordConsistency = true;
    let billKotLinkageConsistency = true;

    try {
      // 1. Check credit balance consistency
      const creditCheck = await db.getAllAsync(`
        SELECT 
          c.id,
          c.name,
          COALESCE(c.creditBalance, 0) as storedBalance,
          COALESCE(SUM(CASE WHEN p.mode = ? THEN p.amount ELSE 0 END), 0) as creditAccrual,
          COALESCE(SUM(CASE WHEN p.mode = ? THEN p.amount ELSE 0 END), 0) as creditClearance
        FROM customers c
        LEFT JOIN payments p ON c.id = p.customerId
        GROUP BY c.id, c.name, c.creditBalance
        HAVING COALESCE(c.creditBalance, 0) != (creditAccrual - creditClearance)
      `, [PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR]);

      if (creditCheck.length > 0) {
        creditBalanceConsistency = false;
        errors.push(`Credit balance mismatch for ${creditCheck.length} customers`);
      }

      // 2. Check payment records have valid modes
      const invalidPayments = await db.getAllAsync(`
        SELECT id, mode FROM payments
        WHERE mode NOT IN (?, ?, ?, ?)
      `, [PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR]);

      if (invalidPayments.length > 0) {
        paymentRecordConsistency = false;
        errors.push(`${invalidPayments.length} payments with invalid modes`);
      }

      // 3. Check KOT-Bill linkage
      const orphanedKots = await db.getAllAsync(`
        SELECT ko.id FROM kot_orders ko
        LEFT JOIN bills b ON ko.billId = b.id
        WHERE ko.billId IS NOT NULL AND b.id IS NULL
      `);

      if (orphanedKots.length > 0) {
        billKotLinkageConsistency = false;
        errors.push(`${orphanedKots.length} KOTs linked to non-existent bills`);
      }

    } catch (error: any) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      creditBalanceConsistency,
      paymentRecordConsistency,
      billKotLinkageConsistency,
      errors
    };
  }

  /**
   * Migrate legacy payment modes to new unified modes
   */
  async migratePaymentModes(): Promise<MigrationResult> {
    if (!db) throw new Error("Database not initialized");

    const errors: string[] = [];
    let migratedRecords = 0;

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // Map legacy payment modes to new enum values
      const modeMapping = {
        'cash': PaymentMode.CASH,
        'Cash': PaymentMode.CASH,
        'CASH': PaymentMode.CASH,
        'upi': PaymentMode.UPI,
        'UPI': PaymentMode.UPI,
        'credit': PaymentMode.CREDIT,
        'Credit': PaymentMode.CREDIT,
        'CREDIT': PaymentMode.CREDIT,
      };

      for (const [oldMode, newMode] of Object.entries(modeMapping)) {
        const result = await db.runAsync(`
          UPDATE payments SET mode = ? WHERE mode = ?
        `, [newMode, oldMode]);
        
        migratedRecords += result.changes || 0;
      }

      // Update receipts table as well
      for (const [oldMode, newMode] of Object.entries(modeMapping)) {
        const result = await db.runAsync(`
          UPDATE receipts SET mode = ? WHERE mode = ?
        `, [newMode, oldMode]);
        
        migratedRecords += result.changes || 0;
      }

      await db.execAsync('COMMIT');

      return {
        success: true,
        migratedRecords,
        errors,
        summary: `Successfully migrated ${migratedRecords} payment records to unified modes`
      };

    } catch (error: any) {
      await db.execAsync('ROLLBACK');
      errors.push(`Migration error: ${error.message}`);
      
      return {
        success: false,
        migratedRecords: 0,
        errors,
        summary: `Migration failed: ${error.message}`
      };
    }
  }

  /**
   * Reconcile customer credit balances from payment history
   */
  async reconcileCreditBalances(): Promise<MigrationResult> {
    if (!db) throw new Error("Database not initialized");

    const errors: string[] = [];
    let migratedRecords = 0;

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // Recalculate credit balances from payment history
      const customers = await db.getAllAsync(`
        SELECT 
          c.id,
          c.name,
          COALESCE(SUM(CASE WHEN p.mode = ? THEN p.amount ELSE 0 END), 0) as creditAccrual,
          COALESCE(SUM(CASE WHEN p.mode = ? THEN p.amount ELSE 0 END), 0) as creditClearance
        FROM customers c
        LEFT JOIN payments p ON c.id = p.customerId
        GROUP BY c.id, c.name
      `, [PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR]) as any[];

      for (const customer of customers) {
        const correctBalance = customer.creditAccrual - customer.creditClearance;
        
        await db.runAsync(`
          UPDATE customers SET creditBalance = ? WHERE id = ?
        `, [correctBalance, customer.id]);
        
        migratedRecords++;
      }

      await db.execAsync('COMMIT');

      return {
        success: true,
        migratedRecords,
        errors,
        summary: `Successfully reconciled credit balances for ${migratedRecords} customers`
      };

    } catch (error: any) {
      await db.execAsync('ROLLBACK');
      errors.push(`Reconciliation error: ${error.message}`);
      
      return {
        success: false,
        migratedRecords: 0,
        errors,
        summary: `Reconciliation failed: ${error.message}`
      };
    }
  }

  /**
   * Generate migration report for analysis
   */
  async generateMigrationReport(): Promise<{
    totalCustomers: number;
    customersWithCredit: number;
    totalPayments: number;
    paymentsByMode: Record<string, number>;
    totalKots: number;
    billedKots: number;
    unbilledKots: number;
    dataIssues: string[];
  }> {
    if (!db) throw new Error("Database not initialized");

    const dataIssues: string[] = [];

    // Get basic statistics
    const totalCustomers = (await db.getFirstAsync(`SELECT COUNT(*) as count FROM customers`) as any)?.count || 0;
    
    const customersWithCredit = (await db.getFirstAsync(`
      SELECT COUNT(*) as count FROM customers WHERE COALESCE(creditBalance, 0) > 0
    `) as any)?.count || 0;

    const totalPayments = (await db.getFirstAsync(`SELECT COUNT(*) as count FROM payments`) as any)?.count || 0;

    // Payment mode distribution
    const paymentModes = await db.getAllAsync(`
      SELECT mode, COUNT(*) as count FROM payments GROUP BY mode
    `) as any[];
    
    const paymentsByMode = paymentModes.reduce((acc, row) => {
      acc[row.mode] = row.count;
      return acc;
    }, {} as Record<string, number>);

    const totalKots = (await db.getFirstAsync(`SELECT COUNT(*) as count FROM kot_orders`) as any)?.count || 0;
    
    const billedKots = (await db.getFirstAsync(`
      SELECT COUNT(*) as count FROM kot_orders WHERE billId IS NOT NULL
    `) as any)?.count || 0;
    
    const unbilledKots = totalKots - billedKots;

    // Check for data issues
    const validation = await this.validateDataConsistency();
    dataIssues.push(...validation.errors);

    return {
      totalCustomers,
      customersWithCredit,
      totalPayments,
      paymentsByMode,
      totalKots,
      billedKots,
      unbilledKots,
      dataIssues
    };
  }

  /**
   * Run full migration process
   */
  async runFullMigration(): Promise<{
    success: boolean;
    results: MigrationResult[];
    finalReport: any;
  }> {
    const results: MigrationResult[] = [];

    try {
      // 1. Migrate payment modes
      const modeResult = await this.migratePaymentModes();
      results.push(modeResult);

      // 2. Reconcile credit balances
      const creditResult = await this.reconcileCreditBalances();
      results.push(creditResult);

      // 3. Generate final report
      const finalReport = await this.generateMigrationReport();

      const success = results.every(r => r.success);

      return {
        success,
        results,
        finalReport
      };

    } catch (error: any) {
      results.push({
        success: false,
        migratedRecords: 0,
        errors: [error.message],
        summary: `Full migration failed: ${error.message}`
      });

      return {
        success: false,
        results,
        finalReport: null
      };
    }
  }
}

export const dataMigrationService = new DataMigrationService();
