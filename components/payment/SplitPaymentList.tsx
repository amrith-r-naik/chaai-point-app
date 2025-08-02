import { theme } from "@/constants/theme";
import { SplitPayment } from "@/types/payment";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface SplitPaymentListProps {
  splitPayments: SplitPayment[];
  creditAmount: number;
  onAddSplit: () => void;
  onRemoveSplit: (id: string) => void;
  onProceed: () => void;
}

export const SplitPaymentList: React.FC<SplitPaymentListProps> = ({
  splitPayments,
  creditAmount,
  onAddSplit,
  onRemoveSplit,
  onProceed,
}) => {
  return (
    <>
      <Text style={{
        fontSize: 20,
        fontWeight: "600",
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: "center",
      }}>
        Split Payment
      </Text>

      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
        paddingHorizontal: 8,
      }}>
        <Text style={{
          fontSize: 14,
          color: theme.colors.textSecondary,
        }}>
          Credit: ₹{creditAmount.toFixed(2)}
        </Text>
        <TouchableOpacity onPress={onAddSplit} disabled={creditAmount <= 0}>
          <Text style={{
            fontSize: 14,
            color: creditAmount > 0 ? "#2563eb" : "#9ca3af",
            fontWeight: "500",
          }}>
            + New Split
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ maxHeight: 300 }}>
        {splitPayments.map((payment) => (
          <View
            key={payment.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
              padding: 12,
              backgroundColor: payment.type === "Credit" ? "#eff6ff" : "#f9fafb",
              borderRadius: 8,
              borderWidth: payment.type === "Credit" ? 1 : 0,
              borderColor: payment.type === "Credit" ? "#3b82f6" : "transparent",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 14,
                color: payment.type === "Credit" ? "#1e40af" : theme.colors.text,
                fontWeight: payment.type === "Credit" ? "600" : "500",
              }}>
                {payment.type}: ₹{payment.amount.toFixed(2)}
              </Text>
            </View>
            {payment.type !== "Credit" && (
              <TouchableOpacity
                onPress={() => onRemoveSplit(payment.id)}
                style={{
                  padding: 4,
                }}
              >
                <Text style={{
                  color: "#ef4444",
                  fontSize: 16,
                }}>
                  ×
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={onProceed}
        style={{
          backgroundColor: "black",
          paddingVertical: 16,
          borderRadius: 12,
          marginTop: 16,
        }}
      >
        <Text style={{
          color: "white",
          fontSize: 16,
          fontWeight: "600",
          textAlign: "center",
        }}>
          PROCEED
        </Text>
      </TouchableOpacity>
    </>
  );
};
