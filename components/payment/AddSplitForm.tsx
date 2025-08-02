import { theme } from "@/constants/theme";
import { paymentTypes } from "@/utils/paymentUtils";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

interface AddSplitFormProps {
  newSplitType: "Cash" | "UPI" | "Credit";
  newSplitAmount: string;
  creditAmount: number;
  onSplitTypeChange: (type: "Cash" | "UPI" | "Credit") => void;
  onAmountChange: (amount: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AddSplitForm: React.FC<AddSplitFormProps> = ({
  newSplitType,
  newSplitAmount,
  creditAmount,
  onSplitTypeChange,
  onAmountChange,
  onConfirm,
  onCancel,
}) => {
  const isValidAmount = () => {
    const amount = parseFloat(newSplitAmount);
    return !isNaN(amount) && amount > 0 && amount <= creditAmount;
  };

  const isFormValid = newSplitType && newSplitAmount && isValidAmount();

  return (
    <>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
      }}>
        <TouchableOpacity
          onPress={onCancel}
          style={{
            padding: 8,
            marginLeft: -8,
          }}
        >
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={{
          fontSize: 18,
          fontWeight: "600",
          color: theme.colors.text,
          marginLeft: 8,
        }}>
          Add Payment Split
        </Text>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{
          fontSize: 14,
          color: theme.colors.textSecondary,
          marginBottom: 8,
        }}>
          Payment Type
        </Text>
        <View style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}>
          {paymentTypes.filter(type => type !== "Credit").map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => onSplitTypeChange(type)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: newSplitType === type ? "black" : "#f3f4f6",
                borderWidth: 1,
                borderColor: newSplitType === type ? "black" : "#e5e7eb",
              }}
            >
              <Text style={{
                color: newSplitType === type ? "white" : theme.colors.text,
                fontSize: 12,
                fontWeight: "500",
              }}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{
          fontSize: 14,
          color: theme.colors.textSecondary,
          marginBottom: 8,
        }}>
          Amount (Max: ₹{creditAmount.toFixed(2)})
        </Text>
        <TextInput
          value={newSplitAmount}
          onChangeText={onAmountChange}
          placeholder="Enter amount"
          keyboardType="numeric"
          autoFocus={true}
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
            color: theme.colors.text,
          }}
        />
      </View>

      <TouchableOpacity
        onPress={onConfirm}
        disabled={!isFormValid}
        style={{
          backgroundColor: isFormValid ? "black" : "#9ca3af",
          paddingVertical: 16,
          borderRadius: 12,
        }}
      >
        <Text style={{
          color: "white",
          fontSize: 16,
          fontWeight: "600",
          textAlign: "center",
        }}>
          Add Split
        </Text>
      </TouchableOpacity>
    </>
  );
};
