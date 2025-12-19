// services/reportService.ts
// Report generation service with SQL queries for all 13 reports

import { db } from "@/lib/db";
import { csvExporter } from "@/services/csvExporter";
import {
  AdvanceLiabilityEntry,
  BillRegisterEntry,
  CancellationToken,
  CashBookEntry,
  ColumnConfig,
  CreditorsReportEntry,
  CustomerAnalysisEntry,
  DailySummaryEntry,
  DebtorsReportEntry,
  ExpenseRegisterEntry,
  GeneratedReport,
  ItemwiseSalesEntry,
  MonthlySummaryEntry,
  ReceiptRegisterEntry,
  REPORT_DEFINITIONS,
  ReportOptions,
  ReportProgress,
  ReportStep,
  ReportType,
  SalesRegisterEntry,
  UPIBookEntry,
} from "@/types/reports";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert local date string (YYYY-MM-DD) to UTC ISO range for IST timezone
 * This ensures we capture all transactions for the local day
 */
function getISTDateRange(
  startDate: string,
  endDate: string
): { startUtc: string; endUtc: string } {
  // IST is UTC+5:30, so midnight IST = previous day 18:30 UTC
  const startUtc = new Date(startDate + "T00:00:00.000+05:30").toISOString();
  // End of day: next day midnight IST
  const endDateObj = new Date(endDate + "T00:00:00.000+05:30");
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endUtc = endDateObj.toISOString();
  return { startUtc, endUtc };
}

/**
 * Format ISO timestamp to display date
 */
function formatDisplayDate(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Create initial progress object
 */
function createProgress(
  reportType: ReportType,
  steps: string[]
): ReportProgress {
  const reportDef = REPORT_DEFINITIONS.find((r) => r.type === reportType);
  return {
    reportType,
    reportName: reportDef?.name || reportType,
    overallPercent: 0,
    currentStep: steps[0] || "Initializing...",
    steps: steps.map((label, idx) => ({
      id: `step-${idx}`,
      label,
      status: idx === 0 ? "in-progress" : "pending",
    })),
    rowsProcessed: 0,
    totalRows: 0,
    estimatedSecondsRemaining: 30,
  };
}

/**
 * Update progress step
 */
function updateProgressStep(
  progress: ReportProgress,
  stepIndex: number,
  status: ReportStep["status"],
  overallPercent?: number
): ReportProgress {
  const newSteps = progress.steps.map((step, idx) => {
    if (idx < stepIndex) return { ...step, status: "done" as const };
    if (idx === stepIndex) return { ...step, status };
    return step;
  });

  return {
    ...progress,
    steps: newSteps,
    currentStep: newSteps[stepIndex]?.label || progress.currentStep,
    overallPercent: overallPercent ?? progress.overallPercent,
  };
}

// ============================================================================
// Column Definitions for CSV Export
// ============================================================================

const CASH_BOOK_COLUMNS: ColumnConfig<CashBookEntry>[] = [
  { key: "date", header: "Date" },
  { key: "particulars", header: "Particulars" },
  { key: "referenceNo", header: "Reference No" },
  {
    key: "debit",
    header: "Debit (Cash In)",
    format: (v) => (v > 0 ? csvExporter.formatINR(v) : ""),
  },
  {
    key: "credit",
    header: "Credit (Cash Out)",
    format: (v) => (v > 0 ? csvExporter.formatINR(v) : ""),
  },
  {
    key: "balance",
    header: "Balance",
    format: (v) => csvExporter.formatINR(v),
  },
];

const UPI_BOOK_COLUMNS: ColumnConfig<UPIBookEntry>[] = [
  { key: "date", header: "Date" },
  { key: "particulars", header: "Particulars" },
  { key: "referenceNo", header: "Reference No" },
  {
    key: "debit",
    header: "Debit (UPI In)",
    format: (v) => (v > 0 ? csvExporter.formatINR(v) : ""),
  },
  {
    key: "credit",
    header: "Credit (UPI Out)",
    format: (v) => (v > 0 ? csvExporter.formatINR(v) : ""),
  },
  {
    key: "balance",
    header: "Balance",
    format: (v) => csvExporter.formatINR(v),
  },
];

const SALES_REGISTER_COLUMNS: ColumnConfig<SalesRegisterEntry>[] = [
  { key: "date", header: "Date" },
  { key: "billNo", header: "Bill No" },
  { key: "customer", header: "Customer" },
  { key: "grossAmount", header: "Gross Amount", format: (v) => csvExporter.formatINR(v) },
  { key: "paymentMode", header: "Payment Mode" },
  { key: "cashAmount", header: "Cash", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "upiAmount", header: "UPI", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "creditAmount", header: "Credit", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "advanceUsed", header: "Advance Used", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
];

const EXPENSE_REGISTER_COLUMNS: ColumnConfig<ExpenseRegisterEntry>[] = [
  { key: "date", header: "Date" },
  { key: "voucherNo", header: "Voucher No" },
  { key: "particulars", header: "Particulars (Towards)" },
  { key: "amount", header: "Amount", format: (v) => csvExporter.formatINR(v) },
  { key: "mode", header: "Mode" },
  { key: "cashPaid", header: "Cash Paid", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "upiPaid", header: "UPI Paid", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "creditAmount", header: "Credit", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "remarks", header: "Remarks" },
];

const DEBTORS_REPORT_COLUMNS: ColumnConfig<DebtorsReportEntry>[] = [
  { key: "customer", header: "Customer" },
  { key: "contact", header: "Contact" },
  { key: "openingBalance", header: "Opening Balance", format: (v) => csvExporter.formatINR(v) },
  { key: "creditGiven", header: "Credit Given", format: (v) => csvExporter.formatINR(v) },
  { key: "paymentsReceived", header: "Payments Received", format: (v) => csvExporter.formatINR(v) },
  { key: "closingBalance", header: "Closing Balance", format: (v) => csvExporter.formatINR(v) },
  { key: "ageing0to7", header: "0-7 Days", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "ageing8to30", header: "8-30 Days", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "ageing31to60", header: "31-60 Days", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
  { key: "ageing60plus", header: "60+ Days", format: (v) => (v > 0 ? csvExporter.formatINR(v) : "") },
];

const CREDITORS_REPORT_COLUMNS: ColumnConfig<CreditorsReportEntry>[] = [
  { key: "towards", header: "Supplier/Towards" },
  { key: "openingBalance", header: "Opening Balance", format: (v) => csvExporter.formatINR(v) },
  { key: "creditTaken", header: "Credit Taken", format: (v) => csvExporter.formatINR(v) },
  { key: "paid", header: "Paid", format: (v) => csvExporter.formatINR(v) },
  { key: "closingBalance", header: "Closing Balance", format: (v) => csvExporter.formatINR(v) },
  { key: "oldestUnpaidDays", header: "Oldest Unpaid (Days)" },
];

const ADVANCE_LIABILITY_COLUMNS: ColumnConfig<AdvanceLiabilityEntry>[] = [
  { key: "customer", header: "Customer" },
  { key: "contact", header: "Contact" },
  { key: "openingBalance", header: "Opening Balance", format: (v) => csvExporter.formatINR(v) },
  { key: "added", header: "Added", format: (v) => csvExporter.formatINR(v) },
  { key: "applied", header: "Applied", format: (v) => csvExporter.formatINR(v) },
  { key: "refunded", header: "Refunded", format: (v) => csvExporter.formatINR(v) },
  { key: "closingBalance", header: "Closing Balance", format: (v) => csvExporter.formatINR(v) },
];

const DAILY_SUMMARY_COLUMNS: ColumnConfig<DailySummaryEntry>[] = [
  { key: "date", header: "Date" },
  { key: "billCount", header: "Bills" },
  { key: "revenue", header: "Revenue", format: (v) => csvExporter.formatINR(v) },
  { key: "cashIn", header: "Cash In", format: (v) => csvExporter.formatINR(v) },
  { key: "upiIn", header: "UPI In", format: (v) => csvExporter.formatINR(v) },
  { key: "creditGiven", header: "Credit Given", format: (v) => csvExporter.formatINR(v) },
  { key: "creditCleared", header: "Credit Cleared", format: (v) => csvExporter.formatINR(v) },
  { key: "expenses", header: "Expenses", format: (v) => csvExporter.formatINR(v) },
  { key: "netCash", header: "Net Cash", format: (v) => csvExporter.formatINR(v) },
  { key: "netUpi", header: "Net UPI", format: (v) => csvExporter.formatINR(v) },
];

const MONTHLY_SUMMARY_COLUMNS: ColumnConfig<MonthlySummaryEntry>[] = [
  { key: "month", header: "Month" },
  { key: "billCount", header: "Bills" },
  { key: "revenue", header: "Revenue", format: (v) => csvExporter.formatINR(v) },
  { key: "cashReceived", header: "Cash Received", format: (v) => csvExporter.formatINR(v) },
  { key: "upiReceived", header: "UPI Received", format: (v) => csvExporter.formatINR(v) },
  { key: "creditAccrued", header: "Credit Accrued", format: (v) => csvExporter.formatINR(v) },
  { key: "creditCleared", header: "Credit Cleared", format: (v) => csvExporter.formatINR(v) },
  { key: "totalExpenses", header: "Total Expenses", format: (v) => csvExporter.formatINR(v) },
  { key: "profit", header: "Profit", format: (v) => csvExporter.formatINR(v) },
];

const ITEMWISE_SALES_COLUMNS: ColumnConfig<ItemwiseSalesEntry>[] = [
  { key: "itemName", header: "Item Name" },
  { key: "category", header: "Category" },
  { key: "quantitySold", header: "Qty Sold" },
  { key: "revenue", header: "Revenue", format: (v) => csvExporter.formatINR(v) },
  { key: "avgPrice", header: "Avg Price", format: (v) => csvExporter.formatINR(v) },
  { key: "percentOfTotal", header: "% of Total", format: (v) => `${v.toFixed(1)}%` },
];

const CUSTOMER_ANALYSIS_COLUMNS: ColumnConfig<CustomerAnalysisEntry>[] = [
  { key: "customer", header: "Customer" },
  { key: "contact", header: "Contact" },
  { key: "totalBills", header: "Total Bills" },
  { key: "totalRevenue", header: "Total Revenue", format: (v) => csvExporter.formatINR(v) },
  { key: "cashPaid", header: "Cash Paid", format: (v) => csvExporter.formatINR(v) },
  { key: "upiPaid", header: "UPI Paid", format: (v) => csvExporter.formatINR(v) },
  { key: "creditOutstanding", header: "Credit Outstanding", format: (v) => csvExporter.formatINR(v) },
  { key: "advanceBalance", header: "Advance Balance", format: (v) => csvExporter.formatINR(v) },
  { key: "lastTransactionDate", header: "Last Transaction" },
];

const RECEIPT_REGISTER_COLUMNS: ColumnConfig<ReceiptRegisterEntry>[] = [
  { key: "receiptNo", header: "Receipt No" },
  { key: "date", header: "Date" },
  { key: "customer", header: "Customer" },
  { key: "billNo", header: "Bill No", format: (v) => (v ? String(v) : "-") },
  { key: "amount", header: "Amount", format: (v) => csvExporter.formatINR(v) },
  { key: "mode", header: "Mode" },
  { key: "remarks", header: "Remarks" },
];

const BILL_REGISTER_COLUMNS: ColumnConfig<BillRegisterEntry>[] = [
  { key: "billNo", header: "Bill No" },
  { key: "date", header: "Date" },
  { key: "customer", header: "Customer" },
  { key: "kotNumbers", header: "KOT Numbers" },
  { key: "totalAmount", header: "Total Amount", format: (v) => csvExporter.formatINR(v) },
  { key: "paymentStatus", header: "Payment Status" },
];

// ============================================================================
// Report Service Class
// ============================================================================

class ReportService {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Cash Book Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Cash Book report - all cash transactions with running balance
   *
   * Includes:
   * - Cash received from sales (receipts with mode='Cash' or split_payments with paymentType='Cash')
   * - Cash received from credit clearances (payments with mode='Cash' and subType='Clearance')
   * - Cash expenses paid (expense_settlements with paymentType='Cash')
   * - Customer advance additions (if paid in cash - future enhancement)
   */
  async getCashBook(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<CashBookEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching cash receipts...",
      "Fetching cash payments...",
      "Fetching cash expenses...",
      "Calculating running balance...",
      "Finalizing report...",
    ];

    let progress = createProgress("cashBook", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Fetch cash receipts (sales received in cash)
    progress = updateProgressStep(progress, 0, "in-progress", 10);
    onProgress?.(progress);

    // Get receipts where mode is Cash (simple receipt) or has Cash split payment
    const cashReceipts = (await db.getAllAsync(
      `
      SELECT 
        r.id,
        r.receiptNo,
        r.createdAt,
        c.name as customerName,
        r.amount as receiptAmount,
        r.mode,
        COALESCE(
          (SELECT SUM(sp.amount) FROM split_payments sp 
           WHERE sp.receiptId = r.id AND sp.paymentType = 'Cash'),
          CASE WHEN r.mode = 'Cash' THEN r.amount ELSE 0 END
        ) as cashAmount
      FROM receipts r
      LEFT JOIN customers c ON r.customerId = c.id
      WHERE r.createdAt >= ? AND r.createdAt < ?
        AND (r.mode = 'Cash' OR r.mode = 'Split')
      ORDER BY r.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Fetch cash payments (credit clearances in cash)
    progress = updateProgressStep(progress, 1, "in-progress", 30);
    onProgress?.(progress);

    const cashPayments = (await db.getAllAsync(
      `
      SELECT 
        p.id,
        p.createdAt,
        c.name as customerName,
        p.amount,
        p.subType,
        b.billNumber
      FROM payments p
      LEFT JOIN customers c ON p.customerId = c.id
      LEFT JOIN bills b ON p.billId = b.id
      WHERE p.createdAt >= ? AND p.createdAt < ?
        AND p.mode = 'Cash'
        AND p.subType = 'Clearance'
      ORDER BY p.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 3: Fetch cash expenses
    progress = updateProgressStep(progress, 2, "in-progress", 50);
    onProgress?.(progress);

    const cashExpenses = (await db.getAllAsync(
      `
      SELECT 
        e.id,
        e.voucherNo,
        e.createdAt,
        e.towards,
        es.amount as cashAmount
      FROM expenses e
      INNER JOIN expense_settlements es ON es.expenseId = e.id
      WHERE e.createdAt >= ? AND e.createdAt < ?
        AND es.paymentType = 'Cash'
        AND (es.subType IS NULL OR es.subType = '')
        AND (es.deletedAt IS NULL)
      ORDER BY e.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 4: Combine and sort all transactions, calculate running balance
    progress = updateProgressStep(progress, 3, "in-progress", 70);
    onProgress?.(progress);

    interface CashTransaction {
      date: string;
      createdAt: string;
      particulars: string;
      referenceNo: string;
      debit: number;
      credit: number;
    }

    const transactions: CashTransaction[] = [];

    // Add cash receipts (debit = cash in)
    for (const r of cashReceipts) {
      const cashAmt = r.cashAmount || 0;
      if (cashAmt > 0) {
        transactions.push({
          date: formatDisplayDate(r.createdAt),
          createdAt: r.createdAt,
          particulars: `Sales - ${r.customerName || "Customer"}`,
          referenceNo: `R-${r.receiptNo}`,
          debit: cashAmt,
          credit: 0,
        });
      }
    }

    // Add cash payments/clearances (debit = cash in)
    for (const p of cashPayments) {
      transactions.push({
        date: formatDisplayDate(p.createdAt),
        createdAt: p.createdAt,
        particulars: `Credit Clearance - ${p.customerName || "Customer"}${p.billNumber ? ` (Bill #${p.billNumber})` : ""}`,
        referenceNo: "",
        debit: p.amount,
        credit: 0,
      });
    }

    // Add cash expenses (credit = cash out)
    for (const e of cashExpenses) {
      transactions.push({
        date: formatDisplayDate(e.createdAt),
        createdAt: e.createdAt,
        particulars: `Expense - ${e.towards}`,
        referenceNo: `V-${e.voucherNo}`,
        debit: 0,
        credit: e.cashAmount,
      });
    }

    // Sort by createdAt
    transactions.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    cancellationToken?.throwIfCancelled();

    // Step 5: Calculate running balance
    progress = updateProgressStep(progress, 4, "in-progress", 90);
    onProgress?.(progress);

    let runningBalance = 0;
    const entries: CashBookEntry[] = transactions.map((t) => {
      runningBalance += t.debit - t.credit;
      return {
        date: t.date,
        particulars: t.particulars,
        referenceNo: t.referenceNo,
        debit: t.debit,
        credit: t.credit,
        balance: runningBalance,
      };
    });

    // Mark complete
    progress = updateProgressStep(progress, 4, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    progress.estimatedSecondsRemaining = 0;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. UPI/Bank Book Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates UPI/Bank Book report - all UPI/digital transactions with running balance
   *
   * Includes:
   * - UPI received from sales (receipts with mode='UPI' or split_payments with paymentType='UPI')
   * - UPI received from credit clearances (payments with mode='UPI' and subType='Clearance')
   * - UPI expenses paid (expense_settlements with paymentType='UPI')
   */
  async getUPIBook(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<UPIBookEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching UPI receipts...",
      "Fetching UPI payments...",
      "Fetching UPI expenses...",
      "Calculating running balance...",
      "Finalizing report...",
    ];

    let progress = createProgress("upiBook", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Fetch UPI receipts (sales received via UPI)
    progress = updateProgressStep(progress, 0, "in-progress", 10);
    onProgress?.(progress);

    // Get receipts where mode is UPI (simple receipt) or has UPI split payment
    const upiReceipts = (await db.getAllAsync(
      `
      SELECT 
        r.id,
        r.receiptNo,
        r.createdAt,
        c.name as customerName,
        r.amount as receiptAmount,
        r.mode,
        COALESCE(
          (SELECT SUM(sp.amount) FROM split_payments sp 
           WHERE sp.receiptId = r.id AND sp.paymentType = 'UPI'),
          CASE WHEN r.mode = 'UPI' THEN r.amount ELSE 0 END
        ) as upiAmount
      FROM receipts r
      LEFT JOIN customers c ON r.customerId = c.id
      WHERE r.createdAt >= ? AND r.createdAt < ?
        AND (r.mode = 'UPI' OR r.mode = 'Split')
      ORDER BY r.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Fetch UPI payments (credit clearances via UPI)
    progress = updateProgressStep(progress, 1, "in-progress", 30);
    onProgress?.(progress);

    const upiPayments = (await db.getAllAsync(
      `
      SELECT 
        p.id,
        p.createdAt,
        c.name as customerName,
        p.amount,
        p.subType,
        b.billNumber
      FROM payments p
      LEFT JOIN customers c ON p.customerId = c.id
      LEFT JOIN bills b ON p.billId = b.id
      WHERE p.createdAt >= ? AND p.createdAt < ?
        AND p.mode = 'UPI'
        AND p.subType = 'Clearance'
      ORDER BY p.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 3: Fetch UPI expenses
    progress = updateProgressStep(progress, 2, "in-progress", 50);
    onProgress?.(progress);

    const upiExpenses = (await db.getAllAsync(
      `
      SELECT 
        e.id,
        e.voucherNo,
        e.createdAt,
        e.towards,
        es.amount as upiAmount
      FROM expenses e
      INNER JOIN expense_settlements es ON es.expenseId = e.id
      WHERE e.createdAt >= ? AND e.createdAt < ?
        AND es.paymentType = 'UPI'
        AND (es.subType IS NULL OR es.subType = '')
        AND (es.deletedAt IS NULL)
      ORDER BY e.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 4: Combine and sort all transactions, calculate running balance
    progress = updateProgressStep(progress, 3, "in-progress", 70);
    onProgress?.(progress);

    interface UPITransaction {
      date: string;
      createdAt: string;
      particulars: string;
      referenceNo: string;
      debit: number;
      credit: number;
    }

    const transactions: UPITransaction[] = [];

    // Add UPI receipts (debit = UPI in)
    for (const r of upiReceipts) {
      const upiAmt = r.upiAmount || 0;
      if (upiAmt > 0) {
        transactions.push({
          date: formatDisplayDate(r.createdAt),
          createdAt: r.createdAt,
          particulars: `Sales - ${r.customerName || "Customer"}`,
          referenceNo: `R-${r.receiptNo}`,
          debit: upiAmt,
          credit: 0,
        });
      }
    }

    // Add UPI payments/clearances (debit = UPI in)
    for (const p of upiPayments) {
      transactions.push({
        date: formatDisplayDate(p.createdAt),
        createdAt: p.createdAt,
        particulars: `Credit Clearance - ${p.customerName || "Customer"}${p.billNumber ? ` (Bill #${p.billNumber})` : ""}`,
        referenceNo: "",
        debit: p.amount,
        credit: 0,
      });
    }

    // Add UPI expenses (credit = UPI out)
    for (const e of upiExpenses) {
      transactions.push({
        date: formatDisplayDate(e.createdAt),
        createdAt: e.createdAt,
        particulars: `Expense - ${e.towards}`,
        referenceNo: `V-${e.voucherNo}`,
        debit: 0,
        credit: e.upiAmount,
      });
    }

    // Sort by createdAt
    transactions.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    cancellationToken?.throwIfCancelled();

    // Step 5: Calculate running balance
    progress = updateProgressStep(progress, 4, "in-progress", 90);
    onProgress?.(progress);

    let runningBalance = 0;
    const entries: UPIBookEntry[] = transactions.map((t) => {
      runningBalance += t.debit - t.credit;
      return {
        date: t.date,
        particulars: t.particulars,
        referenceNo: t.referenceNo,
        debit: t.debit,
        credit: t.credit,
        balance: runningBalance,
      };
    });

    // Mark complete
    progress = updateProgressStep(progress, 4, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    progress.estimatedSecondsRemaining = 0;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Sales Register Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Sales Register - all bills with payment breakdown
   */
  async getSalesRegister(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<SalesRegisterEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching bills...",
      "Fetching payment details...",
      "Processing data...",
      "Finalizing report...",
    ];

    let progress = createProgress("salesRegister", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Fetch all bills in date range
    progress = updateProgressStep(progress, 0, "in-progress", 10);
    onProgress?.(progress);

    const bills = (await db.getAllAsync(
      `
      SELECT 
        b.id,
        b.billNumber,
        b.total,
        b.createdAt,
        c.name as customerName
      FROM bills b
      LEFT JOIN customers c ON b.customerId = c.id
      WHERE b.createdAt >= ? AND b.createdAt < ?
      ORDER BY b.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Fetch split payments and receipts for each bill
    progress = updateProgressStep(progress, 1, "in-progress", 40);
    onProgress?.(progress);

    const entries: SalesRegisterEntry[] = [];

    for (const bill of bills) {
      cancellationToken?.throwIfCancelled();

      // Get receipt for this bill
      const receipt = (await db.getFirstAsync(
        `SELECT id, mode, amount FROM receipts WHERE billId = ?`,
        [bill.id]
      )) as any;

      let cashAmount = 0;
      let upiAmount = 0;
      let creditAmount = 0;
      let advanceUsed = 0;
      let paymentMode = "Unknown";

      if (receipt) {
        if (receipt.mode === "Split") {
          // Get split payments
          const splits = (await db.getAllAsync(
            `SELECT paymentType, SUM(amount) as total FROM split_payments 
             WHERE receiptId = ? GROUP BY paymentType`,
            [receipt.id]
          )) as any[];

          for (const sp of splits) {
            if (sp.paymentType === "Cash") cashAmount = sp.total || 0;
            else if (sp.paymentType === "UPI") upiAmount = sp.total || 0;
            else if (sp.paymentType === "Credit") creditAmount = sp.total || 0;
            else if (sp.paymentType === "AdvanceUse") advanceUsed = sp.total || 0;
          }
          paymentMode = "Split";
        } else {
          paymentMode = receipt.mode;
          if (receipt.mode === "Cash") cashAmount = receipt.amount;
          else if (receipt.mode === "UPI") upiAmount = receipt.amount;
          else if (receipt.mode === "Credit") creditAmount = receipt.amount;
        }
      }

      entries.push({
        date: formatDisplayDate(bill.createdAt),
        billNo: bill.billNumber,
        customer: bill.customerName || "Unknown",
        grossAmount: bill.total,
        paymentMode,
        cashAmount,
        upiAmount,
        creditAmount,
        advanceUsed,
      });
    }

    // Step 3: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Expense Register Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Expense Register - all expenses with voucher details
   */
  async getExpenseRegister(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<ExpenseRegisterEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching expenses...",
      "Fetching settlements...",
      "Processing data...",
      "Finalizing report...",
    ];

    let progress = createProgress("expenseRegister", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Fetch all expenses in date range
    progress = updateProgressStep(progress, 0, "in-progress", 10);
    onProgress?.(progress);

    const expenses = (await db.getAllAsync(
      `
      SELECT 
        e.id,
        e.voucherNo,
        e.amount,
        e.towards,
        e.mode,
        e.remarks,
        e.createdAt
      FROM expenses e
      WHERE e.createdAt >= ? AND e.createdAt < ?
      ORDER BY e.createdAt ASC
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Fetch settlements for each expense
    progress = updateProgressStep(progress, 1, "in-progress", 40);
    onProgress?.(progress);

    const entries: ExpenseRegisterEntry[] = [];

    for (const exp of expenses) {
      cancellationToken?.throwIfCancelled();

      // Get settlements for this expense
      const settlements = (await db.getAllAsync(
        `SELECT paymentType, subType, SUM(amount) as total 
         FROM expense_settlements 
         WHERE expenseId = ? AND (deletedAt IS NULL)
         GROUP BY paymentType, subType`,
        [exp.id]
      )) as any[];

      let cashPaid = 0;
      let upiPaid = 0;
      let creditAmount = 0;

      for (const s of settlements) {
        // Only count non-clearance settlements as paid
        if (s.subType !== "Clearance") {
          if (s.paymentType === "Cash") cashPaid = s.total || 0;
          else if (s.paymentType === "UPI") upiPaid = s.total || 0;
          else if (s.paymentType === "Credit") creditAmount = s.total || 0;
        }
      }

      entries.push({
        date: formatDisplayDate(exp.createdAt),
        voucherNo: exp.voucherNo,
        particulars: exp.towards,
        amount: exp.amount,
        mode: exp.mode,
        cashPaid,
        upiPaid,
        creditAmount,
        remarks: exp.remarks || "",
      });
    }

    // Step 3: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Debtors Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Debtors Report - customer outstanding with ageing
   */
  async getDebtorsReport(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<DebtorsReportEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching customers...",
      "Calculating credit movements...",
      "Computing ageing buckets...",
      "Finalizing report...",
    ];

    let progress = createProgress("debtorsReport", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    const startDate = new Date(startUtc);
    const endDate = new Date(endUtc);
    const now = new Date();

    cancellationToken?.throwIfCancelled();

    // Step 1: Get all customers with their current credit balance
    progress = updateProgressStep(progress, 0, "in-progress", 20);
    onProgress?.(progress);

    const customers = (await db.getAllAsync(
      `SELECT id, name, contact, COALESCE(creditBalance, 0) as creditBalance 
       FROM customers ORDER BY name ASC`
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2 & 3: Calculate movements and ageing for each customer
    progress = updateProgressStep(progress, 1, "in-progress", 50);
    onProgress?.(progress);

    const entries: DebtorsReportEntry[] = [];

    for (const cust of customers) {
      cancellationToken?.throwIfCancelled();

      // Credit given in period (payments with mode='Credit' and subType='Accrual')
      const creditGivenResult = (await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
         WHERE customerId = ? AND mode = 'Credit' AND subType = 'Accrual'
         AND createdAt >= ? AND createdAt < ?`,
        [cust.id, startUtc, endUtc]
      )) as any;
      const creditGiven = creditGivenResult?.total || 0;

      // Payments received in period (clearances)
      const paymentsResult = (await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
         WHERE customerId = ? AND subType = 'Clearance'
         AND createdAt >= ? AND createdAt < ?`,
        [cust.id, startUtc, endUtc]
      )) as any;
      const paymentsReceived = paymentsResult?.total || 0;

      // Opening balance = closing - creditGiven + paymentsReceived
      const closingBalance = cust.creditBalance;
      const openingBalance = closingBalance - creditGiven + paymentsReceived;

      // Only include customers with any credit activity or balance
      if (openingBalance === 0 && creditGiven === 0 && closingBalance === 0) {
        continue;
      }

      // Ageing calculation based on unpaid credit transactions
      let ageing0to7 = 0;
      let ageing8to30 = 0;
      let ageing31to60 = 0;
      let ageing60plus = 0;

      // Get unpaid credit transactions (simplified ageing based on current outstanding)
      // In a more complex system, you'd track individual invoices
      const daysOld = Math.floor(
        (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (closingBalance > 0) {
        if (daysOld <= 7) ageing0to7 = closingBalance;
        else if (daysOld <= 30) ageing8to30 = closingBalance;
        else if (daysOld <= 60) ageing31to60 = closingBalance;
        else ageing60plus = closingBalance;
      }

      entries.push({
        customer: cust.name,
        contact: cust.contact || "",
        openingBalance,
        creditGiven,
        paymentsReceived,
        closingBalance,
        ageing0to7,
        ageing8to30,
        ageing31to60,
        ageing60plus,
      });
    }

    // Step 4: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Creditors Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Creditors Report - expense credit outstanding
   */
  async getCreditorsReport(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<CreditorsReportEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching expense credits...",
      "Calculating settlements...",
      "Computing outstanding...",
      "Finalizing report...",
    ];

    let progress = createProgress("creditorsReport", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Get all expenses with credit in the period
    progress = updateProgressStep(progress, 0, "in-progress", 20);
    onProgress?.(progress);

    // Group by 'towards' field to aggregate by supplier
    const creditExpenses = (await db.getAllAsync(
      `
      SELECT 
        e.towards,
        SUM(es.amount) as creditTaken,
        MIN(e.createdAt) as oldestCredit
      FROM expenses e
      INNER JOIN expense_settlements es ON es.expenseId = e.id
      WHERE e.createdAt >= ? AND e.createdAt < ?
        AND es.paymentType = 'Credit'
        AND (es.subType IS NULL OR es.subType = '' OR es.subType = 'Accrual')
        AND es.deletedAt IS NULL
      GROUP BY e.towards
      `,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Get clearances for each supplier
    progress = updateProgressStep(progress, 1, "in-progress", 50);
    onProgress?.(progress);

    const entries: CreditorsReportEntry[] = [];
    const now = new Date();

    for (const exp of creditExpenses) {
      cancellationToken?.throwIfCancelled();

      // Get clearances for this supplier
      const clearanceResult = (await db.getFirstAsync(
        `
        SELECT COALESCE(SUM(es.amount), 0) as totalCleared
        FROM expense_settlements es
        INNER JOIN expenses e ON es.expenseId = e.id
        WHERE e.towards = ?
          AND es.subType = 'Clearance'
          AND es.deletedAt IS NULL
          AND e.createdAt >= ? AND e.createdAt < ?
        `,
        [exp.towards, startUtc, endUtc]
      )) as any;

      const paid = clearanceResult?.totalCleared || 0;
      const creditTaken = exp.creditTaken || 0;
      const closingBalance = creditTaken - paid;

      // Calculate days since oldest unpaid
      const oldestDate = new Date(exp.oldestCredit);
      const daysOld = Math.floor(
        (now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (creditTaken > 0 || closingBalance > 0) {
        entries.push({
          towards: exp.towards,
          openingBalance: 0, // Would need historical data for true opening
          creditTaken,
          paid,
          closingBalance,
          oldestUnpaidDays: closingBalance > 0 ? daysOld : 0,
        });
      }
    }

    // Step 3: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Advance Liability Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Advance Liability Report - customer prepaid balances
   */
  async getAdvanceLiability(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<AdvanceLiabilityEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching customers...",
      "Calculating advance movements...",
      "Computing balances...",
      "Finalizing report...",
    ];

    let progress = createProgress("advanceLiability", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Get all customers
    progress = updateProgressStep(progress, 0, "in-progress", 20);
    onProgress?.(progress);

    const customers = (await db.getAllAsync(
      `SELECT id, name, contact FROM customers ORDER BY name ASC`
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Calculate advance movements for each customer
    progress = updateProgressStep(progress, 1, "in-progress", 50);
    onProgress?.(progress);

    const entries: AdvanceLiabilityEntry[] = [];

    for (const cust of customers) {
      cancellationToken?.throwIfCancelled();

      // Get advance movements in period
      const movements = (await db.getAllAsync(
        `SELECT entryType, COALESCE(SUM(amount), 0) as total
         FROM customer_advances
         WHERE customerId = ? AND deletedAt IS NULL
           AND createdAt >= ? AND createdAt < ?
         GROUP BY entryType`,
        [cust.id, startUtc, endUtc]
      )) as any[];

      let added = 0;
      let applied = 0;
      let refunded = 0;

      for (const m of movements) {
        if (m.entryType === "Add") added = m.total;
        else if (m.entryType === "Apply") applied = m.total;
        else if (m.entryType === "Refund") refunded = m.total;
      }

      // Get current total balance
      const balanceResult = (await db.getFirstAsync(
        `SELECT 
          COALESCE(SUM(CASE WHEN entryType='Add' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN entryType='Apply' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN entryType='Refund' THEN amount ELSE 0 END), 0) as balance
         FROM customer_advances
         WHERE customerId = ? AND deletedAt IS NULL`,
        [cust.id]
      )) as any;

      const closingBalance = balanceResult?.balance || 0;
      const openingBalance = closingBalance - added + applied + refunded;

      // Only include customers with advance activity or balance
      if (added === 0 && applied === 0 && refunded === 0 && closingBalance === 0) {
        continue;
      }

      entries.push({
        customer: cust.name,
        contact: cust.contact || "",
        openingBalance,
        added,
        applied,
        refunded,
        closingBalance,
      });
    }

    // Step 3: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Daily Summary Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Daily Summary - day-wise totals
   */
  async getDailySummary(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<DailySummaryEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching daily bills...",
      "Fetching daily payments...",
      "Fetching daily expenses...",
      "Aggregating data...",
      "Finalizing report...",
    ];

    let progress = createProgress("dailySummary", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Get daily bill totals
    progress = updateProgressStep(progress, 0, "in-progress", 20);
    onProgress?.(progress);

    const dailyBills = (await db.getAllAsync(
      `SELECT 
        date(createdAt) as day,
        COUNT(*) as billCount,
        SUM(total) as revenue
       FROM bills
       WHERE createdAt >= ? AND createdAt < ?
       GROUP BY date(createdAt)
       ORDER BY day ASC`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Get daily payment breakdown
    progress = updateProgressStep(progress, 1, "in-progress", 40);
    onProgress?.(progress);

    // Cash receipts by day
    const dailyCash = (await db.getAllAsync(
      `SELECT date(r.createdAt) as day, SUM(
        COALESCE(
          (SELECT SUM(sp.amount) FROM split_payments sp WHERE sp.receiptId = r.id AND sp.paymentType = 'Cash'),
          CASE WHEN r.mode = 'Cash' THEN r.amount ELSE 0 END
        )
       ) as total
       FROM receipts r
       WHERE r.createdAt >= ? AND r.createdAt < ?
       GROUP BY date(r.createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    const dailyUpi = (await db.getAllAsync(
      `SELECT date(r.createdAt) as day, SUM(
        COALESCE(
          (SELECT SUM(sp.amount) FROM split_payments sp WHERE sp.receiptId = r.id AND sp.paymentType = 'UPI'),
          CASE WHEN r.mode = 'UPI' THEN r.amount ELSE 0 END
        )
       ) as total
       FROM receipts r
       WHERE r.createdAt >= ? AND r.createdAt < ?
       GROUP BY date(r.createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    // Credit given by day
    const dailyCreditGiven = (await db.getAllAsync(
      `SELECT date(createdAt) as day, SUM(amount) as total
       FROM payments
       WHERE mode = 'Credit' AND subType = 'Accrual'
         AND createdAt >= ? AND createdAt < ?
       GROUP BY date(createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    // Credit cleared by day
    const dailyCreditCleared = (await db.getAllAsync(
      `SELECT date(createdAt) as day, SUM(amount) as total
       FROM payments
       WHERE subType = 'Clearance'
         AND createdAt >= ? AND createdAt < ?
       GROUP BY date(createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 3: Get daily expenses
    progress = updateProgressStep(progress, 2, "in-progress", 60);
    onProgress?.(progress);

    const dailyExpenses = (await db.getAllAsync(
      `SELECT date(createdAt) as day, SUM(amount) as total
       FROM expenses
       WHERE createdAt >= ? AND createdAt < ?
       GROUP BY date(createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    const dailyExpensesCash = (await db.getAllAsync(
      `SELECT date(e.createdAt) as day, SUM(es.amount) as total
       FROM expenses e
       INNER JOIN expense_settlements es ON es.expenseId = e.id
       WHERE e.createdAt >= ? AND e.createdAt < ?
         AND es.paymentType = 'Cash'
         AND (es.subType IS NULL OR es.subType = '')
       GROUP BY date(e.createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    const dailyExpensesUpi = (await db.getAllAsync(
      `SELECT date(e.createdAt) as day, SUM(es.amount) as total
       FROM expenses e
       INNER JOIN expense_settlements es ON es.expenseId = e.id
       WHERE e.createdAt >= ? AND e.createdAt < ?
         AND es.paymentType = 'UPI'
         AND (es.subType IS NULL OR es.subType = '')
       GROUP BY date(e.createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 4: Aggregate into entries
    progress = updateProgressStep(progress, 3, "in-progress", 80);
    onProgress?.(progress);

    // Create lookup maps
    const lookup = (arr: any[], key: string) => {
      const map: Record<string, number> = {};
      for (const item of arr) {
        map[item.day] = item.total || 0;
      }
      return map;
    };

    const cashMap = lookup(dailyCash, "day");
    const upiMap = lookup(dailyUpi, "day");
    const creditGivenMap = lookup(dailyCreditGiven, "day");
    const creditClearedMap = lookup(dailyCreditCleared, "day");
    const expensesMap = lookup(dailyExpenses, "day");
    const expensesCashMap = lookup(dailyExpensesCash, "day");
    const expensesUpiMap = lookup(dailyExpensesUpi, "day");

    const entries: DailySummaryEntry[] = dailyBills.map((b) => {
      const day = b.day;
      const cashIn = cashMap[day] || 0;
      const upiIn = upiMap[day] || 0;
      const expensesCash = expensesCashMap[day] || 0;
      const expensesUpi = expensesUpiMap[day] || 0;

      return {
        date: formatDisplayDate(day),
        billCount: b.billCount,
        revenue: b.revenue,
        cashIn,
        upiIn,
        creditGiven: creditGivenMap[day] || 0,
        creditCleared: creditClearedMap[day] || 0,
        expenses: expensesMap[day] || 0,
        expensesCash,
        expensesUpi,
        expensesCredit: (expensesMap[day] || 0) - expensesCash - expensesUpi,
        netCash: cashIn - expensesCash,
        netUpi: upiIn - expensesUpi,
      };
    });

    // Step 5: Finalize
    progress = updateProgressStep(progress, 4, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Monthly Summary Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Monthly Summary - month-wise totals
   */
  async getMonthlySummary(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<MonthlySummaryEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching monthly data...",
      "Aggregating bills...",
      "Aggregating payments...",
      "Calculating profit...",
      "Finalizing report...",
    ];

    let progress = createProgress("monthlySummary", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Get monthly bill totals
    progress = updateProgressStep(progress, 0, "in-progress", 20);
    onProgress?.(progress);

    const monthlyBills = (await db.getAllAsync(
      `SELECT 
        strftime('%Y-%m', createdAt) as month,
        COUNT(*) as billCount,
        SUM(total) as revenue
       FROM bills
       WHERE createdAt >= ? AND createdAt < ?
       GROUP BY strftime('%Y-%m', createdAt)
       ORDER BY month ASC`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Get monthly payment data
    progress = updateProgressStep(progress, 1, "in-progress", 40);
    onProgress?.(progress);

    const monthlyCash = (await db.getAllAsync(
      `SELECT strftime('%Y-%m', r.createdAt) as month, SUM(
        COALESCE(
          (SELECT SUM(sp.amount) FROM split_payments sp WHERE sp.receiptId = r.id AND sp.paymentType = 'Cash'),
          CASE WHEN r.mode = 'Cash' THEN r.amount ELSE 0 END
        )
       ) as total
       FROM receipts r
       WHERE r.createdAt >= ? AND r.createdAt < ?
       GROUP BY strftime('%Y-%m', r.createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    const monthlyUpi = (await db.getAllAsync(
      `SELECT strftime('%Y-%m', r.createdAt) as month, SUM(
        COALESCE(
          (SELECT SUM(sp.amount) FROM split_payments sp WHERE sp.receiptId = r.id AND sp.paymentType = 'UPI'),
          CASE WHEN r.mode = 'UPI' THEN r.amount ELSE 0 END
        )
       ) as total
       FROM receipts r
       WHERE r.createdAt >= ? AND r.createdAt < ?
       GROUP BY strftime('%Y-%m', r.createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    const monthlyCreditAccrued = (await db.getAllAsync(
      `SELECT strftime('%Y-%m', createdAt) as month, SUM(amount) as total
       FROM payments
       WHERE mode = 'Credit' AND subType = 'Accrual'
         AND createdAt >= ? AND createdAt < ?
       GROUP BY strftime('%Y-%m', createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    const monthlyCreditCleared = (await db.getAllAsync(
      `SELECT strftime('%Y-%m', createdAt) as month, SUM(amount) as total
       FROM payments
       WHERE subType = 'Clearance'
         AND createdAt >= ? AND createdAt < ?
       GROUP BY strftime('%Y-%m', createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 3: Get monthly expenses
    progress = updateProgressStep(progress, 2, "in-progress", 60);
    onProgress?.(progress);

    const monthlyExpenses = (await db.getAllAsync(
      `SELECT strftime('%Y-%m', createdAt) as month, SUM(amount) as total
       FROM expenses
       WHERE createdAt >= ? AND createdAt < ?
       GROUP BY strftime('%Y-%m', createdAt)`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 4: Aggregate into entries
    progress = updateProgressStep(progress, 3, "in-progress", 80);
    onProgress?.(progress);

    const lookup = (arr: any[]) => {
      const map: Record<string, number> = {};
      for (const item of arr) {
        map[item.month] = item.total || 0;
      }
      return map;
    };

    const cashMap = lookup(monthlyCash);
    const upiMap = lookup(monthlyUpi);
    const creditAccruedMap = lookup(monthlyCreditAccrued);
    const creditClearedMap = lookup(monthlyCreditCleared);
    const expensesMap = lookup(monthlyExpenses);

    const entries: MonthlySummaryEntry[] = monthlyBills.map((b) => {
      const monthKey = b.month;
      const revenue = b.revenue || 0;
      const totalExpenses = expensesMap[monthKey] || 0;

      // Format month for display
      const [year, month] = monthKey.split("-");
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const displayMonth = `${monthNames[parseInt(month) - 1]} ${year}`;

      return {
        month: displayMonth,
        billCount: b.billCount,
        revenue,
        cashReceived: cashMap[monthKey] || 0,
        upiReceived: upiMap[monthKey] || 0,
        creditAccrued: creditAccruedMap[monthKey] || 0,
        creditCleared: creditClearedMap[monthKey] || 0,
        totalExpenses,
        profit: revenue - totalExpenses,
      };
    });

    // Step 5: Finalize
    progress = updateProgressStep(progress, 4, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Item-wise Sales Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Item-wise Sales - product performance analysis
   */
  async getItemwiseSales(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<ItemwiseSalesEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching item sales...",
      "Calculating totals...",
      "Computing percentages...",
      "Finalizing report...",
    ];

    let progress = createProgress("itemwiseSales", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Get item-wise sales from KOT items (linked to billed orders)
    progress = updateProgressStep(progress, 0, "in-progress", 30);
    onProgress?.(progress);

    const itemSales = (await db.getAllAsync(
      `SELECT 
        mi.id as itemId,
        mi.name as itemName,
        COALESCE(mi.category, 'Uncategorized') as category,
        SUM(ki.quantity) as quantitySold,
        SUM(ki.quantity * ki.priceAtTime) as revenue
       FROM kot_items ki
       INNER JOIN kot_orders ko ON ki.kotId = ko.id
       INNER JOIN menu_items mi ON ki.itemId = mi.id
       WHERE ko.billId IS NOT NULL
         AND ko.createdAt >= ? AND ko.createdAt < ?
       GROUP BY mi.id, mi.name, mi.category
       ORDER BY revenue DESC`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Calculate totals
    progress = updateProgressStep(progress, 1, "in-progress", 60);
    onProgress?.(progress);

    const totalRevenue = itemSales.reduce((sum, item) => sum + (item.revenue || 0), 0);

    // Step 3: Build entries with percentages
    progress = updateProgressStep(progress, 2, "in-progress", 80);
    onProgress?.(progress);

    const entries: ItemwiseSalesEntry[] = itemSales.map((item) => ({
      itemName: item.itemName,
      category: item.category,
      quantitySold: item.quantitySold || 0,
      revenue: item.revenue || 0,
      avgPrice: item.quantitySold > 0 ? (item.revenue || 0) / item.quantitySold : 0,
      percentOfTotal: totalRevenue > 0 ? ((item.revenue || 0) / totalRevenue) * 100 : 0,
    }));

    // Step 4: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Customer Analysis Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Customer Analysis - customer-wise revenue & credit
   */
  async getCustomerAnalysis(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<CustomerAnalysisEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching customer data...",
      "Calculating revenue...",
      "Computing balances...",
      "Finalizing report...",
    ];

    let progress = createProgress("customerAnalysis", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Get customer data with bill counts
    progress = updateProgressStep(progress, 0, "in-progress", 25);
    onProgress?.(progress);

    const customerData = (await db.getAllAsync(
      `SELECT 
        c.id,
        c.name,
        c.contact,
        COALESCE(c.creditBalance, 0) as creditBalance,
        COUNT(DISTINCT b.id) as totalBills,
        COALESCE(SUM(b.total), 0) as totalRevenue,
        MAX(b.createdAt) as lastBillAt
       FROM customers c
       LEFT JOIN bills b ON b.customerId = c.id
         AND b.createdAt >= ? AND b.createdAt < ?
       GROUP BY c.id, c.name, c.contact, c.creditBalance
       HAVING totalBills > 0 OR c.creditBalance > 0
       ORDER BY totalRevenue DESC`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Get payment breakdown for each customer
    progress = updateProgressStep(progress, 1, "in-progress", 50);
    onProgress?.(progress);

    const entries: CustomerAnalysisEntry[] = [];

    for (const cust of customerData) {
      cancellationToken?.throwIfCancelled();

      // Get cash paid
      const cashPaidResult = (await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments
         WHERE customerId = ? AND mode = 'Cash'
         AND createdAt >= ? AND createdAt < ?`,
        [cust.id, startUtc, endUtc]
      )) as any;

      // Get UPI paid
      const upiPaidResult = (await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments
         WHERE customerId = ? AND mode = 'UPI'
         AND createdAt >= ? AND createdAt < ?`,
        [cust.id, startUtc, endUtc]
      )) as any;

      // Get advance balance
      const advanceResult = (await db.getFirstAsync(
        `SELECT 
          COALESCE(SUM(CASE WHEN entryType='Add' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN entryType='Apply' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN entryType='Refund' THEN amount ELSE 0 END), 0) as balance
         FROM customer_advances
         WHERE customerId = ? AND deletedAt IS NULL`,
        [cust.id]
      )) as any;

      entries.push({
        customer: cust.name,
        contact: cust.contact || "",
        totalBills: cust.totalBills || 0,
        totalRevenue: cust.totalRevenue || 0,
        cashPaid: cashPaidResult?.total || 0,
        upiPaid: upiPaidResult?.total || 0,
        creditOutstanding: cust.creditBalance,
        advanceBalance: advanceResult?.balance || 0,
        lastTransactionDate: cust.lastBillAt ? formatDisplayDate(cust.lastBillAt) : "",
      });
    }

    // Step 3: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Receipt Register Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Receipt Register - sequential receipt listing
   */
  async getReceiptRegister(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<ReceiptRegisterEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching receipts...",
      "Processing data...",
      "Finalizing report...",
    ];

    let progress = createProgress("receiptRegister", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Fetch all receipts
    progress = updateProgressStep(progress, 0, "in-progress", 30);
    onProgress?.(progress);

    const receipts = (await db.getAllAsync(
      `SELECT 
        r.receiptNo,
        r.createdAt,
        c.name as customerName,
        b.billNumber,
        r.amount,
        r.mode,
        r.remarks
       FROM receipts r
       LEFT JOIN customers c ON r.customerId = c.id
       LEFT JOIN bills b ON r.billId = b.id
       WHERE r.createdAt >= ? AND r.createdAt < ?
       ORDER BY r.receiptNo ASC`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2: Build entries
    progress = updateProgressStep(progress, 1, "in-progress", 70);
    onProgress?.(progress);

    const entries: ReceiptRegisterEntry[] = receipts.map((r) => ({
      receiptNo: r.receiptNo,
      date: formatDisplayDate(r.createdAt),
      customer: r.customerName || "Unknown",
      billNo: r.billNumber || null,
      amount: r.amount,
      mode: r.mode,
      remarks: r.remarks || "",
    }));

    // Step 3: Finalize
    progress = updateProgressStep(progress, 2, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Bill Register Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Generates Bill Register - sequential bill listing
   */
  async getBillRegister(
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<BillRegisterEntry[]> {
    if (!db) throw new Error("Database not initialized");

    const steps = [
      "Fetching bills...",
      "Fetching KOT details...",
      "Determining payment status...",
      "Finalizing report...",
    ];

    let progress = createProgress("billRegister", steps);
    onProgress?.(progress);

    const { startUtc, endUtc } = getISTDateRange(
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    cancellationToken?.throwIfCancelled();

    // Step 1: Fetch all bills
    progress = updateProgressStep(progress, 0, "in-progress", 20);
    onProgress?.(progress);

    const bills = (await db.getAllAsync(
      `SELECT 
        b.id,
        b.billNumber,
        b.createdAt,
        c.name as customerName,
        b.total
       FROM bills b
       LEFT JOIN customers c ON b.customerId = c.id
       WHERE b.createdAt >= ? AND b.createdAt < ?
       ORDER BY b.billNumber ASC`,
      [startUtc, endUtc]
    )) as any[];

    cancellationToken?.throwIfCancelled();

    // Step 2 & 3: Get KOTs and payment status for each bill
    progress = updateProgressStep(progress, 1, "in-progress", 50);
    onProgress?.(progress);

    const entries: BillRegisterEntry[] = [];

    for (const bill of bills) {
      cancellationToken?.throwIfCancelled();

      // Get KOT numbers for this bill
      const kots = (await db.getAllAsync(
        `SELECT kotNumber FROM kot_orders WHERE billId = ? ORDER BY kotNumber`,
        [bill.id]
      )) as any[];
      const kotNumbers = kots.map((k) => `KOT-${k.kotNumber}`).join(", ");

      // Determine payment status from receipt
      const receipt = (await db.getFirstAsync(
        `SELECT mode FROM receipts WHERE billId = ?`,
        [bill.id]
      )) as any;

      let paymentStatus = "Unpaid";
      if (receipt) {
        if (receipt.mode === "Credit") {
          paymentStatus = "Credit";
        } else if (receipt.mode === "Split") {
          // Check if split includes credit
          const creditSplit = (await db.getFirstAsync(
            `SELECT id FROM split_payments 
             WHERE receiptId IN (SELECT id FROM receipts WHERE billId = ?)
             AND paymentType = 'Credit'`,
            [bill.id]
          )) as any;
          paymentStatus = creditSplit ? "Partial" : "Paid";
        } else {
          paymentStatus = "Paid";
        }
      }

      entries.push({
        billNo: bill.billNumber,
        date: formatDisplayDate(bill.createdAt),
        customer: bill.customerName || "Unknown",
        kotNumbers: kotNumbers || "-",
        totalAmount: bill.total,
        paymentStatus,
      });
    }

    // Step 4: Finalize
    progress = updateProgressStep(progress, 3, "done", 100);
    progress.rowsProcessed = entries.length;
    progress.totalRows = entries.length;
    onProgress?.(progress);

    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generate Report (unified entry point)
  // ─────────────────────────────────────────────────────────────────────────
  async generateReport(
    type: ReportType,
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<GeneratedReport> {
    const reportDef = REPORT_DEFINITIONS.find((r) => r.type === type);
    if (!reportDef) throw new Error(`Unknown report type: ${type}`);

    let data: any[] = [];
    let columns: ColumnConfig<any>[] = [];

    switch (type) {
      case "cashBook":
        data = await this.getCashBook(options, onProgress, cancellationToken);
        columns = CASH_BOOK_COLUMNS;
        break;

      case "upiBook":
        data = await this.getUPIBook(options, onProgress, cancellationToken);
        columns = UPI_BOOK_COLUMNS;
        break;

      case "salesRegister":
        data = await this.getSalesRegister(options, onProgress, cancellationToken);
        columns = SALES_REGISTER_COLUMNS;
        break;

      case "expenseRegister":
        data = await this.getExpenseRegister(options, onProgress, cancellationToken);
        columns = EXPENSE_REGISTER_COLUMNS;
        break;

      case "debtorsReport":
        data = await this.getDebtorsReport(options, onProgress, cancellationToken);
        columns = DEBTORS_REPORT_COLUMNS;
        break;

      case "creditorsReport":
        data = await this.getCreditorsReport(options, onProgress, cancellationToken);
        columns = CREDITORS_REPORT_COLUMNS;
        break;

      case "advanceLiability":
        data = await this.getAdvanceLiability(options, onProgress, cancellationToken);
        columns = ADVANCE_LIABILITY_COLUMNS;
        break;

      case "dailySummary":
        data = await this.getDailySummary(options, onProgress, cancellationToken);
        columns = DAILY_SUMMARY_COLUMNS;
        break;

      case "monthlySummary":
        data = await this.getMonthlySummary(options, onProgress, cancellationToken);
        columns = MONTHLY_SUMMARY_COLUMNS;
        break;

      case "itemwiseSales":
        data = await this.getItemwiseSales(options, onProgress, cancellationToken);
        columns = ITEMWISE_SALES_COLUMNS;
        break;

      case "customerAnalysis":
        data = await this.getCustomerAnalysis(options, onProgress, cancellationToken);
        columns = CUSTOMER_ANALYSIS_COLUMNS;
        break;

      case "receiptRegister":
        data = await this.getReceiptRegister(options, onProgress, cancellationToken);
        columns = RECEIPT_REGISTER_COLUMNS;
        break;

      case "billRegister":
        data = await this.getBillRegister(options, onProgress, cancellationToken);
        columns = BILL_REGISTER_COLUMNS;
        break;

      default:
        throw new Error(`Report type ${type} not yet implemented`);
    }

    const csvContent = csvExporter.toCSV(data, columns);
    const filename = csvExporter.generateReportFilename(
      reportDef.name,
      options.dateRange.startDate,
      options.dateRange.endDate
    );

    return {
      type,
      name: reportDef.name,
      filename,
      content: csvContent,
      rowCount: data.length,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export and Share Report
  // ─────────────────────────────────────────────────────────────────────────
  async exportReport(
    type: ReportType,
    options: ReportOptions,
    onProgress?: (progress: ReportProgress) => void,
    cancellationToken?: CancellationToken
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const report = await this.generateReport(
        type,
        options,
        onProgress,
        cancellationToken
      );

      const filePath = await csvExporter.saveCSVToFile(
        report.content,
        report.filename
      );

      await csvExporter.shareFile(filePath, {
        dialogTitle: `Export ${report.name}`,
      });

      return { success: true, filePath };
    } catch (error) {
      if (error instanceof Error && error.message === "CANCELLED") {
        return { success: false, error: "Operation cancelled" };
      }
      console.error(`[ReportService] Export failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();
