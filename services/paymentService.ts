import { db, withTransaction } from "@/lib/db";
import { advanceService } from "@/services/advanceService";
import { settingsService } from "@/services/settingsService";
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
    const receiptsInfo = (await db.getAllAsync(
      `PRAGMA table_info(receipts)`
    )) as any[];
    const paymentsInfo = (await db.getAllAsync(
      `PRAGMA table_info(payments)`
    )) as any[];
    const receiptsHasBillId = receiptsInfo.some((c) => c.name === "billId");
    const paymentsHasSubType = paymentsInfo.some((c) => c.name === "subType");
    if (!receiptsHasBillId) {
      await db.execAsync(
        `ALTER TABLE receipts ADD COLUMN billId TEXT REFERENCES bills(id);`
      );
    }
    if (!paymentsHasSubType) {
      await db.execAsync(`ALTER TABLE payments ADD COLUMN subType TEXT;`);
    }
    this.schemaChecked = true;
  }
  // Numbers are assigned by server after sync; no local generators

  async createBill(customerId: string, totalAmount: number): Promise<Bill> {
    if (!db) throw new Error("Database not initialized");

    const now = new Date();
    // Assign a local provisional bill number unique for the year
    const localBillNo = await (async () => {
      const { nextLocalNumber } = await import("@/lib/db");
      return nextLocalNumber("bill", now);
    })();

    const bill: Bill = {
      id: uuid.v4() as string,
      billNumber: String(localBillNo),
      customerId,
      total: totalAmount, // Store in rupees (direct KOT total)
      createdAt: now.toISOString(),
    };

    await db!.runAsync(
      `
      INSERT INTO bills (id, billNumber, customerId, total, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
      [bill.id, bill.billNumber, bill.customerId, bill.total, bill.createdAt]
    );
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.bills();
      signalChange.any();
    } catch {}
    return bill;
  }

  async processPayment(paymentData: PaymentProcessData): Promise<{
    receipt: Receipt;
    bill: Bill;
    paidPortion: number;
    creditPortion: number;
  }> {
    if (!db) throw new Error("Database not initialized");
    await this.ensureSchemaUpgrades();
    // This function no longer handles pure credit; use processCreditSale for that path.
    return await withTransaction(async () => {
      const bill = await this.createBill(
        paymentData.customerId,
        paymentData.totalAmount
      );
      // Optionally auto-apply customer advance to this bill (skip for Credit/Split)
      let effectiveTotal = paymentData.totalAmount;
      const autoApply = await settingsService.getBool(
        "advance.autoApplyOnBilling",
        false
      );
      if (
        autoApply &&
        paymentData.paymentType !== "Credit" &&
        paymentData.paymentType !== "Split"
      ) {
        try {
          const balance = await advanceService.getBalance(
            paymentData.customerId
          );
          const toApply = Math.min(balance, effectiveTotal);
          if (toApply > 0) {
            await advanceService.applyAdvance(paymentData.customerId, toApply, {
              context: { billId: bill.id },
              remarks: `Auto-applied to bill ${bill.billNumber}`,
            } as any);
            effectiveTotal -= toApply;
          }
        } catch (e) {
          console.warn("[advance] auto-apply failed", e);
        }
      }
      const nowIso = new Date().toISOString();
      // Assign a local provisional receipt number unique for the year
      const localReceiptNo = await (async () => {
        const { nextLocalNumber } = await import("@/lib/db");
        return nextLocalNumber("receipt", new Date());
      })();
      const receiptNo = String(localReceiptNo);

      let paidPortion = 0;
      let creditPortion = 0;
      let splitParts: SplitPayment[] | undefined = undefined;
      if (paymentData.paymentType === "Split" && paymentData.splitPayments) {
        // Normalize/merge duplicate types
        splitParts = this.mergeSplitParts(paymentData.splitPayments);
        for (const part of splitParts) {
          if (part.type === "Credit") {
            creditPortion += part.amount;
          } else if (part.type === "AdvanceUse") {
            // Treat as paid portion towards bill (advance wallet deduction)
            paidPortion += part.amount;
          } else if (part.type === "AdvanceAddCash" || part.type === "AdvanceAddUPI") {
            // Does not affect bill portions; handled separately after receipt/bill creation
          } else {
            paidPortion += part.amount;
          }
        }
        // Note: For split payments we do not auto-adjust parts using advance to avoid ambiguity.
        // If auto-apply is desired with split, handle explicitly in UI.
      } else if (paymentData.paymentType === "Credit") {
        creditPortion = effectiveTotal;
      } else {
        paidPortion = effectiveTotal;
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
        createdAt: nowIso,
      } as any;

      await db!.runAsync(
        `
        INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          receipt.id,
          receipt.receiptNo,
          receipt.customerId,
          bill.id,
          receipt.amount,
          receipt.mode,
          receipt.remarks,
          receipt.createdAt,
        ]
      );

      // Persist payment rows and handle advance ledger operations
      if (paymentData.paymentType === "Split" && splitParts) {
        for (const part of splitParts) {
          if (part.type === "AdvanceUse") {
            // Deduct from customer's advance wallet
            await advanceService.applyAdvance(
              paymentData.customerId,
              part.amount,
              {
                context: { billId: bill.id },
                remarks: `Applied to bill ${bill.billNumber}`,
                inTransaction: true,
              } as any
            );
            continue; // no payments row
          }
  if (part.type === "AdvanceAddCash" || part.type === "AdvanceAddUPI") {
            // Add extra to advance wallet
            await advanceService.addAdvance(
              paymentData.customerId,
              part.amount,
              {
        remarks: `Extra paid during bill ${bill.billNumber} (${part.type === 'AdvanceAddCash' ? 'Cash' : part.type === 'AdvanceAddUPI' ? 'UPI' : 'Other'})`,
                inTransaction: true,
              }
            );
            continue; // no payments row
          }
          // Normal payment rows
          const pay: Payment = {
            id: uuid.v4() as string,
            billId: bill.id,
            customerId: paymentData.customerId,
            amount: part.amount,
            mode: part.type,
            remarks: paymentData.remarks || null,
            createdAt: nowIso,
          };
          await db!.runAsync(
            `
            INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              pay.id,
              pay.billId,
              pay.customerId,
              pay.amount,
              pay.mode,
              part.type === "Credit" ? "Accrual" : null,
              pay.remarks,
              pay.createdAt,
            ]
          );
          if (part.type === "Credit")
            await this.updateCustomerCredit(
              paymentData.customerId,
              part.amount
            );
        }
        // Store split meta (retain existing table usage) for UI referencing original intent
        for (const part of splitParts) {
          const splitId = uuid.v4() as string;
          await db!.runAsync(
            `
            INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `,
            [splitId, receipt.id, part.type, part.amount, nowIso]
          );
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
          createdAt: nowIso,
        };
        await db!.runAsync(
          `
          INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            pay.id,
            pay.billId,
            pay.customerId,
            pay.amount,
            pay.mode,
            null,
            pay.remarks,
            pay.createdAt,
          ]
        );
      }

      await this.linkKOTsToBill(
        paymentData.customerId,
        bill.id,
        paymentData.targetDate
      );
      try {
        const { signalChange } = await import("@/state/appEvents");
        signalChange.payments();
        signalChange.bills();
        signalChange.orders();
        signalChange.any();
      } catch {}
      return { receipt, bill, paidPortion, creditPortion };
    });
  }

  private async linkKOTsToBill(
    customerId: string,
    billId: string,
    targetDate?: string
  ): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    // Use provided date or today's date for filtering KOTs
    const dateToUse = targetDate || new Date().toISOString().split("T")[0];
    const dayStartIso = `${dateToUse}T00:00:00.000Z`;
    const nextDayStartIso = new Date(
      new Date(dayStartIso).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    await db.runAsync(
      `
      UPDATE kot_orders 
      SET billId = ? 
      WHERE customerId = ? 
        AND billId IS NULL 
        AND createdAt >= ? AND createdAt < ?
    `,
      [billId, customerId, dayStartIso, nextDayStartIso]
    );
  }

  // Public method for pure credit sale: create bill, update credit, NO receipt row
  async processCreditSale(
    customerId: string,
    customerName: string,
    totalAmount: number,
    remarks?: string
  ): Promise<{ bill: Bill }> {
    if (!db) throw new Error("Database not initialized");
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
      mode: "Credit",
      remarks: remarks || null,
      createdAt: new Date().toISOString(),
    };
    await db.runAsync(
      `
      INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        payment.id,
        payment.billId,
        payment.customerId,
        payment.amount,
        payment.mode,
        "Accrual",
        payment.remarks,
        payment.createdAt,
      ]
    );
    // Link KOTs created today (reuse logic)
    await this.linkKOTsToBill(customerId, bill.id);
    try {
      const { signalChange } = await import("@/state/appEvents");
      signalChange.payments();
      signalChange.bills();
      signalChange.orders();
      signalChange.customers();
      signalChange.any();
    } catch {}
    return { bill };
  }

  private async updateCustomerCredit(
    customerId: string,
    amount: number
  ): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    // Column guaranteed in schema; just update
    await db.runAsync(
      `
      UPDATE customers 
      SET creditBalance = COALESCE(creditBalance, 0) + ?
      WHERE id = ?
    `,
      [amount, customerId]
    ); // Store direct amount (already in rupees)
  }

  async getCustomerCreditBalance(customerId: string): Promise<number> {
    if (!db) throw new Error("Database not initialized");

    const result = (await db.getFirstAsync(
      `
      SELECT COALESCE(creditBalance, 0) as creditBalance FROM customers WHERE id = ?
    `,
      [customerId]
    )) as { creditBalance: number };

    return result?.creditBalance || 0; // Use direct credit balance (already in rupees)
  }

  async getReceipt(receiptId: string): Promise<Receipt | null> {
    if (!db) throw new Error("Database not initialized");

    const receipt = (await db.getFirstAsync(
      `
      SELECT * FROM receipts WHERE id = ?
    `,
      [receiptId]
    )) as Receipt | null;

    if (receipt) {
      receipt.amount = receipt.amount; // Use direct amount (already in rupees)
    }

    return receipt;
  }

  async getPaymentHistory(customerId: string): Promise<Payment[]> {
    if (!db) throw new Error("Database not initialized");

    const payments = (await db.getAllAsync(
      `
  SELECT * FROM payments 
      WHERE customerId = ? 
      ORDER BY createdAt DESC
    `,
      [customerId]
    )) as Payment[];

    return payments.map((payment) => ({
      ...payment,
      amount: payment.amount, // Use direct amount (already in rupees)
    }));
  }

  // Enriched view: sums Cash/UPI + AdvanceUse (and clearance) per bill/receipt so UI can show full paid amounts
  async getCustomerPaymentHistoryEnriched(customerId: string): Promise<
    Array<{
      id: string; // receiptId or synthetic id per bill
      billId: string | null;
      receiptId: string | null;
      amountPaid: number; // includes AdvanceUse
      mode: string; // Receipt mode or "Clearance"/"Bill"
      remarks: string | null;
      createdAt: string;
    }>
  > {
    if (!db) throw new Error("Database not initialized");

    // Start from receipts to aggregate paid per bill/receipt
    const receipts = (await db.getAllAsync(
      `SELECT * FROM receipts WHERE customerId = ? ORDER BY createdAt DESC`,
      [customerId]
    )) as any[];
    const enriched: any[] = [];
    for (const r of receipts) {
      // Cash/UPI from payments (exclude Credit accrual rows)
      const pays = (await db.getAllAsync(
        `SELECT * FROM payments WHERE (billId = ? OR (? IS NULL AND billId IS NULL AND customerId = ?)) AND (mode != 'Credit')`,
        [r.billId, r.billId, customerId]
      )) as any[];
      const cashUpi = pays.reduce((s, p) => s + (p.amount || 0), 0);
      // AdvanceUse from split meta
      const adv = (await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount),0) as s FROM split_payments WHERE receiptId = ? AND paymentType = 'AdvanceUse'`,
        [r.id]
      )) as any;
      const advanceUsed = adv?.s || 0;
      const amountPaid = cashUpi + advanceUsed;
      enriched.push({
        id: r.id,
        billId: r.billId ?? null,
        receiptId: r.id,
        amountPaid,
        mode: r.billId ? r.mode : "Clearance",
        remarks: r.remarks ?? null,
        createdAt: r.createdAt,
      });
    }
    return enriched;
  }

  // Payment history with breakdown including AdvanceUse parts per receipt
  async getPaymentHistoryWithAdvanceParts(customerId: string): Promise<Payment[]> {
    if (!db) throw new Error("Database not initialized");
    const receipts = (await db.getAllAsync(
      `SELECT id, billId, customerId, createdAt FROM receipts WHERE customerId = ? ORDER BY createdAt DESC`,
      [customerId]
    )) as any[];
    const rows: Payment[] = [] as any;
    for (const r of receipts) {
      // Real payment rows linked to this receipt context
      const pays = (await db.getAllAsync(
        r.billId
          ? `SELECT * FROM payments WHERE billId = ? ORDER BY createdAt ASC`
          : `SELECT * FROM payments WHERE billId IS NULL AND customerId = ? AND createdAt = ? ORDER BY createdAt ASC`,
        r.billId ? [r.billId] : [customerId, r.createdAt]
      )) as Payment[];
      rows.push(...pays);
      // Add synthetic Advance rows from split meta
      const advParts = (await db.getAllAsync(
        `SELECT amount FROM split_payments WHERE receiptId = ? AND paymentType = 'AdvanceUse' ORDER BY createdAt ASC`,
        [r.id]
      )) as any[];
      for (const a of advParts) {
        rows.push({
          id: uuid.v4() as string,
          billId: r.billId ?? null,
          customerId: r.customerId,
          amount: a.amount || 0,
          mode: "Advance",
          subType: r.billId ? null : ("Clearance" as any),
          remarks: null,
          createdAt: r.createdAt,
        });
      }
    }
    // Order newest first
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return rows;
  }

  async getCompletedBillsGroupedByDate(daysWindow: number = 2): Promise<
    Record<
      string,
      {
        date: string;
        displayDate: string;
        bills: {
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
        }[];
      }
    >
  > {
    if (!db) throw new Error("Database not initialized");

    const startDateStr = (() => {
      const d = new Date(Date.now() - daysWindow * 86400000);
      return d.toISOString().split("T")[0];
    })();

    const bills = (await db.getAllAsync(
      `
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
      LEFT JOIN bills b ON r.billId = b.id
      WHERE r.createdAt >= ?
      ORDER BY r.createdAt DESC
    `,
      [startDateStr + "T00:00:00.000Z"]
    )) as any[];

    const dateGroups: Record<string, any> = {};

    bills.forEach((bill: any) => {
      const billDate = bill.createdAt.split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

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
        billNumber: bill.billNumber || "N/A",
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
    const customer = (await db.getFirstAsync(
      `
      SELECT * FROM customers WHERE id = ?
    `,
      [receipt.customerId]
    )) as any;

    // Get split payment details
    const splitPayments = (await db.getAllAsync(
      `
      SELECT * FROM split_payments WHERE receiptId = ?
      ORDER BY createdAt
    `,
      [receiptId]
    )) as any[];

    // Get related bill directly via receipt.billId when available
    let bill: any = null;
    if (receipt.billId) {
      bill = (await db.getFirstAsync(
        `SELECT * FROM bills WHERE id = ?`,
        [receipt.billId]
      )) as any;
    }

    let kots: any[] = [];
  if (bill) {
      // Get KOTs linked to this bill
      kots = (await db.getAllAsync(
        `
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
      `,
        [bill.id]
      )) as any[];

      kots = kots.map((kot) => ({
        ...kot,
        total: kot.total || 0,
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
      const receipts = (await db.getAllAsync(
        `
        SELECT * FROM receipts 
        WHERE customerId = ?
        ORDER BY createdAt DESC
      `,
        [customerId]
      )) as any[];

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
    return Object.entries(map).map(([type, amount]) => ({
      id: type,
      // keep type as-is; cast to any then back to SplitPayment
      type: type as any,
      amount,
    })) as SplitPayment[];
  }

  // Process a credit clearance using normal payment-like flow. Creates a receipt with no billId and payment rows with subType='Clearance'.
  async processCreditClearance(
    customerId: string,
    splits: SplitPayment[],
    remarks?: string
  ): Promise<{ receipt: Receipt; paidTotal: number }> {
    if (!db) throw new Error("Database not initialized");
    await this.ensureSchemaUpgrades();
    // Validate: allow Cash/UPI and AdvanceUse; total cleared (Cash/UPI + AdvanceUse) must be > 0
    const invalid = splits.some(
      (s) => s.type === "Credit" || s.type === "AdvanceAddCash" || s.type === "AdvanceAddUPI" || s.amount <= 0
    );
    if (invalid) throw new Error("Invalid clearance splits");
    const paidTotal = splits
      .filter((s) => s.type === "Cash" || s.type === "UPI")
      .reduce((s, p) => s + p.amount, 0);
    const advanceUsedPre = splits
      .filter((s) => s.type === "AdvanceUse")
      .reduce((s, p) => s + p.amount, 0);
    const totalCleared = paidTotal + advanceUsedPre;
    if (totalCleared <= 0) throw new Error("Clearance amount must be > 0");

    const now = new Date().toISOString();
    // Assign a local provisional receipt number unique for the year
    const localReceiptNo = await (async () => {
      const { nextLocalNumber } = await import("@/lib/db");
      return nextLocalNumber("receipt", new Date());
    })();
    const receiptNo = String(localReceiptNo);
    const receipt: Receipt = {
      id: uuid.v4() as string,
      receiptNo,
      customerId,
      billId: null,
      amount: totalCleared,
      mode: splits.length > 1 ? "Split" : splits[0].type,
      remarks: remarks ?? "Credit Clearance",
      createdAt: now,
    };

    await withTransaction(async () => {
      // Insert receipt
      await db!.runAsync(
        `
        INSERT INTO receipts (id, receiptNo, customerId, billId, amount, mode, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          receipt.id,
          receipt.receiptNo,
          receipt.customerId,
          null,
          receipt.amount,
          receipt.mode,
          receipt.remarks,
          receipt.createdAt,
        ]
      );

      // Insert payments for Cash/UPI (subType Clearance) and apply advance for AdvanceUse
      let advanceUsed = 0;
      for (const part of splits) {
        if (part.type === "AdvanceUse") {
          await advanceService.applyAdvance(customerId, part.amount, {
            remarks: receipt.remarks || undefined,
            inTransaction: true,
          });
          advanceUsed += part.amount;
          continue;
        }
        // Cash/UPI rows
        await db!.runAsync(
          `
          INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            uuid.v4() as string,
            null,
            customerId,
            part.amount,
            part.type,
            "Clearance",
            receipt.remarks,
            now,
          ]
        );
      }
      await db!.runAsync(
        `
        UPDATE customers SET creditBalance = COALESCE(creditBalance,0) - ? WHERE id = ?
      `,
        [paidTotal + advanceUsed, customerId]
      );

      // Store split meta for UI
      for (const part of splits) {
        const splitId = uuid.v4() as string;
        await db!.runAsync(
          `
          INSERT INTO split_payments (id, receiptId, paymentType, amount, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `,
          [splitId, receipt.id, part.type, part.amount, now]
        );
      }
    });

    return { receipt, paidTotal };
  }

  async recordCreditClearance(
    customerId: string,
    amount: number,
    mode: string,
    remarks?: string
  ) {
    if (!db) throw new Error("Database not initialized");
    await this.ensureSchemaUpgrades();
    return withTransaction(async () => {
      // Decrement customer credit (store negative increment)
      await db!.runAsync(
        `
        UPDATE customers SET creditBalance = COALESCE(creditBalance,0) - ? WHERE id = ?
      `,
        [amount, customerId]
      );
      const payment: Payment = {
        id: uuid.v4() as string,
        billId: null,
        customerId,
        amount,
        mode,
        remarks: remarks || null,
        createdAt: new Date().toISOString(),
      };
      await db!.runAsync(
        `
        INSERT INTO payments (id, billId, customerId, amount, mode, subType, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          payment.id,
          payment.billId,
          payment.customerId,
          payment.amount,
          payment.mode,
          "Clearance",
          payment.remarks,
          payment.createdAt,
        ]
      );
      return payment;
    });
  }

  async getCustomerBillsWithPayments(customerId: string): Promise<any[]> {
    if (!db) throw new Error("Database not initialized");
    const bills = (await db.getAllAsync(
      `
      SELECT 
        b.*, 
        c.name as customerName,
        r.id as receiptId
      FROM bills b
      JOIN customers c ON b.customerId = c.id
      LEFT JOIN receipts r ON r.billId = b.id
      WHERE b.customerId = ?
      ORDER BY b.createdAt DESC
    `,
      [customerId]
    )) as any[];
    for (const bill of bills) {
      const payments = (await db.getAllAsync(
        `
        SELECT * FROM payments WHERE billId = ? ORDER BY createdAt ASC
      `,
        [bill.id]
      )) as any[];
      let paidTotal = 0,
        creditPortion = 0;
      for (const p of payments) {
        if (p.mode === "Credit") creditPortion += p.amount;
        else paidTotal += p.amount;
      }
      bill.payments = payments;
      bill.paidTotal = paidTotal;
      bill.creditPortion = creditPortion;
      bill.status =
        creditPortion === 0 ? "Paid" : paidTotal === 0 ? "Credit" : "Partial";
    }
    return bills;
  }

  async getReceiptIdForBill(billId: string): Promise<string | null> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `
      SELECT id FROM receipts WHERE billId = ? ORDER BY createdAt DESC LIMIT 1
    `,
      [billId]
    )) as { id: string } | null;
    return row?.id || null;
  }

  async getNearestClearanceReceiptId(
    customerId: string,
    createdAt: string
  ): Promise<string | null> {
    if (!db) throw new Error("Database not initialized");
    const row = (await db.getFirstAsync(
      `
      SELECT id FROM receipts 
      WHERE customerId = ? AND billId IS NULL 
      ORDER BY ABS(strftime('%s', createdAt) - strftime('%s', ?)) ASC
      LIMIT 1
    `,
      [customerId, createdAt]
    )) as { id: string } | null;
    return row?.id || null;
  }

  async getBillsGroupedByDate(
    daysWindow: number = 2
  ): Promise<
    Record<string, { date: string; displayDate: string; bills: any[] }>
  > {
    if (!db) throw new Error("Database not initialized");
    // Fetch bill-based rows
    const startDateStr = (() => {
      const d = new Date(Date.now() - daysWindow * 86400000);
      return d.toISOString().split("T")[0];
    })();

    const rows = (await db.getAllAsync(
      `
      SELECT b.id as billId, b.billNumber, b.customerId, b.total, b.createdAt,
             c.name as customerName, c.contact as customerContact,
             r.id as receiptId, r.receiptNo
      FROM bills b
      JOIN customers c ON b.customerId = c.id
      LEFT JOIN receipts r ON r.billId = b.id
      WHERE b.createdAt >= ?
      ORDER BY b.createdAt DESC
    `,
      [startDateStr + "T00:00:00.000Z"]
    )) as any[];
    // Fetch clearance-only receipts (no billId)
    const clearanceReceipts = (await db.getAllAsync(
      `
      SELECT r.id as receiptId, r.receiptNo, r.customerId, r.amount, r.mode, r.remarks, r.createdAt,
             c.name as customerName, c.contact as customerContact
      FROM receipts r
      JOIN customers c ON r.customerId = c.id
      WHERE r.billId IS NULL
        AND r.createdAt >= ?
      ORDER BY r.createdAt DESC
    `,
      [startDateStr + "T00:00:00.000Z"]
    )) as any[];
    const groups: Record<string, any> = {};
    for (const row of rows) {
      const date = row.createdAt.split("T")[0];
      if (!groups[date]) {
        // displayDate formatting similar to existing logic
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .split("T")[0];
        let displayDate: string;
        if (date === today) displayDate = "Today";
        else if (date === yesterday) displayDate = "Yesterday";
        else {
          const d = new Date(date);
          displayDate = d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            weekday: "long",
          });
        }
        groups[date] = { date, displayDate, bills: [] };
      }
      // fetch payments for this bill
      const pays = (await db.getAllAsync(
        `SELECT * FROM payments WHERE billId = ?`,
        [row.billId]
      )) as any[];
      let paidTotal = 0,
        creditPortion = 0;
      let hasAnyCredit = false;
      pays.forEach((p) => {
        if (p.mode === "Credit") {
          creditPortion += p.amount || 0;
          hasAnyCredit = true;
        } else {
          paidTotal += p.amount || 0;
        }
      });
      // Include advance used via split meta or infer auto-applied advance
      let advanceUsed = 0;
      if (row.receiptId) {
        const adv = (await db.getFirstAsync(
          `SELECT COALESCE(SUM(amount),0) as s FROM split_payments WHERE receiptId = ? AND paymentType = 'AdvanceUse'`,
          [row.receiptId]
        )) as any;
        advanceUsed = adv?.s || 0;
      }
      if (!advanceUsed) {
        // Infer auto-apply (non-split path): any remaining between total and (paid+credit) is likely advance
        const remaining = Math.max(0, (row.total || 0) - (paidTotal + creditPortion));
        // Only count as advance if there is a receipt (i.e., not pure credit sale)
        if (row.receiptId) advanceUsed = remaining;
      }
      const paidTotalWithAdvance = paidTotal + advanceUsed;
      // Status rules:
      // - Paid: only cash/upi etc (paidTotal>0, creditPortion==0)
      // - Credit: no cash/upi, has credit (creditPortion>0 OR legacy zero-amount credit rows)
      // - Partial: both present
      // - Edge (both zero): treat as Credit if any credit row exists, else fall back to Paid
      let status: "Paid" | "Credit" | "Partial";
      if (paidTotalWithAdvance >= (row.total || 0) && creditPortion === 0) status = "Paid";
      else if (paidTotalWithAdvance === 0 && (creditPortion > 0 || hasAnyCredit))
        status = "Credit";
      else if (paidTotalWithAdvance > 0 && creditPortion > 0) status = "Partial";
      else status = row.receiptId ? "Paid" : "Credit";
      groups[date].bills.push({
        id: row.receiptId || row.billId, // keep id for navigation; if no receipt we use billId
        billId: row.billId,
        receiptId: row.receiptId,
        billNumber: row.billNumber,
        receiptNo: row.receiptNo || "—",
        customerId: row.customerId,
        customerName: row.customerName,
        customerContact: row.customerContact,
        total: row.total,
        paidTotal: paidTotalWithAdvance,
        creditPortion,
        status,
        createdAt: row.createdAt,
      });
    }
    // Add clearance receipts as standalone entries
    for (const cr of clearanceReceipts) {
      const date = cr.createdAt.split("T")[0];
      if (!groups[date]) {
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .split("T")[0];
        let displayDate: string;
        if (date === today) displayDate = "Today";
        else if (date === yesterday) displayDate = "Yesterday";
        else {
          const d = new Date(date);
          displayDate = d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            weekday: "long",
          });
        }
        groups[date] = { date, displayDate, bills: [] };
      }
      // Include advance used for clearance receipt via split meta
      const adv = (await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount),0) as s FROM split_payments WHERE receiptId = ? AND paymentType = 'AdvanceUse'`,
        [cr.receiptId]
      )) as any;
      const advUsed = adv?.s || 0;
      const totalPaid = (cr.amount || 0) + advUsed;
      groups[date].bills.push({
        id: cr.receiptId,
        billId: null,
        receiptId: cr.receiptId,
        billNumber: "—",
        receiptNo: cr.receiptNo,
        customerId: cr.customerId,
        customerName: cr.customerName,
        customerContact: cr.customerContact,
        total: totalPaid,
        paidTotal: totalPaid,
        creditPortion: 0,
        status: "Clearance",
        mode: cr.mode,
        remarks: cr.remarks,
        createdAt: cr.createdAt,
      });
    }
    return groups;
  }
}

export const paymentService = new PaymentService();
