import { PaymentTypeModal } from "@/components/payment/PaymentTypeModal";
import { SplitPaymentModal } from "@/components/payment/SplitPaymentModal";
import { theme } from "@/constants/theme";
import { usePaymentState } from "@/hooks/usePaymentState";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PaymentScreen() {
  const router = useRouter();
  const { billId, customerId, customerName, totalAmount } = useLocalSearchParams<{
    billId: string;
    customerId: string;
    customerName: string;
    totalAmount: string;
  }>();

  const total = parseFloat(totalAmount || "0");

  const {
    selectedPaymentType,
    showSplitPayment,
    splitPayments,
    newSplitType,
    newSplitAmount,
    splitModalScreen,
    creditAmount,
    setShowSplitPayment,
    setSplitModalScreen,
    setNewSplitType,
    setNewSplitAmount,
    setSelectedPaymentType,
    handlePaymentTypeSelect,
    handleAddNewSplit,
    handleConfirmAddSplit,
    handleRemoveSplit,
    validatePayment,
  } = usePaymentState({ totalAmount: total });

  const goToReceipt = (paymentType: string, splitOverride?: any[]) => {
    router.push({
      pathname: "/(modals)/receipt",
      params: {
        billId,
        customerId,
        customerName,
        totalAmount: totalAmount,
        paymentType,
        splitPayments: paymentType === "Split" ? JSON.stringify(splitOverride || splitPayments) : "",
      }
    });
  };

  const handleProceed = () => {
    if (!validatePayment()) return;
    goToReceipt(selectedPaymentType as string);
  };

  // Wrap selection to auto-navigate for simple methods
  const handleSelectAndMaybeProceed = (type: any) => {
    if (type === 'Split') {
      handlePaymentTypeSelect(type);
      return; // opens split modal
    }
    // For single methods bypass local state and go straight
    goToReceipt(type);
  };

  const handleExitSplit = () => {
    setShowSplitPayment(false);
    setSelectedPaymentType(null);
    setSplitModalScreen('list');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Payment",
          headerStyle: { backgroundColor: "white" },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      <View style={{ flex: 1 }} />

      <PaymentTypeModal
        visible={selectedPaymentType === null}
        onSelectPayment={handleSelectAndMaybeProceed}
        onCancel={() => router.back()}
      />

      <SplitPaymentModal
        visible={showSplitPayment}
        screen={splitModalScreen}
        splitPayments={splitPayments}
        creditAmount={creditAmount}
        newSplitType={newSplitType}
        newSplitAmount={newSplitAmount}
        onScreenChange={setSplitModalScreen}
        onSplitTypeChange={setNewSplitType}
        onAmountChange={setNewSplitAmount}
        onAddSplit={handleAddNewSplit}
        onConfirmSplit={handleConfirmAddSplit}
        onRemoveSplit={handleRemoveSplit}
        onProceed={handleProceed}
        onClose={handleExitSplit}
      />
    </SafeAreaView>
  );
}
