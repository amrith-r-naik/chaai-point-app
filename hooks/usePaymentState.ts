import { PaymentType, SplitModalScreen, SplitPayment } from "@/types/payment";
import { SplitPaymentManager } from "@/utils/paymentUtils";
import { useState } from "react";

interface UsePaymentStateProps {
  totalAmount: number;
  isClearance?: boolean; // when true, reuse UI for credit clearance (no bill)
  advanceBalance?: number; // available advance for AdvanceUse cap
}

export const usePaymentState = ({ totalAmount, isClearance = false, advanceBalance = 0 }: UsePaymentStateProps) => {
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType | null>(null);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [newSplitType, setNewSplitType] = useState<"Cash" | "UPI" | "Credit" | "AdvanceUse" | "AdvanceAdd">("Cash");
  const [newSplitAmount, setNewSplitAmount] = useState<string>("");
  const [splitModalScreen, setSplitModalScreen] = useState<SplitModalScreen>("list");

  const creditAmount = SplitPaymentManager.getCreditAmount(splitPayments);
  const remainingAdvanceCap = advanceBalance - (splitPayments.find(p => p.type === 'AdvanceUse')?.amount || 0);
  const advanceUseCap = Math.min(creditAmount, Math.max(0, remainingAdvanceCap));

  const handlePaymentTypeSelect = (type: PaymentType) => {
    if (type === "Split") {
      setSelectedPaymentType(type);
      setSplitPayments(SplitPaymentManager.initializeSplitPayments(totalAmount));
      setSplitModalScreen("list");
      setShowSplitPayment(true);
    } else {
      setSelectedPaymentType(type);
    }
  };

  const handleAddNewSplit = () => {
    setNewSplitType("Cash");
    setNewSplitAmount("");
    setSplitModalScreen("add");
  };

  const handleConfirmAddSplit = () => {
    const amount = parseFloat(newSplitAmount);
    // For AdvanceAdd, allow any positive
    if (newSplitType !== 'AdvanceAdd') {
      const max = newSplitType === 'AdvanceUse' ? Math.min(creditAmount, Math.max(0, remainingAdvanceCap)) : creditAmount;
      if (!SplitPaymentManager.validateSplitAmount(newSplitAmount, max)) {
        return;
      }
    } else if (isNaN(amount) || amount <= 0) {
      return;
    }

    const updatedSplitPayments = SplitPaymentManager.addSplitPayment(
      splitPayments,
      newSplitType,
      amount
    );

    setSplitPayments(updatedSplitPayments);
    setSplitModalScreen("list");
    setNewSplitAmount("");
  };

  const handleRemoveSplit = (id: string) => {
    const updatedSplitPayments = SplitPaymentManager.removeSplitPayment(splitPayments, id);
    setSplitPayments(updatedSplitPayments);
  };

  const validatePayment = (): boolean => {
    if (!selectedPaymentType) return false;

    if (selectedPaymentType === "Split") {
      // For clearance, allow partial paid via split but require at least one non-credit part
      if (isClearance) {
        const totalMatches = SplitPaymentManager.validateSplitTotal(splitPayments, totalAmount);
        if (!totalMatches) return false;
        const hasPaid = splitPayments.some(p => (p.type === "Cash" || p.type === "UPI" || p.type === 'AdvanceUse') && p.amount > 0);
        return hasPaid;
      }
      return SplitPaymentManager.validateSplitTotal(splitPayments, totalAmount);
    }

    return true;
  };

  return {
    // State
    selectedPaymentType,
    showSplitPayment,
    splitPayments,
    newSplitType,
    newSplitAmount,
    splitModalScreen,
    creditAmount,
  advanceUseCap,
  advanceBalance,
  isClearance,

    // Actions
    setSelectedPaymentType,
    setShowSplitPayment,
    setSplitModalScreen,
    setNewSplitType,
    setNewSplitAmount,
    handlePaymentTypeSelect,
    handleAddNewSplit,
    handleConfirmAddSplit,
    handleRemoveSplit,
    validatePayment,
  };
};
