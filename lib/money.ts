// lib/money.ts
// Money utility functions for handling currency operations
// All monetary values are stored as INTEGER rupees (no paisa, no floats in DB)

/**
 * Format amount in rupees to currency string
 * @param amountInRupees - Amount in whole rupees (integer)
 * @returns Formatted currency string (e.g., "₹150", "₹1,250")
 */
export function formatCurrency(amountInRupees: number): string {
  if (typeof amountInRupees !== 'number' || !isFinite(amountInRupees)) {
    return '₹0';
  }
  
  // Round to remove any floating point precision issues
  const amount = Math.round(amountInRupees);
  
  // Format with Indian number system (lakhs, crores)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format amount for display with custom formatting
 * @param amountInRupees - Amount in whole rupees (integer) 
 * @param options - Formatting options
 */
export function formatMoney(
  amountInRupees: number, 
  options: {
    showSymbol?: boolean;
    showDecimals?: boolean;
    compact?: boolean;
  } = {}
): string {
  const { showSymbol = true, showDecimals = false, compact = false } = options;
  
  if (typeof amountInRupees !== 'number' || !isFinite(amountInRupees)) {
    return showSymbol ? '₹0' : '0';
  }
  
  const amount = Math.round(amountInRupees);
  
  if (compact) {
    // Compact notation for large amounts
    if (amount >= 10000000) { // 1 crore
      return `${showSymbol ? '₹' : ''}${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) { // 1 lakh
      return `${showSymbol ? '₹' : ''}${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) { // 1 thousand
      return `${showSymbol ? '₹' : ''}${(amount / 1000).toFixed(1)}K`;
    }
  }
  
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  
  const formatted = formatter.format(amount);
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Safe addition of money amounts
 * @param amounts - Array of amounts in rupees
 * @returns Sum of all amounts (integer rupees)
 */
export function addMoney(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => {
    if (typeof amount !== 'number' || !isFinite(amount)) {
      return sum;
    }
    return sum + Math.round(amount);
  }, 0);
}

/**
 * Safe subtraction of money amounts
 * @param minuend - Amount to subtract from
 * @param subtrahend - Amount to subtract
 * @returns Difference (integer rupees)
 */
export function subtractMoney(minuend: number, subtrahend: number): number {
  const a = typeof minuend === 'number' && isFinite(minuend) ? Math.round(minuend) : 0;
  const b = typeof subtrahend === 'number' && isFinite(subtrahend) ? Math.round(subtrahend) : 0;
  return a - b;
}

/**
 * Compare money amounts
 * @param a - First amount
 * @param b - Second amount
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareMoney(a: number, b: number): -1 | 0 | 1 {
  const amountA = typeof a === 'number' && isFinite(a) ? Math.round(a) : 0;
  const amountB = typeof b === 'number' && isFinite(b) ? Math.round(b) : 0;
  
  if (amountA < amountB) return -1;
  if (amountA > amountB) return 1;
  return 0;
}

/**
 * Check if amount is valid (positive integer)
 * @param amount - Amount to validate
 * @returns True if valid money amount
 */
export function isValidMoneyAmount(amount: number): boolean {
  return typeof amount === 'number' && isFinite(amount) && amount >= 0;
}

/**
 * Parse user input to money amount
 * @param input - User input string or number
 * @returns Parsed amount in rupees (integer) or null if invalid
 */
export function parseMoneyInput(input: string | number): number | null {
  if (typeof input === 'number') {
    return isValidMoneyAmount(input) ? Math.round(input) : null;
  }
  
  if (typeof input === 'string') {
    // Remove currency symbols and commas
    const cleaned = input.replace(/[₹,\s]/g, '');
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed) || !isValidMoneyAmount(parsed)) {
      return null;
    }
    
    return Math.round(parsed);
  }
  
  return null;
}

/**
 * Calculate percentage of amount
 * @param amount - Base amount in rupees
 * @param percentage - Percentage (e.g., 5 for 5%)
 * @returns Calculated amount in rupees (integer)
 */
export function calculatePercentage(amount: number, percentage: number): number {
  if (!isValidMoneyAmount(amount) || typeof percentage !== 'number' || !isFinite(percentage)) {
    return 0;
  }
  
  return Math.round((amount * percentage) / 100);
}

/**
 * Split amount into multiple parts
 * @param totalAmount - Total amount to split
 * @param parts - Number of parts to split into
 * @returns Array of amounts (may have rounding differences in last part)
 */
export function splitMoney(totalAmount: number, parts: number): number[] {
  if (!isValidMoneyAmount(totalAmount) || parts <= 0) {
    return [];
  }
  
  const amount = Math.round(totalAmount);
  const partSize = Math.floor(amount / parts);
  const remainder = amount % parts;
  
  const result = new Array(parts).fill(partSize);
  
  // Distribute remainder to first few parts
  for (let i = 0; i < remainder; i++) {
    result[i] += 1;
  }
  
  return result;
}

/**
 * Money validation and business rules
 */
export const MoneyRules = {
  /**
   * Minimum order amount (in rupees)
   */
  MIN_ORDER_AMOUNT: 1,
  
  /**
   * Maximum single transaction amount (in rupees)
   */
  MAX_TRANSACTION_AMOUNT: 1000000, // 10 Lakh
  
  /**
   * Validate order amount
   */
  isValidOrderAmount(amount: number): boolean {
    return isValidMoneyAmount(amount) && 
           amount >= this.MIN_ORDER_AMOUNT && 
           amount <= this.MAX_TRANSACTION_AMOUNT;
  },
  
  /**
   * Validate payment amount
   */
  isValidPaymentAmount(amount: number): boolean {
    return isValidMoneyAmount(amount) && amount > 0;
  }
};

// Legacy compatibility - remove these when all code is updated
/** @deprecated Use formatCurrency instead */
export const formatRupees = formatCurrency;

/** @deprecated Use addMoney instead */
export const safeCurrencyAdd = addMoney;

/** @deprecated Use subtractMoney instead */
export const safeCurrencySubtract = subtractMoney;
