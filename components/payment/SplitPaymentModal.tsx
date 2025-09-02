import { theme } from "@/constants/theme";
import { SplitModalScreen, SplitPayment } from "@/types/payment";
import { X } from "lucide-react-native";
import React from "react";
import { Modal, TouchableOpacity, View } from "react-native";
import { AddSplitForm } from "./AddSplitForm";
import { SplitPaymentList } from "./SplitPaymentList";

interface SplitPaymentModalProps {
  visible: boolean;
  screen: SplitModalScreen;
  splitPayments: SplitPayment[];
  creditAmount: number;
  advanceUseCap?: number;
  advanceBalance?: number;
  newSplitType: "Cash" | "UPI" | "Credit" | "AdvanceUse" | "AdvanceAdd";
  newSplitAmount: string;
  canProceed: boolean;
  onScreenChange: (screen: SplitModalScreen) => void;
  onSplitTypeChange: (type: "Cash" | "UPI" | "Credit" | "AdvanceUse" | "AdvanceAdd") => void;
  onAmountChange: (amount: string) => void;
  onAddSplit: () => void;
  onConfirmSplit: () => void;
  onRemoveSplit: (id: string) => void;
  onProceed: () => void;
  onClose: () => void;
}

export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  visible,
  screen,
  splitPayments,
  creditAmount,
  advanceUseCap,
  advanceBalance,
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
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 400,
            maxHeight: "80%",
          }}
        >
          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close"
            style={{ position: "absolute", top: 8, right: 8, padding: 8 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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
              advanceUseCap={advanceUseCap}
              advanceBalance={advanceBalance}
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
