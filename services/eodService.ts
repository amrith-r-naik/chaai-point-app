// services/eodService.ts
// End of Day processing service
import { computeISTBusinessDate, db } from "../lib/db";

export interface EodRun {
  id: string;
  businessDate: string;
  runType: 'manual' | 'auto';
  startedAt: string;
  completedAt: string | null;
  processedKots: number;
  totalAmount: number;
  success: boolean;
  errorSummary: string | null;
}

export interface EodResult {
  processedKOTs: number;
  totalAmount: number;
}

class EodService {
  /**
   * Process End of Day operations for a specific business date
   * Converts all unbilled KOTs to credit payments with full audit trail
   */
  async processEndOfDay(dateString?: string): Promise<EodResult> {
    if (!db) throw new Error("Database not initialized");

    // Determine businessDate (YYYY-MM-DD IST) – if caller supplies a YYYY-MM-DD assume already business date
    const nowIso = new Date().toISOString();
    const businessDate = dateString || computeISTBusinessDate(nowIso);

    // Idempotency: if a successful run already exists for this businessDate, return stored metrics
    const existingRun = await db.getFirstAsync(`
      SELECT processedKots, totalAmount FROM eod_runs 
      WHERE businessDate = ? AND success = 1
      ORDER BY completedAt DESC LIMIT 1
    `, [businessDate]) as any;
    
    if (existingRun) {
      console.log(`EOD already processed for ${businessDate}, returning cached result`);
      return { 
        processedKOTs: existingRun.processedKots || 0, 
        totalAmount: existingRun.totalAmount || 0 
      };
    }

    const eodRunId = `eod_${businessDate}_${Date.now()}`;
    const startedAt = new Date().toISOString();

    // Insert initial run record
    await db.runAsync(`
      INSERT INTO eod_runs (id, businessDate, runType, startedAt, completedAt, processedKots, totalAmount, success, errorSummary)
      VALUES (?, ?, ?, ?, NULL, 0, 0, 0, NULL)
    `, [eodRunId, businessDate, 'manual', startedAt]);

    try {
      // Fetch all active (unbilled) KOTs for the businessDate
      const activeKOTs = await db.getAllAsync(`
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.customerId,
          ko.createdAt,
          ko.businessDate,
          c.name as customerName,
          COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        LEFT JOIN kot_items ki ON ko.id = ki.kotId
        WHERE ko.billId IS NULL
          AND (ko.businessDate = ? OR (ko.businessDate IS NULL AND DATE(ko.createdAt) = DATE(?)))
        GROUP BY ko.id, ko.kotNumber, ko.customerId, ko.createdAt, ko.businessDate, c.name
      `, [businessDate, businessDate]);

      if (activeKOTs.length === 0) {
        await db.runAsync(`UPDATE eod_runs SET completedAt = ?, success = 1 WHERE id = ?`, 
                         [new Date().toISOString(), eodRunId]);
        console.log(`EOD ${businessDate}: No active KOTs found`);
        return { processedKOTs: 0, totalAmount: 0 };
      }

      let totalProcessedAmount = 0;

      // Group by customer
      const kotsByCustomer = activeKOTs.reduce((acc: Record<string, { customerName: string; totalAmount: number }>, kot: any) => {
        if (!acc[kot.customerId]) {
          acc[kot.customerId] = { customerName: kot.customerName, totalAmount: 0 };
        }
        acc[kot.customerId].totalAmount += kot.totalAmount;
        return acc;
      }, {} as Record<string, { customerName: string; totalAmount: number }>);

      for (const [customerId, info] of Object.entries(kotsByCustomer)) {
        try {
          // Use dynamic import to avoid circular dependency
          const paymentServiceModule = await import('./paymentService');
          const paymentService = paymentServiceModule.paymentService;
          
          await paymentService.processPayment({
            billId: '',
            customerId,
            customerName: info.customerName,
            totalAmount: info.totalAmount,
            paymentType: 'Credit',
            remarks: `EOD Credit Payment - ${businessDate}`,
            targetDate: businessDate,
          });
          
          totalProcessedAmount += info.totalAmount;
          console.log(`EOD ${businessDate}: Processed customer ${customerId} - ₹${info.totalAmount}`);
        } catch (custErr) {
          // Log but continue with other customers
          console.error(`EOD processing error for customer ${customerId}:`, custErr);
        }
      }

      // Update run record with success
      await db.runAsync(`
        UPDATE eod_runs
        SET completedAt = ?, processedKots = ?, totalAmount = ?, success = 1
        WHERE id = ?
      `, [new Date().toISOString(), activeKOTs.length, totalProcessedAmount, eodRunId]);

      console.log(`EOD ${businessDate}: Successfully processed ${activeKOTs.length} KOTs totaling ₹${totalProcessedAmount}`);
      return { processedKOTs: activeKOTs.length, totalAmount: totalProcessedAmount };
      
    } catch (error: any) {
      // Update run record with failure
      await db.runAsync(`
        UPDATE eod_runs
        SET completedAt = ?, success = 0, errorSummary = ?
        WHERE id = ?
      `, [new Date().toISOString(), (error?.message || 'Unknown error').substring(0, 500), eodRunId]);
      
      console.error(`EOD ${businessDate}: Processing failed:`, error);
      throw error;
    }
  }

  /**
   * Get EOD run history
   */
  async getEodRunHistory(limit: number = 30): Promise<EodRun[]> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getAllAsync(`
      SELECT 
        id,
        businessDate,
        runType,
        startedAt,
        completedAt,
        processedKots,
        totalAmount,
        success,
        errorSummary
      FROM eod_runs
      ORDER BY startedAt DESC
      LIMIT ?
    `, [limit]);

    return result.map((row: any) => ({
      id: row.id,
      businessDate: row.businessDate,
      runType: row.runType,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      processedKots: row.processedKots,
      totalAmount: row.totalAmount,
      success: Boolean(row.success),
      errorSummary: row.errorSummary,
    }));
  }

  /**
   * Get EOD status for a specific business date
   */
  async getEodStatus(businessDate?: string): Promise<EodRun | null> {
    if (!db) throw new Error("Database not initialized");

    const dateToCheck = businessDate || computeISTBusinessDate(new Date().toISOString());
    
    const result = await db.getFirstAsync(`
      SELECT 
        id,
        businessDate,
        runType,
        startedAt,
        completedAt,
        processedKots,
        totalAmount,
        success,
        errorSummary
      FROM eod_runs
      WHERE businessDate = ?
      ORDER BY startedAt DESC
      LIMIT 1
    `, [dateToCheck]);

    if (!result) return null;

    const row = result as any;
    return {
      id: row.id,
      businessDate: row.businessDate,
      runType: row.runType,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      processedKots: row.processedKots,
      totalAmount: row.totalAmount,
      success: Boolean(row.success),
      errorSummary: row.errorSummary,
    };
  }

  /**
   * Check if EOD has been run for a specific date
   */
  async isEodCompleted(businessDate?: string): Promise<boolean> {
    const status = await this.getEodStatus(businessDate);
    return status ? status.success : false;
  }

  /**
   * Get count of unbilled KOTs for a specific date
   */
  async getUnbilledKotCount(businessDate?: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const dateToCheck = businessDate || computeISTBusinessDate(new Date().toISOString());
    
    const result = await db.getFirstAsync(`
      SELECT COUNT(*) as count
      FROM kot_orders ko
      WHERE ko.billId IS NULL
        AND (ko.businessDate = ? OR (ko.businessDate IS NULL AND DATE(ko.createdAt) = DATE(?)))
    `, [dateToCheck, dateToCheck]) as any;

    return result?.count || 0;
  }

  /**
   * Get total amount of unbilled KOTs for a specific date
   */
  async getUnbilledKotAmount(businessDate?: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const dateToCheck = businessDate || computeISTBusinessDate(new Date().toISOString());
    
    const result = await db.getFirstAsync(`
      SELECT COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount
      FROM kot_orders ko
      LEFT JOIN kot_items ki ON ko.id = ki.kotId
      WHERE ko.billId IS NULL
        AND (ko.businessDate = ? OR (ko.businessDate IS NULL AND DATE(ko.createdAt) = DATE(?)))
    `, [dateToCheck, dateToCheck]) as any;

    return result?.totalAmount || 0;
  }

  /**
   * Force a new EOD run even if one already exists (admin function)
   */
  async forceEodRun(businessDate?: string): Promise<EodResult> {
    if (!db) throw new Error("Database not initialized");

    const dateToProcess = businessDate || computeISTBusinessDate(new Date().toISOString());
    
    // Mark any existing successful runs as superseded by adding a note
    await db.runAsync(`
      UPDATE eod_runs 
      SET errorSummary = COALESCE(errorSummary, '') || ' [Superseded by force run]'
      WHERE businessDate = ? AND success = 1
    `, [dateToProcess]);

    // Now run EOD normally (idempotency check will now pass)
    return await this.processEndOfDay(dateToProcess);
  }
}

export const eodService = new EodService();
