import { SplitModalScreen, SplitPayment } from "@/types/payment";
import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { AddSplitForm } from "./AddSplitForm";
import { SplitPaymentList } from "./SplitPaymentList";

interface SplitPaymentModalProps {
  visible: boolean;
  screen: SplitModalScreen;
  splitPayments: SplitPayment[];
  creditAmount: number;
  newSplitType: "Cash" | "UPI" | "Credit";
  newSplitAmount: string;
  onScreenChange: (screen: SplitModalScreen) => void;
  onSplitTypeChange: (type: "Cash" | "UPI" | "Credit") => void;
  onAmountChange: (amount: string) => void;
  onAddSplit: () => void;
  onConfirmSplit: () => void;
  onRemoveSplit: (id: string) => void;
  onProceed: () => void;
  onClose?: () => void;
}

export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  visible,
  screen,
  splitPayments,
  creditAmount,
  newSplitType,
  newSplitAmount,
  onScreenChange,
  onSplitTypeChange,
  onAmountChange,
  onAddSplit,
  onConfirmSplit,
  onRemoveSplit,
  onProceed,
  onClose,
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
          {onClose && (
            <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 8, right: 8, padding: 8 }}>
              <Text style={{ fontSize: 18, color: '#6b7280' }}>×</Text>
            </TouchableOpacity>
          )}
          {screen === "list" ? (
            <SplitPaymentList
              splitPayments={splitPayments}
              creditAmount={creditAmount}
              onAddSplit={onAddSplit}
              onRemoveSplit={onRemoveSplit}
              onProceed={onProceed}
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
