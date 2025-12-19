// types/reports.ts
// Type definitions for the Reports feature

// ============================================================================
// Report Types & Identifiers
// ============================================================================

export type ReportType =
  | "cashBook"
  | "upiBook"
  | "salesRegister"
  | "expenseRegister"
  | "debtorsReport"
  | "creditorsReport"
  | "advanceLiability"
  | "dailySummary"
  | "monthlySummary"
  | "itemwiseSales"
  | "customerAnalysis"
  | "receiptRegister"
  | "billRegister";

export interface ReportMeta {
  type: ReportType;
  name: string;
  description: string;
  icon: string; // Icon name for lucide-react-native
  category: "financial" | "receivables" | "summary" | "analytics" | "audit";
}

export const REPORT_DEFINITIONS: ReportMeta[] = [
  // Financial Ledgers
  {
    type: "cashBook",
    name: "Cash Book",
    description: "Daily cash in/out with running balance",
    icon: "Banknote",
    category: "financial",
  },
  {
    type: "upiBook",
    name: "UPI/Bank Book",
    description: "Digital payments with running balance",
    icon: "Smartphone",
    category: "financial",
  },
  {
    type: "salesRegister",
    name: "Sales Register",
    description: "All bills with payment breakdown",
    icon: "Receipt",
    category: "financial",
  },
  {
    type: "expenseRegister",
    name: "Expense Register",
    description: "All expenses with voucher details",
    icon: "FileText",
    category: "financial",
  },
  // Receivables & Payables
  {
    type: "debtorsReport",
    name: "Debtors Report",
    description: "Customer credit outstanding + ageing",
    icon: "Users",
    category: "receivables",
  },
  {
    type: "creditorsReport",
    name: "Creditors Report",
    description: "Expense credit outstanding",
    icon: "Store",
    category: "receivables",
  },
  {
    type: "advanceLiability",
    name: "Advance Liability",
    description: "Customer prepaid balances",
    icon: "Wallet",
    category: "receivables",
  },
  // Summary Reports
  {
    type: "dailySummary",
    name: "Daily Summary",
    description: "Day-wise totals for reconciliation",
    icon: "Calendar",
    category: "summary",
  },
  {
    type: "monthlySummary",
    name: "Monthly Summary",
    description: "Month-wise totals for ITR/GST",
    icon: "CalendarDays",
    category: "summary",
  },
  // Analytics
  {
    type: "itemwiseSales",
    name: "Item-wise Sales",
    description: "Product performance analysis",
    icon: "Coffee",
    category: "analytics",
  },
  {
    type: "customerAnalysis",
    name: "Customer Analysis",
    description: "Customer-wise revenue & credit",
    icon: "UserCheck",
    category: "analytics",
  },
  // Audit Trail
  {
    type: "receiptRegister",
    name: "Receipt Register",
    description: "Sequential receipt listing",
    icon: "FileCheck",
    category: "audit",
  },
  {
    type: "billRegister",
    name: "Bill Register",
    description: "Sequential bill listing",
    icon: "FileStack",
    category: "audit",
  },
];

// ============================================================================
// Date Range Options
// ============================================================================

export interface ReportDateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
}

export type QuickDateRange =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisFY" // Indian Financial Year (Apr-Mar)
  | "lastFY"
  | "custom";

export interface ReportOptions {
  dateRange: ReportDateRange;
  customerId?: string; // For customer-specific reports
}

// ============================================================================
// Progress Tracking
// ============================================================================

export type StepStatus = "pending" | "in-progress" | "done" | "error";

export interface ReportStep {
  id: string;
  label: string;
  status: StepStatus;
}

export interface ReportProgress {
  reportType: ReportType;
  reportName: string;
  overallPercent: number; // 0-100
  currentStep: string; // "Fetching transactions..."
  steps: ReportStep[];
  rowsProcessed: number;
  totalRows: number;
  estimatedSecondsRemaining: number;
}

export interface DownloadAllProgress {
  totalReports: number; // 13
  completedReports: number; // 0-13
  currentReport: ReportProgress | null;
  completedList: {
    type: ReportType;
    name: string;
    status: "done" | "error";
    error?: string;
  }[];
  pendingList: { type: ReportType; name: string }[];
  estimatedSecondsRemaining: number;
  isCancelled: boolean;
  isComplete: boolean;
}

// ============================================================================
// Cancellation Token
// ============================================================================

export class CancellationToken {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new CancellationError("Operation cancelled by user");
    }
  }
}

export class CancellationError extends Error {
  constructor(message: string = "Operation cancelled") {
    super(message);
    this.name = "CancellationError";
  }
}

// ============================================================================
// Report Data Structures (CSV Row Types)
// ============================================================================

// 1. Cash Book Entry
export interface CashBookEntry {
  date: string;
  particulars: string;
  referenceNo: string; // Receipt No / Voucher No
  debit: number; // Cash In
  credit: number; // Cash Out
  balance: number; // Running balance
}

// 2. UPI/Bank Book Entry
export interface UPIBookEntry {
  date: string;
  particulars: string;
  referenceNo: string;
  debit: number; // UPI In
  credit: number; // UPI Out
  balance: number;
}

// 3. Sales Register Entry
export interface SalesRegisterEntry {
  date: string;
  billNo: number;
  customer: string;
  grossAmount: number;
  cashAmount: number;
  upiAmount: number;
  creditAmount: number;
  advanceUsed: number;
  paymentMode: string; // Cash / UPI / Credit / Split
}

// 4. Expense Register Entry
export interface ExpenseRegisterEntry {
  date: string;
  voucherNo: number;
  particulars: string; // towards
  amount: number;
  cashPaid: number;
  upiPaid: number;
  creditAmount: number;
  mode: string;
  remarks: string;
}

// 5. Debtors Report Entry
export interface DebtorsReportEntry {
  customer: string;
  contact: string;
  openingBalance: number;
  creditGiven: number;
  paymentsReceived: number;
  closingBalance: number;
  ageing0to7: number;
  ageing8to30: number;
  ageing31to60: number;
  ageing60plus: number;
}

// 6. Creditors Report Entry (Expense Credit)
export interface CreditorsReportEntry {
  towards: string; // Supplier/Particulars
  openingBalance: number;
  creditTaken: number;
  paid: number;
  closingBalance: number;
  oldestUnpaidDays: number;
}

// 7. Advance Liability Entry
export interface AdvanceLiabilityEntry {
  customer: string;
  contact: string;
  openingBalance: number;
  added: number;
  applied: number;
  refunded: number;
  closingBalance: number;
}

// 8. Daily Summary Entry
export interface DailySummaryEntry {
  date: string;
  billCount: number;
  revenue: number;
  cashIn: number;
  upiIn: number;
  creditGiven: number;
  creditCleared: number;
  expenses: number;
  expensesCash: number;
  expensesUpi: number;
  expensesCredit: number;
  netCash: number; // Cash In - Cash Expenses
  netUpi: number;
}

// 9. Monthly Summary Entry
export interface MonthlySummaryEntry {
  month: string; // "Dec 2025"
  billCount: number;
  revenue: number;
  cashReceived: number;
  upiReceived: number;
  creditAccrued: number;
  creditCleared: number;
  totalExpenses: number;
  profit: number; // Revenue - Expenses
}

// 10. Item-wise Sales Entry
export interface ItemwiseSalesEntry {
  itemName: string;
  category: string;
  quantitySold: number;
  revenue: number;
  avgPrice: number;
  percentOfTotal: number;
}

// 11. Customer Analysis Entry
export interface CustomerAnalysisEntry {
  customer: string;
  contact: string;
  totalBills: number;
  totalRevenue: number;
  cashPaid: number;
  upiPaid: number;
  creditOutstanding: number;
  advanceBalance: number;
  lastTransactionDate: string;
}

// 12. Receipt Register Entry
export interface ReceiptRegisterEntry {
  receiptNo: number;
  date: string;
  customer: string;
  billNo: number | null;
  amount: number;
  mode: string;
  remarks: string;
}

// 13. Bill Register Entry
export interface BillRegisterEntry {
  billNo: number;
  date: string;
  customer: string;
  kotNumbers: string; // comma-separated
  totalAmount: number;
  paymentStatus: string; // Paid / Partial / Credit
}

// ============================================================================
// Generated Report Result
// ============================================================================

export interface GeneratedReport {
  type: ReportType;
  name: string;
  filename: string;
  content: string; // CSV content
  rowCount: number;
  generatedAt: string; // ISO timestamp
}

// ============================================================================
// Column Configuration for CSV Export
// ============================================================================

export interface ColumnConfig<T = any> {
  key: keyof T;
  header: string;
  format?: (value: any, row: T) => string;
}
