// services/billingService.ts
// Billing responsibilities extracted from paymentService (future expansion)
import { computeISTBusinessDate, db } from '@/lib/db';
import uuid from 'react-native-uuid';

export interface BillingResult {
  billId: string;
  billNumber: string;
  businessDate: string;
  createdAt: string;
}

class BillingService {
  private async getOrInitSequence(key: string, seedSql?: string): Promise<number> {
    if (!db) throw new Error('Database not initialized');
    await db.runAsync(`INSERT OR IGNORE INTO sequences (key, value) VALUES (?, 0)`, [key]);
    if (seedSql) {
      const row = await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [key]) as any;
      if (row.value === 0) {
        const maxRow = await db.getFirstAsync(seedSql) as any;
        const maxVal = maxRow?.maxVal ? Number(maxRow.maxVal) : 0;
        if (maxVal > 0) {
          await db.runAsync(`UPDATE sequences SET value = ? WHERE key = ?`, [maxVal, key]);
        }
      }
    }
    const newRow = await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [key]) as any;
    return newRow.value;
  }

  private async nextSequence(key: string, seedSql?: string): Promise<number> {
    if (!db) throw new Error('Database not initialized');
    await this.getOrInitSequence(key, seedSql);
    await db.runAsync(`UPDATE sequences SET value = value + 1 WHERE key = ?`, [key]);
    const row = await db.getFirstAsync(`SELECT value FROM sequences WHERE key = ?`, [key]) as any;
    return row.value;
  }

  async createBill(customerId: string, total: number) : Promise<BillingResult> {
    if (!db) throw new Error('Database not initialized');
    const createdAt = new Date().toISOString();
    const businessDate = computeISTBusinessDate(createdAt);
    const billNumberSeq = await this.nextSequence('bill', `SELECT MAX(billNumber) as maxVal FROM bills`);
    const billNumber = billNumberSeq.toString().padStart(6,'0');
    const billId = uuid.v4() as string;

    await db.runAsync(`INSERT INTO bills (id, billNumber, customerId, total, createdAt, businessDate) VALUES (?, ?, ?, ?, ?, ?)`,
      [billId, billNumber, customerId, total, createdAt, businessDate]);

    return { billId, billNumber, businessDate, createdAt };
  }
}

export const billingService = new BillingService();
