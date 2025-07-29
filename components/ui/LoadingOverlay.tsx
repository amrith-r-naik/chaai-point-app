// components/ui/LoadingOverlay.tsx
import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { theme } from "../../constants/theme";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = "Loading...",
}) => {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    minWidth: 120,
    ...theme.shadows.lg,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: "center",
  },
});
