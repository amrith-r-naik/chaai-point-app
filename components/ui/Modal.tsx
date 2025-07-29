import { theme } from "@/constants/theme";
import { X } from "lucide-react-native";
import React from "react";
import {
  Modal as RNModal,
  SafeAreaView,
  TouchableOpacity,
  View,
} from "react-native";
import { Typography } from "./Typography";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  size?: "sm" | "md" | "lg" | "full";
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  size = "md",
  actions,
}) => {
  const getModalWidth = () => {
    switch (size) {
      case "sm":
        return "80%";
      case "md":
        return "90%";
      case "lg":
        return "95%";
      case "full":
        return "100%";
      default:
        return "90%";
    }
  };

  const getModalHeight = () => {
    switch (size) {
      case "full":
        return "100%";
      default:
        return "auto";
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: size === "full" ? 0 : 16,
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={closeOnBackdrop ? onClose : undefined}
            activeOpacity={1}
          />

          <View
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: size === "full" ? 0 : theme.borderRadius.xl,
              width: getModalWidth(),
              height: getModalHeight(),
              maxHeight: size === "full" ? "100%" : "90%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 20,
            }}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.borderLight,
                }}
              >
                {title ? (
                  <Typography variant="h3" weight="semibold">
                    {title}
                  </Typography>
                ) : (
                  <View />
                )}

                {showCloseButton && (
                  <TouchableOpacity
                    onPress={onClose}
                    style={{
                      padding: 4,
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <X size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Content */}
            <View
              style={{
                flex: 1,
                padding: 20,
              }}
            >
              {children}
            </View>

            {/* Actions */}
            {actions && (
              <View
                style={{
                  padding: 20,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.borderLight,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                {actions}
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </RNModal>
  );
};
