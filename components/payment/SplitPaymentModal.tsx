import { SplitModalScreen, SplitPayment } from "@/types/payment";
import React from "react";
import { Modal, View } from "react-native";
import { AddSplitForm } from "./AddSplitForm";
import { SplitPaymentList } from "./SplitPaymentList";

interface SplitPaymentModalProps {
  visible: boolean;
  screen: SplitModalScreen;
  splitPayments: SplitPayment[];
  creditAmount: number;
  newSplitType: "Cash" | "UPI" | "Credit";
  newSplitAmount: string;
  canProceed: boolean;
  onScreenChange: (screen: SplitModalScreen) => void;
  onSplitTypeChange: (type: "Cash" | "UPI" | "Credit") => void;
  onAmountChange: (amount: string) => void;
  onAddSplit: () => void;
  onConfirmSplit: () => void;
  onRemoveSplit: (id: string) => void;
  onProceed: () => void;
}

export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  visible,
  screen,
  splitPayments,
  creditAmount,
  newSplitType,
  newSplitAmount,
  canProceed,
  onScreenChange,
  onSplitTypeChange,
  onAmountChange,
  onAddSplit,
  onConfirmSplit,
  onRemoveSplit,
  onProceed,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
      }}>
        <View style={{
          backgroundColor: "white",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 400,
          maxHeight: "80%",
        }}>
          {screen === "list" ? (
            <SplitPaymentList
              splitPayments={splitPayments}
              creditAmount={creditAmount}
              onAddSplit={onAddSplit}
              onRemoveSplit={onRemoveSplit}
              onProceed={onProceed}
              canProceed={canProceed}
            />
          ) : (
            <AddSplitForm
              newSplitType={newSplitType}
              newSplitAmount={newSplitAmount}
              creditAmount={creditAmount}
              onSplitTypeChange={onSplitTypeChange}
              onAmountChange={onAmountChange}
              onConfirm={onConfirmSplit}
              onCancel={() => {
                onScreenChange("list");
                onAmountChange("");
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};
