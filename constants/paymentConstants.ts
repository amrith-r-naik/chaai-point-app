// Payment Flow Feature Flag and Constants
export const ENABLE_NEW_PAYMENT_FLOW = true;

// Payment Mode Enumerations
export enum PaymentMode {
  CASH = 'Cash',
  UPI = 'UPI',
  CREDIT = 'Credit',
  CREDIT_CLEAR = 'CreditClear', // For credit clearance operations
  SPLIT = 'Split'
}

// Settlement Types for UI Display
export enum SettlementType {
  FULLY_PAID = 'Fully Paid',
  PARTIALLY_PAID = 'Partially Paid',
  FULLY_CREDIT = 'Fully Credit'
}

// Payment Status Types
export enum PaymentStatus {
  PAID = 'paid',
  CREDIT = 'credit', 
  PARTIAL = 'partial',
  PENDING = 'pending'
}

// EOD Constants
export const EOD_CREDIT_REMARK_PREFIX = 'EOD Credit';

// Validation Constants
export const MIN_PAYMENT_AMOUNT = 0.01;
export const MAX_PAYMENT_AMOUNT = 999999.99;

// Toast Messages
export const TOAST_MESSAGES = {
  PURE_CREDIT: (amount: number) => `Added to credit: ₹${amount.toFixed(2)}`,
  SPLIT_WITH_CREDIT: (paidAmount: number, creditAmount: number) => 
    `Paid ₹${paidAmount.toFixed(2)} • Credit ₹${creditAmount.toFixed(2)} added`,
  CREDIT_CLEARANCE_FULL: (amount: number) => `Credit cleared: ₹${amount.toFixed(2)}`,
  CREDIT_CLEARANCE_PARTIAL: (amount: number, remaining: number) => 
    `Credit cleared: ₹${amount.toFixed(2)} (Remaining ₹${remaining.toFixed(2)})`,
  PAYMENT_SUCCESSFUL: 'Payment successful'
};
