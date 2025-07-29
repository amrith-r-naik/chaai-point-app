// components/ui/Card.tsx
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { theme } from "../../constants/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: "sm" | "md" | "lg";
  shadow?: "sm" | "md" | "lg";
  rounded?: "sm" | "md" | "lg" | "xl";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = "md",
  shadow = "sm",
  rounded = "md",
}) => {
  const getPaddingStyle = () => {
    switch (padding) {
      case "sm":
        return styles.paddingSm;
      case "md":
        return styles.paddingMd;
      case "lg":
        return styles.paddingLg;
      default:
        return styles.paddingMd;
    }
  };

  const getShadowStyle = () => {
    switch (shadow) {
      case "sm":
        return styles.shadowSm;
      case "md":
        return styles.shadowMd;
      case "lg":
        return styles.shadowLg;
      default:
        return styles.shadowSm;
    }
  };

  const getRoundedStyle = () => {
    switch (rounded) {
      case "sm":
        return styles.roundedSm;
      case "md":
        return styles.roundedMd;
      case "lg":
        return styles.roundedLg;
      case "xl":
        return styles.roundedXl;
      default:
        return styles.roundedMd;
    }
  };

  const cardStyle = [
    styles.base,
    getPaddingStyle(),
    getShadowStyle(),
    getRoundedStyle(),
    style,
  ];

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Padding
  paddingSm: {
    padding: theme.spacing.sm,
  },
  paddingMd: {
    padding: theme.spacing.md,
  },
  paddingLg: {
    padding: theme.spacing.lg,
  },

  // Shadows
  shadowSm: {
    ...theme.shadows.sm,
  },
  shadowMd: {
    ...theme.shadows.md,
  },
  shadowLg: {
    ...theme.shadows.lg,
  },

  // Rounded corners
  roundedSm: {
    borderRadius: theme.borderRadius.sm,
  },
  roundedMd: {
    borderRadius: theme.borderRadius.md,
  },
  roundedLg: {
    borderRadius: theme.borderRadius.lg,
  },
  roundedXl: {
    borderRadius: theme.borderRadius.xl,
  },
});
