import { PaymentType, SplitModalScreen, SplitPayment } from "@/types/payment";
import { SplitPaymentManager } from "@/utils/paymentUtils";
import { useState } from "react";

interface UsePaymentStateProps {
  totalAmount: number;
}

export const usePaymentState = ({ totalAmount }: UsePaymentStateProps) => {
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType | null>(null);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [newSplitType, setNewSplitType] = useState<"Cash" | "UPI" | "Credit">("Cash");
  const [newSplitAmount, setNewSplitAmount] = useState<string>("");
  const [splitModalScreen, setSplitModalScreen] = useState<SplitModalScreen>("list");

  const creditAmount = SplitPaymentManager.getCreditAmount(splitPayments);

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
    if (!SplitPaymentManager.validateSplitAmount(newSplitAmount, creditAmount)) {
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
