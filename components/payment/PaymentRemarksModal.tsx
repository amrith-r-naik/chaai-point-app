import React from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { theme } from "@/constants/theme";

interface PaymentRemarksModalProps {
  visible: boolean;
  remarks: string;
  onRemarksChange: (remarks: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PaymentRemarksModal: React.FC<PaymentRemarksModalProps> = ({
  visible,
  remarks,
  onRemarksChange,
  onConfirm,
  onCancel,
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
        }}>
          <Text style={{
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
            marginBottom: 16,
            textAlign: "center",
          }}>
            Payment Remarks
          </Text>

          <Text style={{
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: 12,
          }}>
            Add any remarks about this payment (optional):
          </Text>

          <TextInput
            value={remarks}
            onChangeText={onRemarksChange}
            placeholder="Enter payment remarks..."
            multiline
            numberOfLines={4}
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
              color: theme.colors.text,
              textAlignVertical: "top",
              marginBottom: 20,
              minHeight: 80,
            }}
          />

          <View style={{
            flexDirection: "row",
            gap: 12,
          }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            >
              <Text style={{
                color: theme.colors.text,
                fontSize: 14,
                fontWeight: "500",
                textAlign: "center",
              }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              style={{
                flex: 1,
                backgroundColor: "black",
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{
                color: "white",
                fontSize: 14,
                fontWeight: "600",
                textAlign: "center",
              }}>
                Process Payment
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
