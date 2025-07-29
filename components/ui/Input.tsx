// components/ui/Input.tsx
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "../../constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: "default" | "filled" | "outlined";
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  containerStyle,
  inputStyle,
  labelStyle,
  leftIcon,
  rightIcon,
  variant = "outlined",
  onBlur,
  onFocus,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const getContainerStyle = () => {
    switch (variant) {
      case "filled":
        return [
          styles.container,
          styles.filledContainer,
          isFocused && styles.focusedContainer,
          error && styles.errorContainer,
        ];
      case "outlined":
        return [
          styles.container,
          styles.outlinedContainer,
          isFocused && styles.focusedOutlined,
          error && styles.errorOutlined,
        ];
      default:
        return [
          styles.container,
          styles.defaultContainer,
          isFocused && styles.focusedContainer,
          error && styles.errorContainer,
        ];
    }
  };

  return (
    <View style={[containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle, error && styles.errorLabel]}>
          {label}
        </Text>
      )}
      <View style={getContainerStyle()}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            rightIcon ? styles.inputWithRightIcon : null,
            inputStyle,
          ]}
          placeholderTextColor={theme.colors.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 6,
  },
  errorLabel: {
    color: theme.colors.error,
  },

  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.borderRadius.md,
  },

  // Default variant
  defaultContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Filled variant
  filledContainer: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Outlined variant
  outlinedContainer: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Focus states
  focusedContainer: {
    backgroundColor: theme.colors.primaryLight,
  },
  focusedOutlined: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },

  // Error states
  errorContainer: {
    borderColor: theme.colors.error,
    backgroundColor: "#fef2f2",
  },
  errorOutlined: {
    borderColor: theme.colors.error,
    backgroundColor: "#fef2f2",
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 0, // Remove default padding
  },
  inputWithLeftIcon: {
    marginLeft: 12,
  },
  inputWithRightIcon: {
    marginRight: 12,
  },

  leftIcon: {
    justifyContent: "center",
    alignItems: "center",
  },
  rightIcon: {
    justifyContent: "center",
    alignItems: "center",
  },

  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
