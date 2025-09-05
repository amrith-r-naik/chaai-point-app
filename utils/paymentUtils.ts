import { SplitEntryType, SplitPayment } from "@/types/payment";

export const paymentTypes: ("Cash" | "UPI" | "Credit" | "AdvanceUse" | "AdvanceAddCash" | "AdvanceAddUPI")[] = [
  "Cash",
  "UPI",
  "Credit",
  "AdvanceUse",
  "AdvanceAddCash",
  "AdvanceAddUPI",
];

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
    type: "Cash" | "UPI" | "Credit" | "AdvanceUse" | "AdvanceAddCash" | "AdvanceAddUPI",
    amount: number
  ): SplitPayment[] {
    // AdvanceAddCash/AdvanceAddUPI are not counted against bill credit; they stand alone and don't reduce Credit
    if (type === "AdvanceAddCash" || type === "AdvanceAddUPI") {
      const updated: SplitPayment[] = [...splitPayments];
      // Merge with existing of same advance-add type if present
      const existingIndex = updated.findIndex(p => p.type === type);
      if (existingIndex !== -1) {
        updated[existingIndex] = { ...updated[existingIndex], amount: updated[existingIndex].amount + amount };
      } else {
        updated.push({ id: Date.now().toString(), type: type as SplitEntryType, amount });
      }
      return updated;
    }

    // Treat AdvanceUse similar to a paid part that reduces Credit remainder
    if (type === "AdvanceUse") {
      // Merge if exists
      const updatedSplitPayments = [...splitPayments];
      const existingIndex = updatedSplitPayments.findIndex(p => p.type === "AdvanceUse");
      if (existingIndex !== -1) {
        updatedSplitPayments[existingIndex] = {
          ...updatedSplitPayments[existingIndex],
          amount: updatedSplitPayments[existingIndex].amount + amount,
        };
      } else {
        updatedSplitPayments.push({ id: Date.now().toString(), type: "AdvanceUse", amount });
      }
      // Reduce credit remainder by amount
      const reduced = updatedSplitPayments.map(p => p.type === 'Credit' ? { ...p, amount: p.amount - amount } : p);
      return reduced.filter(p => p.type !== 'Credit' || p.amount > 0);
    }

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

    // Find existing non-credit split of same type
    const existingIndex = splitPayments.findIndex(p => p.type === type && type !== 'Credit');
    let updatedSplitPayments = [...splitPayments];

    if (existingIndex !== -1) {
      // Merge amounts
      updatedSplitPayments[existingIndex] = {
        ...updatedSplitPayments[existingIndex],
        amount: updatedSplitPayments[existingIndex].amount + amount
      };
    } else {
      const newSplit: SplitPayment = {
        id: Date.now().toString(),
        type: type as SplitEntryType,
        amount,
      };
      updatedSplitPayments.push(newSplit);
    }

    // Reduce credit remainder for paid parts that contribute to bill (Cash/UPI)
    updatedSplitPayments = updatedSplitPayments.map(p => p.type === 'Credit' ? { ...p, amount: p.amount - amount } : p);
    // Remove zero credit rows
    return updatedSplitPayments.filter(p => p.type !== 'Credit' || p.amount > 0);
  }

  static removeSplitPayment(splitPayments: SplitPayment[], id: string): SplitPayment[] {
    const splitToRemove = splitPayments.find(p => p.id === id);
    if (!splitToRemove || splitToRemove.type === "Credit") {
      return splitPayments;
    }

    // Remove the split
    const updatedSplitPayments = splitPayments.filter(payment => payment.id !== id);

    // If removing AdvanceAddCash/UPI, nothing to restore in credit
    if (splitToRemove.type === 'AdvanceAddCash' || splitToRemove.type === 'AdvanceAddUPI') {
      return updatedSplitPayments;
    }
    
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
    // Only count Cash/UPI/AdvanceUse towards bill total; ignore AdvanceAdd
    const splitTotal = splitPayments
  .filter(p => p.type === 'Cash' || p.type === 'UPI' || p.type === 'AdvanceUse' || p.type === 'Credit')
      .reduce((sum, payment) => sum + payment.amount, 0);
    return Math.abs(splitTotal - totalAmount) < 0.01;
  }
}
