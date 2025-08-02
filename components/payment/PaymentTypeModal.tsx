import { theme } from "@/constants/theme";
import { PaymentType } from "@/types/payment";
import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

interface PaymentTypeModalProps {
  visible: boolean;
  onSelectPayment: (type: PaymentType) => void;
  onCancel: () => void;
}

export const PaymentTypeModal: React.FC<PaymentTypeModalProps> = ({
  visible,
  onSelectPayment,
  onCancel,
}) => {
  const paymentOptions: PaymentType[] = ["Cash", "UPI", "Credit", "Split"];

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
        }}>
          <Text style={{
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
            marginBottom: 24,
            textAlign: "center",
          }}>
            Payment Type
          </Text>

          {paymentOptions.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => onSelectPayment(type)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f3f4f6",
              }}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: "#d1d5db",
                marginRight: 16,
              }} />
              <Text style={{
                fontSize: 16,
                color: theme.colors.text,
              }}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={onCancel}
            style={{
              backgroundColor: "black",
              paddingVertical: 16,
              borderRadius: 12,
              marginTop: 24,
            }}
          >
            <Text style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
              textAlign: "center",
            }}>
              CANCEL
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
