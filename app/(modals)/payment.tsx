import { SplitPaymentModal } from "@/components/payment/SplitPaymentModal";
import { theme } from "@/constants/theme";
import { usePaymentState } from "@/hooks/usePaymentState";
import { PaymentType } from "@/types/payment";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CreditCard, DollarSign, QrCode, Split } from "lucide-react-native";
import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
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

  const paymentOptions: { type: PaymentType; label: string; icon: React.ReactNode; color: string }[] = [
    { 
      type: "Cash", 
      label: "Cash Payment", 
      icon: <DollarSign size={24} color="#16a34a" />, 
      color: "#16a34a" 
    },
    { 
      type: "UPI", 
      label: "UPI Payment", 
      icon: <QrCode size={24} color="#2563eb" />, 
      color: "#2563eb" 
    },
    { 
      type: "Credit", 
      label: "Credit Payment", 
      icon: <CreditCard size={24} color="#dc2626" />, 
      color: "#dc2626" 
    },
    { 
      type: "Split", 
      label: "Split Payment", 
      icon: <Split size={24} color="#7c3aed" />, 
      color: "#7c3aed" 
    },
  ];

  const handleProceed = () => {
    if (!validatePayment()) {
      Alert.alert("Invalid Payment", "Please select a valid payment method.");
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Bill Summary */}
        <View style={{
          backgroundColor: "white",
          padding: 24,
          borderRadius: 16,
          marginBottom: 24,
          alignItems: "center",
          ...theme.shadows.sm,
        }}>
          <Text style={{
            fontSize: 16,
            color: theme.colors.textSecondary,
            marginBottom: 8,
          }}>
            {customerName}
          </Text>
          <Text style={{
            fontSize: 32,
            fontWeight: "700",
            color: theme.colors.text,
            marginBottom: 4,
          }}>
            ₹{total.toFixed(2)}
          </Text>
          <Text style={{
            fontSize: 14,
            color: theme.colors.textSecondary,
          }}>
            Total Amount
          </Text>
        </View>

        {/* Payment Options */}
        <View style={{
          backgroundColor: "white",
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
          ...theme.shadows.sm,
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
            marginBottom: 16,
          }}>
            Select Payment Method
          </Text>
          
          {paymentOptions.map((option) => (
            <TouchableOpacity
              key={option.type}
              onPress={() => handlePaymentTypeSelect(option.type)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: selectedPaymentType === option.type ? option.color : "#e5e7eb",
                backgroundColor: selectedPaymentType === option.type ? `${option.color}10` : "#f9fafb",
                marginBottom: 12,
              }}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: selectedPaymentType === option.type ? option.color : "#f3f4f6",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}>
                {option.icon}
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: selectedPaymentType === option.type ? "600" : "500",
                color: selectedPaymentType === option.type ? option.color : theme.colors.text,
                flex: 1,
              }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Split Payment Summary */}
        {selectedPaymentType === "Split" && splitPayments.length > 0 && (
          <View style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            ...theme.shadows.sm,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
            }}>
              Split Payment Summary
            </Text>
            
            {splitPayments.map((payment, index) => (
              <View key={index} style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 8,
                borderBottomWidth: index < splitPayments.length - 1 ? 1 : 0,
                borderBottomColor: "#f3f4f6",
              }}>
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.text,
                }}>
                  {payment.type}
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.colors.text,
                }}>
                  ₹{payment.amount.toFixed(2)}
                </Text>
              </View>
            ))}
            
            <TouchableOpacity
              onPress={() => setShowSplitPayment(true)}
              style={{
                backgroundColor: "#7c3aed",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                marginTop: 16,
                alignItems: "center",
              }}
            >
              <Text style={{
                color: "white",
                fontSize: 14,
                fontWeight: "600",
              }}>
                Edit Split Payment
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Proceed Button */}
        {selectedPaymentType && (
          <TouchableOpacity
            onPress={handleProceed}
            style={{
              backgroundColor: theme.colors.primary,
              paddingVertical: 18,
              borderRadius: 12,
              alignItems: "center",
              marginBottom: 32,
              ...theme.shadows.sm,
            }}
          >
            <Text style={{
              color: "white",
              fontSize: 18,
              fontWeight: "600",
            }}>
              Complete Payment
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Split Payment Modal */}
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
