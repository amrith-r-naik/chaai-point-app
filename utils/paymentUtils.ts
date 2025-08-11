import { PaymentMode, SettlementType } from "@/constants/paymentConstants";
import { db } from "@/lib/db";
import { SplitPayment } from "@/types/payment";

export const paymentTypes: ("Cash" | "UPI" | "Credit")[] = ["Cash", "UPI", "Credit"];

/**
 * Enhanced payment utilities for the new payment flow
 */

export interface BillStatus {
  settlementType: SettlementType;
  paidPortion: number;
  creditPortion: number;
}

/**
 * Derive settlement status for a bill based on its payments
 */
export async function deriveBillStatus(billId: string): Promise<BillStatus> {
  if (!db) throw new Error("Database not initialized");

  const bill = await db.getFirstAsync(`
    SELECT total FROM bills WHERE id = ?
  `, [billId]) as { total: number } | null;

  if (!bill) {
    throw new Error("Bill not found");
  }

  // Get all non-credit payments for this bill
  const paidPayments = await db.getFirstAsync(`
    SELECT COALESCE(SUM(amount), 0) as totalPaid 
    FROM payments 
    WHERE billId = ? AND mode NOT IN (?, ?)
  `, [billId, PaymentMode.CREDIT, PaymentMode.CREDIT_CLEAR]) as { totalPaid: number };

  // Get credit payments for this bill
  const creditPayments = await db.getFirstAsync(`
    SELECT COALESCE(SUM(amount), 0) as totalCredit 
    FROM payments 
    WHERE billId = ? AND mode = ?
  `, [billId, PaymentMode.CREDIT]) as { totalCredit: number };

  const paidPortion = paidPayments?.totalPaid || 0;
  const creditPortion = creditPayments?.totalCredit || 0;
  const totalAmount = bill.total;

  let settlementType: SettlementType;

  if (paidPortion === totalAmount && creditPortion === 0) {
    settlementType = SettlementType.FULLY_PAID;
  } else if (paidPortion === 0 && creditPortion === totalAmount) {
    settlementType = SettlementType.FULLY_CREDIT;
  } else {
    settlementType = SettlementType.PARTIALLY_PAID;
  }

  return {
    settlementType,
    paidPortion,
    creditPortion,
  };
}

/**
 * Format currency consistently
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Validate amount is within acceptable range
 */
export function validateAmount(amount: number, min: number = 0.01, max: number = 999999.99): boolean {
  return amount >= min && amount <= max && Number.isFinite(amount);
}

export class SplitPaymentManager {
  static validateSplitAmount(amount: string, maxAmount: number): boolean {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount > 0 && numAmount <= maxAmount;
  }

  static getCreditAmount(splitPayments: SplitPayment[]): number {
    const creditSplit = splitPayments.find(p => p.type === "Credit");
    return creditSplit ? creditSplit.amount : 0;
  }

  static getTotalSplitAmount(splitPayments: SplitPayment[]): number {
    return splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  static initializeSplitPayments(totalAmount: number): SplitPayment[] {
    return [{
      id: "credit-initial",
      type: "Credit",
      amount: totalAmount,
    }];
  }

  static addSplitPayment(
    splitPayments: SplitPayment[],
    type: "Cash" | "UPI" | "Credit",
    amount: number
  ): SplitPayment[] {
    // Prevent adding duplicate Credit splits
    if (type === "Credit") {
      // Find existing credit split and update it
      const existingCreditIndex = splitPayments.findIndex(p => p.type === "Credit");
      if (existingCreditIndex !== -1) {
        const updatedSplitPayments = [...splitPayments];
        updatedSplitPayments[existingCreditIndex] = {
          ...updatedSplitPayments[existingCreditIndex],
          amount: updatedSplitPayments[existingCreditIndex].amount + amount
        };
        return updatedSplitPayments;
      }
    }

    const newSplit: SplitPayment = {
      id: Date.now().toString(),
      type,
      amount,
    };

    // Update credit split by reducing its amount
    const updatedSplitPayments = splitPayments.map(payment => 
      payment.type === "Credit" 
        ? { ...payment, amount: payment.amount - amount }
        : payment
    );

    // Add the new split
    updatedSplitPayments.push(newSplit);

    // Remove credit split if amount becomes 0
    return updatedSplitPayments.filter(payment => 
      payment.type !== "Credit" || payment.amount > 0
    );
  }

  static removeSplitPayment(splitPayments: SplitPayment[], id: string): SplitPayment[] {
    const splitToRemove = splitPayments.find(p => p.id === id);
    if (!splitToRemove || splitToRemove.type === "Credit") {
      return splitPayments;
    }

    // Remove the split
    const updatedSplitPayments = splitPayments.filter(payment => payment.id !== id);
    
    // Find existing credit split to restore the amount, avoiding duplicates
    const existingCreditIndex = updatedSplitPayments.findIndex(p => p.type === "Credit");
    if (existingCreditIndex !== -1) {
      updatedSplitPayments[existingCreditIndex] = {
        ...updatedSplitPayments[existingCreditIndex],
        amount: updatedSplitPayments[existingCreditIndex].amount + splitToRemove.amount
      };
    } else {
      // Only create new credit split if none exists
      updatedSplitPayments.push({
        id: "credit-restored",
        type: "Credit",
        amount: splitToRemove.amount,
      });
    }

    return updatedSplitPayments;
  }

  static validateSplitTotal(splitPayments: SplitPayment[], totalAmount: number): boolean {
    const splitTotal = this.getTotalSplitAmount(splitPayments);
    return Math.abs(splitTotal - totalAmount) < 0.01;
  }
}
