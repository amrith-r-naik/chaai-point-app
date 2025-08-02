import { PaymentTypeModal } from "@/components/payment/PaymentTypeModal";
import { SplitPaymentModal } from "@/components/payment/SplitPaymentModal";
import { theme } from "@/constants/theme";
import { usePaymentState } from "@/hooks/usePaymentState";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
    handlePaymentTypeSelect,
    handleAddNewSplit,
    handleConfirmAddSplit,
    handleRemoveSplit,
    validatePayment,
  } = usePaymentState({ totalAmount: total });

  const handleProceed = () => {
    if (!validatePayment()) {
      // TODO: Show error message
      return;
    }

    // Navigate directly to receipt page
    router.push({
      pathname: "/(modals)/receipt",
      params: {
        billId,
        customerId,
        customerName,
        totalAmount: totalAmount,
        paymentType: selectedPaymentType as string,
        splitPayments: selectedPaymentType === "Split" ? JSON.stringify(splitPayments) : "",
      },
    });
  };

  const handleSplitProceed = () => {
    setShowSplitPayment(false);
    handleProceed();
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

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Text style={{
          fontSize: 24,
          fontWeight: "600",
          color: theme.colors.text,
          marginBottom: 8,
        }}>
          Bill Total: ₹{total.toFixed(2)}
        </Text>
        <Text style={{
          fontSize: 16,
          color: theme.colors.textSecondary,
          marginBottom: 32,
        }}>
          Select payment method
        </Text>

        {selectedPaymentType && selectedPaymentType !== "Split" && (
          <View style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 16,
            width: "100%",
            alignItems: "center",
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
            }}>
              Payment Method: {selectedPaymentType}
            </Text>
            <TouchableOpacity
              onPress={handleProceed}
              style={{
                backgroundColor: "black",
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 12,
              }}
            >
              <Text style={{
                color: "white",
                fontSize: 16,
                fontWeight: "600",
              }}>
                PROCEED
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedPaymentType === "Split" && !showSplitPayment && (
          <View style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 16,
            width: "100%",
            alignItems: "center",
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
            }}>
              Split Payment Configured
            </Text>
            <TouchableOpacity
              onPress={() => setShowSplitPayment(true)}
              style={{
                backgroundColor: "#2563eb",
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{
                color: "white",
                fontSize: 14,
                fontWeight: "500",
              }}>
                Edit Split
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleProceed}
              style={{
                backgroundColor: "black",
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 12,
              }}
            >
              <Text style={{
                color: "white",
                fontSize: 16,
                fontWeight: "600",
              }}>
                PROCEED
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <PaymentTypeModal
        visible={selectedPaymentType === null}
        onSelectPayment={handlePaymentTypeSelect}
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
        onProceed={handleSplitProceed}
      />
    </SafeAreaView>
  );
}
