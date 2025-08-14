import { db, withTransaction } from "@/lib/db";
import { SplitPayment } from "@/types/payment";
import uuid from "react-native-uuid";

export interface Bill {
  id: string;
  billNumber: string;
  customerId: string;
  total: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  billId: string | null;
  customerId: string;
  amount: number;
  mode: string;
  subType?: string | null; // Accrual / Clearance
  remarks: string | null;
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  customerId: string;
  billId?: string | null;
  amount: number;
  mode: string;
  remarks: string | null;
  createdAt: string;
}

export interface PaymentProcessData {
  billId: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paymentType: string;
  splitPayments?: SplitPayment[];
  remarks?: string;
  targetDate?: string; // For EOD processing
}

class PaymentService {
  private schemaChecked = false;

  private async ensureSchemaUpgrades() {
    if (!db || this.schemaChecked) return;
    // Check for new columns (billId on receipts, subType on payments)
    const receiptsInfo = await db.getAllAsync(`PRAGMA table_info(receipts)` ) as any[];
    const paymentsInfo = await db.getAllAsync(`PRAGMA table_info(payments)` ) as any[];
    const receiptsHasBillId = receiptsInfo.some(c => c.name === 'billId');
    const paymentsHasSubType = paymentsInfo.some(c => c.name === 'subType');
    if (!receiptsHasBillId) {
      await db.execAsync(`ALTER TABLE receipts ADD COLUMN billId TEXT REFERENCES bills(id);`);
    }
    if (!paymentsHasSubType) {
      await db.execAsync(`ALTER TABLE payments ADD COLUMN subType TEXT;`);
    }
    this.schemaChecked = true;
  }
  private async getNextReceiptNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    const result = await db.getFirstAsync(`
      SELECT MAX(receiptNo) as maxReceiptNo FROM receipts
      WHERE strftime('%Y', createdAt) = ?
    `, [currentYear.toString()]) as { maxReceiptNo: number | null };
    
    const nextNumber = (result?.maxReceiptNo || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }

  private async getNextBillNumber(): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    const result = await db.getFirstAsync(`
      SELECT MAX(billNumber) as maxBillNumber FROM bills
      WHERE strftime('%Y', createdAt) = ?
    `, [currentYear.toString()]) as { maxBillNumber: number | null };
    
    const nextNumber = (result?.maxBillNumber || 0) + 1;
    return nextNumber.toString().padStart(6, '0');
  }

  async createBill(customerId: string, totalAmount: number): Promise<Bill> {
    if (!db) throw new Error("Database not initialized");

    const billNumber = await this.getNextBillNumber();
    const bill: Bill = {
      id: uuid.v4() as string,
      billNumber,
      customerId,
      total: totalAmount, // Store in rupees (direct KOT total)
      createdAt: new Date().toISOString(),
    };

    await db.runAsync(`
      INSERT INTO bills (id, billNumber, customerId, total, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [bill.id, bill.billNumber, bill.customerId, bill.total, bill.createdAt]);

    return bill;
  }

  async processPayment(paymentData: PaymentProcessData): Promise<{ receipt: Receipt; bill: Bill; paidPortion: number; creditPortion: number; }> {
    if (!db) throw new Error("Database not initialized");
  await this.ensureSchemaUpgrades();
    // This function no longer handles pure credit; use processCreditSale for that path.
    return await withTransaction(async () => {
      const bill = await this.createBill(paymentData.customerId, paymentData.totalAmount);
      const now = new Date().toISOString();
      const receiptNo = await this.getNextReceiptNumber();

      let paidPortion = 0;
      let creditPortion = 0;
      let splitParts: SplitPayment[] | undefined = undefined;
      if (paymentData.paymentType === 'Split' && paymentData.splitPayments) {
        // Normalize/merge duplicate types
        splitParts = this.mergeSplitParts(paymentData.splitPayments);
        for (const part of splitParts) {
          if (part.type === 'Credit') creditPortion += part.amount; else paidPortion += part.amount;
        }
      } else if (paymentData.paymentType === 'Credit') {
        creditPortion = paymentData.totalAmount;
      } else {
        paidPortion = paymentData.totalAmount;
      }

      // Receipt should represent only the paid portion (cash/upi/etc). If fully credit, we shouldn't be here.
      const receipt: Receipt = {
        id: uuid.v4() as string,
        receiptNo,
        customerId: paymentData.customerId,
        billId: bill.id as any, // augmented at runtime
        amount: paidPortion,
        mode: paymentData.paymentType,
        remarks: paymentData.remarks || null,
        createdAt: now,
      } as any;

  await db!.runAsync(`
        INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [receipt.id, receipt.receiptNo, receipt.customerId, bill.id, receipt.amount, receipt.mode, receipt.remarks, receipt.createdAt]);

      // Persist payment rows
      if (paymentData.paymentType === 'Split' && splitParts) {
        for (const part of splitParts) {
          const pay: Payment = {
            id: uuid.v4() as string,
            billId: bill.id,
            customerId: paymentData.customerId,
            amount: part.amount,
            mode: part.type,
            remarks: paymentData.remarks || null,
            createdAt: now,
          };
          await db!.runAsync(`
            INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [pay.id, pay.billId, pay.customerId, pay.amount, pay.mode, (part.type === 'Credit' ? 'Accrual' : null), pay.remarks, pay.createdAt]);
          if (part.type === 'Credit') await this.updateCustomerCredit(paymentData.customerId, part.amount);
        }
        // Store split meta (retain existing table usage) for UI referencing original intent
        for (const part of splitParts) {
          const splitId = uuid.v4() as string;
          await db!.runAsync(`
            INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `, [splitId, receipt.id, part.type, part.amount, now]);
      }
      } else {
        // Single mode (non-credit because credit-only path should use processCreditSale)
        const pay: Payment = {
          id: uuid.v4() as string,
          billId: bill.id,
          customerId: paymentData.customerId,
          amount: paidPortion,
          mode: paymentData.paymentType,
          remarks: paymentData.remarks || null,
          createdAt: now,
        };
  await db!.runAsync(`
          INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [pay.id, pay.billId, pay.customerId, pay.amount, pay.mode, null, pay.remarks, pay.createdAt]);
      }

      await this.linkKOTsToBill(paymentData.customerId, bill.id, paymentData.targetDate);
      return { receipt, bill, paidPortion, creditPortion };
    });
  }

  private async linkKOTsToBill(customerId: string, billId: string, targetDate?: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // Use provided date or today's date for filtering KOTs
    const dateToUse = targetDate || new Date().toISOString().split('T')[0];
    
    await db.runAsync(`
      UPDATE kot_orders 
      SET billId = ? 
      WHERE customerId = ? 
        AND billId IS NULL 
        AND DATE(createdAt) = DATE(?)
    `, [billId, customerId, dateToUse]);
  }

  // Public method for pure credit sale: create bill, update credit, NO receipt row
  async processCreditSale(customerId: string, customerName: string, totalAmount: number, remarks?: string): Promise<{ bill: Bill }> {
    if (!db) throw new Error('Database not initialized');
  await this.ensureSchemaUpgrades();
    // Create bill so KOTs can link and stats remain accurate
    const bill = await this.createBill(customerId, totalAmount);
    await this.updateCustomerCredit(customerId, totalAmount);
    // Record a payment row (mode Credit) for audit
    const payment: Payment = {
      id: uuid.v4() as string,
      billId: bill.id,
      customerId,
      amount: totalAmount,
      mode: 'Credit',
      remarks: remarks || null,
      createdAt: new Date().toISOString(),
    };
    await db.runAsync(`
      INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, 'Accrual', payment.remarks, payment.createdAt]);
    // Link KOTs created today (reuse logic)
  await this.linkKOTsToBill(customerId, bill.id);
    return { bill };
  }

  private async updateCustomerCredit(customerId: string, amount: number): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    // Column guaranteed in schema; just update
    await db.runAsync(`
      UPDATE customers 
      SET creditBalance = COALESCE(creditBalance, 0) + ?
      WHERE id = ?
    `, [amount, customerId]); // Store direct amount (already in rupees)
  }

  async getCustomerCreditBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = await db.getFirstAsync(`
      SELECT COALESCE(creditBalance, 0) as creditBalance FROM customers WHERE id = ?
    `, [customerId]) as { creditBalance: number };

    return (result?.creditBalance || 0); // Use direct credit balance (already in rupees)
  }

  async getReceipt(receiptId: string): Promise<Receipt | null> {
    if (!db) throw new Error("Database not initialized");

    const receipt = await db.getFirstAsync(`
      SELECT * FROM receipts WHERE id = ?
    `, [receiptId]) as Receipt | null;

    if (receipt) {
      receipt.amount = receipt.amount; // Use direct amount (already in rupees)
    }

    return receipt;
  }

  async getPaymentHistory(customerId: string): Promise<Payment[]> {
    if (!db) throw new Error("Database not initialized");

    const payments = await db.getAllAsync(`
  SELECT * FROM payments 
      WHERE customerId = ? 
      ORDER BY createdAt DESC
    `, [customerId]) as Payment[];

    return payments.map(payment => ({
      ...payment,
      amount: payment.amount // Use direct amount (already in rupees)
    }));
  }

  async getCompletedBillsGroupedByDate(): Promise<
    Record<
      string,
      {
        date: string;
        displayDate: string;
        bills: Array<{
          id: string;
          billNumber: string;
          receiptNo: string;
          customerId: string;
          customerName: string;
          customerContact: string | null;
          amount: number;
          mode: string;
          remarks: string | null;
          createdAt: string;
        }>;
      }
    >
  > {
    if (!db) throw new Error("Database not initialized");

    const bills = await db.getAllAsync(`
      SELECT 
        r.id,
        r.receiptNo,
        r.customerId,
        r.amount,
        r.mode,
        r.remarks,
        r.createdAt,
        c.name as customerName,
        c.contact as customerContact,
        b.billNumber
      FROM receipts r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN bills b ON r.customerId = b.customerId 
        AND DATE(r.createdAt) = DATE(b.createdAt)
      ORDER BY r.createdAt DESC
    `) as any[];

    const dateGroups: Record<string, any> = {};

    bills.forEach((bill: any) => {
      const billDate = bill.createdAt.split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      let displayDate: string;
      if (billDate === today) {
        displayDate = "Today";
      } else if (billDate === yesterday) {
        displayDate = "Yesterday";
      } else {
        const date = new Date(billDate);
        const options: Intl.DateTimeFormatOptions = {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          weekday: "long",
        };
        displayDate = date.toLocaleDateString("en-GB", options);
      }

      if (!dateGroups[billDate]) {
        dateGroups[billDate] = {
          date: billDate,
          displayDate,
          bills: [],
        };
      }

      dateGroups[billDate].bills.push({
        id: bill.id,
        billNumber: bill.billNumber || 'N/A',
        receiptNo: bill.receiptNo,
        customerId: bill.customerId,
        customerName: bill.customerName,
        customerContact: bill.customerContact,
        amount: bill.amount, // Use direct amount from receipts (already in rupees)
        mode: bill.mode,
        remarks: bill.remarks,
        createdAt: bill.createdAt,
      });
    });

    return dateGroups;
  }

  async getBillDetails(receiptId: string): Promise<{
    receipt: Receipt;
    customer: any;
    kots: any[];
    splitPayments?: any[];
  } | null> {
    if (!db) throw new Error("Database not initialized");

    // Get receipt details
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) return null;

    // Get customer details
    const customer = await db.getFirstAsync(`
      SELECT * FROM customers WHERE id = ?
    `, [receipt.customerId]) as any;

    // Get split payment details
    const splitPayments = await db.getAllAsync(`
      SELECT * FROM split_payments WHERE receiptId = ?
      ORDER BY createdAt
    `, [receiptId]) as any[];

    // Get related bill
    const bill = await db.getFirstAsync(`
      SELECT * FROM bills 
      WHERE customerId = ? 
        AND DATE(createdAt) = DATE(?)
      ORDER BY createdAt DESC
      LIMIT 1
    `, [receipt.customerId, receipt.createdAt]) as any;

    let kots: any[] = [];
    if (bill) {
      // Get KOTs linked to this bill
      kots = await db.getAllAsync(`
        SELECT 
          ko.id,
          ko.kotNumber,
          ko.createdAt,
          GROUP_CONCAT(mi.name || ' x' || ki.quantity, ', ') as items,
          SUM(ki.quantity * ki.priceAtTime) as total
        FROM kot_orders ko
        LEFT JOIN kot_items ki ON ko.id = ki.kotId
        LEFT JOIN menu_items mi ON ki.itemId = mi.id
        WHERE ko.billId = ?
        GROUP BY ko.id, ko.kotNumber, ko.createdAt
        ORDER BY ko.createdAt
      `, [bill.id]) as any[];

      kots = kots.map(kot => ({
        ...kot,
        total: kot.total || 0
      }));
    }

    return {
      receipt,
      customer,
      kots,
      splitPayments: splitPayments.length > 0 ? splitPayments : undefined,
    };
  }

  async getCustomerReceipts(customerId: string): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      const receipts = await db.getAllAsync(`
        SELECT * FROM receipts 
        WHERE customerId = ?
        ORDER BY createdAt DESC
      `, [customerId]) as any[];

      return receipts;
    } catch (error) {
      console.error("Error fetching customer receipts:", error);
      return [];
    }
  }

  // Phase 1 additions
  private mergeSplitParts(parts: SplitPayment[]): SplitPayment[] {
    const map: Record<string, number> = {};
    for (const p of parts) {
      map[p.type] = (map[p.type] || 0) + p.amount;
    }
  return Object.entries(map).map(([type, amount]) => ({ id: type, type, amount })) as SplitPayment[];
  }

  // Process a credit clearance using normal payment-like flow. Creates a receipt with no billId and payment rows with subType='Clearance'.
  async processCreditClearance(customerId: string, splits: SplitPayment[], remarks?: string): Promise<{ receipt: Receipt; paidTotal: number; }>{
    if (!db) throw new Error("Database not initialized");
    await this.ensureSchemaUpgrades();
    // Validate: only Cash/UPI allowed in splits; sum > 0
    const invalid = splits.some(s => s.type === 'Credit' || s.amount <= 0);
    if (invalid) throw new Error('Invalid clearance splits');
    const paidTotal = splits.reduce((s, p) => s + p.amount, 0);
    if (paidTotal <= 0) throw new Error('Clearance amount must be > 0');

    const now = new Date().toISOString();
    const receiptNo = await this.getNextReceiptNumber();
    const receipt: Receipt = {
      id: uuid.v4() as string,
      receiptNo,
      customerId,
      billId: null,
      amount: paidTotal,
      mode: splits.length > 1 ? 'Split' : splits[0].type,
      remarks: remarks ?? 'Credit Clearance',
      createdAt: now,
    };

    await withTransaction(async () => {
      // Insert receipt
      await db!.runAsync(`
        INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [receipt.id, receipt.receiptNo, receipt.customerId, null, receipt.amount, receipt.mode, receipt.remarks, receipt.createdAt]);

      // Insert payments (subType Clearance) and decrease credit balance
      for (const part of splits) {
        await db!.runAsync(`
          INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [uuid.v4() as string, null, customerId, part.amount, part.type, 'Clearance', receipt.remarks, now]);
      }
      await db!.runAsync(`
        UPDATE customers SET creditBalance = COALESCE(creditBalance,0) - ? WHERE id = ?
      `, [paidTotal, customerId]);

      // Store split meta for UI
      for (const part of splits) {
        const splitId = uuid.v4() as string;
        await db!.runAsync(`
          INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `, [splitId, receipt.id, part.type, part.amount, now]);
      }
    });

    return { receipt, paidTotal };
  }

  async recordCreditClearance(customerId: string, amount: number, mode: string, remarks?: string) {
    if (!db) throw new Error("Database not initialized");
  await this.ensureSchemaUpgrades();
    return withTransaction(async () => {
      // Decrement customer credit (store negative increment)
      await db!.runAsync(`
        UPDATE customers SET creditBalance = COALESCE(creditBalance,0) - ? WHERE id = ?
      `, [amount, customerId]);
      const payment: Payment = {
        id: uuid.v4() as string,
        billId: null,
        customerId,
        amount,
        mode,
        remarks: remarks || null,
        createdAt: new Date().toISOString(),
      };
      await db!.runAsync(`
        INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [payment.id, payment.billId, payment.customerId, payment.amount, payment.mode, 'Clearance', payment.remarks, payment.createdAt]);
      return payment;
    });
  }

  async getCustomerBillsWithPayments(customerId: string): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");
    const bills = await db.getAllAsync(`
      SELECT 
        b.*, 
        c.name as customerName,
        r.id as receiptId
      FROM bills b
      JOIN customers c ON b.customerId = c.id
      LEFT JOIN receipts r ON r.billId = b.id
      WHERE b.customerId = ?
      ORDER BY b.createdAt DESC
    `, [customerId]) as any[];
    for (const bill of bills) {
      const payments = await db.getAllAsync(`
        SELECT * FROM payments WHERE billId = ? ORDER BY createdAt ASC
      `, [bill.id]) as any[];
      let paidTotal = 0, creditPortion = 0;
      for (const p of payments) {
        if (p.mode === 'Credit') creditPortion += p.amount; else paidTotal += p.amount;
      }
      bill.payments = payments;
      bill.paidTotal = paidTotal;
      bill.creditPortion = creditPortion;
      bill.status = creditPortion === 0 ? 'Paid' : (paidTotal === 0 ? 'Credit' : 'Partial');
    }
    return bills;
  }

  async getReceiptIdForBill(billId: string): Promise<string | null> {
    if (!db) throw new Error("Database not initialized");
    const row = await db.getFirstAsync(`
      SELECT id FROM receipts WHERE billId = ? ORDER BY createdAt DESC LIMIT 1
    `, [billId]) as { id: string } | null;
    return row?.id || null;
  }

  async getNearestClearanceReceiptId(customerId: string, createdAt: string): Promise<string | null> {
    if (!db) throw new Error("Database not initialized");
    const row = await db.getFirstAsync(`
      SELECT id FROM receipts 
      WHERE customerId = ? AND billId IS NULL 
      ORDER BY ABS(strftime('%s', createdAt) - strftime('%s', ?)) ASC
      LIMIT 1
    `, [customerId, createdAt]) as { id: string } | null;
    return row?.id || null;
  }

  async getBillsGroupedByDate(): Promise<Record<string, { date:string; displayDate:string; bills:any[] }>> {
    if (!db) throw new Error("Database not initialized");
    // Fetch bill-based rows
    const rows = await db.getAllAsync(`
      SELECT b.id as billId, b.billNumber, b.customerId, b.total, b.createdAt,
             c.name as customerName, c.contact as customerContact,
             r.id as receiptId, r.receiptNo
      FROM bills b
      JOIN customers c ON b.customerId = c.id
      LEFT JOIN receipts r ON r.billId = b.id
      ORDER BY b.createdAt DESC
    `) as any[];
    // Fetch clearance-only receipts (no billId)
    const clearanceReceipts = await db.getAllAsync(`
      SELECT r.id as receiptId, r.receiptNo, r.customerId, r.amount, r.mode, r.remarks, r.createdAt,
             c.name as customerName, c.contact as customerContact
      FROM receipts r
      JOIN customers c ON r.customerId = c.id
      WHERE r.billId IS NULL
      ORDER BY r.createdAt DESC
    `) as any[];
    const groups: Record<string, any> = {};
    for (const row of rows) {
      const date = row.createdAt.split('T')[0];
      if (!groups[date]) {
        // displayDate formatting similar to existing logic
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let displayDate: string;
        if (date === today) displayDate = 'Today';
        else if (date === yesterday) displayDate = 'Yesterday';
        else {
          const d = new Date(date);
            displayDate = d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit', weekday:'long' });
        }
        groups[date] = { date, displayDate, bills: [] };
      }
      // fetch payments for this bill
      const pays = await db.getAllAsync(`SELECT * FROM payments WHERE billId = ?`, [row.billId]) as any[];
      let paidTotal=0, creditPortion=0;
      let hasAnyCredit = false;
      pays.forEach(p=>{ 
        if (p.mode==='Credit') { 
          creditPortion+= (p.amount || 0); 
          hasAnyCredit = true; 
        } else { 
          paidTotal+= (p.amount || 0); 
        }
      });
      // Status rules:
      // - Paid: only cash/upi etc (paidTotal>0, creditPortion==0)
      // - Credit: no cash/upi, has credit (creditPortion>0 OR legacy zero-amount credit rows)
      // - Partial: both present
      // - Edge (both zero): treat as Credit if any credit row exists, else fall back to Paid
      let status: 'Paid' | 'Credit' | 'Partial';
      if (paidTotal > 0 && creditPortion === 0) status = 'Paid';
      else if (paidTotal === 0 && (creditPortion > 0 || hasAnyCredit)) status = 'Credit';
      else if (paidTotal > 0 && creditPortion > 0) status = 'Partial';
      else status = row.receiptId ? 'Paid' : 'Credit';
      groups[date].bills.push({
        id: row.receiptId || row.billId, // keep id for navigation; if no receipt we use billId
        billId: row.billId,
        receiptId: row.receiptId,
        billNumber: row.billNumber,
        receiptNo: row.receiptNo || '—',
        customerId: row.customerId,
        customerName: row.customerName,
        customerContact: row.customerContact,
        total: row.total,
        paidTotal, creditPortion, status,
        createdAt: row.createdAt,
      });
    }
    // Add clearance receipts as standalone entries
    for (const cr of clearanceReceipts) {
      const date = cr.createdAt.split('T')[0];
      if (!groups[date]) {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let displayDate: string;
        if (date === today) displayDate = 'Today';
        else if (date === yesterday) displayDate = 'Yesterday';
        else {
          const d = new Date(date);
          displayDate = d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit', weekday:'long' });
        }
        groups[date] = { date, displayDate, bills: [] };
      }
      groups[date].bills.push({
        id: cr.receiptId,
        billId: null,
        receiptId: cr.receiptId,
        billNumber: '—',
        receiptNo: cr.receiptNo,
        customerId: cr.customerId,
        customerName: cr.customerName,
        customerContact: cr.customerContact,
        total: cr.amount,
        paidTotal: cr.amount,
        creditPortion: 0,
        status: 'Clearance',
        mode: cr.mode,
        remarks: cr.remarks,
        createdAt: cr.createdAt,
      });
    }
    return groups;
  }
}

export const paymentService = new PaymentService();
