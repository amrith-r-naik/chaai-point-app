// components/ui/Typography.tsx
import React from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { theme } from "../../constants/theme";

interface TypographyProps {
  children: React.ReactNode;
  variant?: "h1" | "h2" | "h3" | "h4" | "body" | "caption" | "overline";
  color?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "error"
    | "text"
    | "textSecondary";
  align?: "left" | "center" | "right";
  weight?: "normal" | "medium" | "semibold" | "bold";
  style?: TextStyle;
  numberOfLines?: number;
}

export const Typography: React.FC<TypographyProps> = ({
  children,
  variant = "body",
  color = "text",
  align = "left",
  weight = "normal",
  style,
  numberOfLines,
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case "h1":
        return styles.h1;
      case "h2":
        return styles.h2;
      case "h3":
        return styles.h3;
      case "h4":
        return styles.h4;
      case "body":
        return styles.body;
      case "caption":
        return styles.caption;
      case "overline":
        return styles.overline;
      default:
        return styles.body;
    }
  };

  const getColorStyle = () => {
    switch (color) {
      case "primary":
        return styles.colorPrimary;
      case "secondary":
        return styles.colorSecondary;
      case "success":
        return styles.colorSuccess;
      case "warning":
        return styles.colorWarning;
      case "error":
        return styles.colorError;
      case "text":
        return styles.colorText;
      case "textSecondary":
        return styles.colorTextSecondary;
      default:
        return styles.colorText;
    }
  };

  const getAlignStyle = () => {
    switch (align) {
      case "left":
        return styles.alignLeft;
      case "center":
        return styles.alignCenter;
      case "right":
        return styles.alignRight;
      default:
        return styles.alignLeft;
    }
  };

  const getWeightStyle = () => {
    switch (weight) {
      case "normal":
        return styles.weightNormal;
      case "medium":
        return styles.weightMedium;
      case "semibold":
        return styles.weightSemibold;
      case "bold":
        return styles.weightBold;
      default:
        return styles.weightNormal;
    }
  };

  const textStyle = [
    getVariantStyle(),
    getColorStyle(),
    getAlignStyle(),
    getWeightStyle(),
    style,
  ];

  return (
    <Text style={textStyle} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  // Variants
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800",
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
  },
  overline: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  // Colors
  colorPrimary: {
    color: theme.colors.primary,
  },
  colorSecondary: {
    color: theme.colors.secondary,
  },
  colorSuccess: {
    color: theme.colors.success,
  },
  colorWarning: {
    color: theme.colors.warning,
  },
  colorError: {
    color: theme.colors.error,
  },
  colorText: {
    color: theme.colors.text,
  },
  colorTextSecondary: {
    color: theme.colors.textSecondary,
  },

  // Alignment
  alignLeft: {
    textAlign: "left",
  },
  alignCenter: {
    textAlign: "center",
  },
  alignRight: {
    textAlign: "right",
  },

  // Weight
  weightNormal: {
    fontWeight: "400",
  },
  weightMedium: {
    fontWeight: "500",
  },
  weightSemibold: {
    fontWeight: "600",
  },
  weightBold: {
    fontWeight: "700",
  },
});
