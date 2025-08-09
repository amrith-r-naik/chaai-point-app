import { SplitPayment } from "@/types/payment";

export const paymentTypes: ("Cash" | "UPI" | "Credit")[] = ["Cash", "UPI", "Credit"];

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
