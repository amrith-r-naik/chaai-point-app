/**
 * Global Theme Configuration
 *
 * To change the primary color throughout the app:
 * 1. Update the 'primary' color value below
 * 2. Update the 'primaryLight' color for a lighter variant
 * 3. Update the same colors in tailwind.config.js for consistency
 *
 * Current primary color: Blue (#3b82f6)
 */

export const theme = {
  colors: {
    primary: "#3b82f6", // Blue color from dashboard - CHANGE THIS to update primary color app-wide
    primaryLight: "#eff6ff", // Light blue for background - CHANGE THIS to match primary
    primaryDark: "#1e40af", // Darker shade of primary
    secondary: "#6b7280", // Gray for inactive elements
    background: "#ffffff", // White background
    surface: "#f9fafb", // Surface color for cards, modals
    text: "#1f2937", // Dark text
    textSecondary: "#6b7280", // Secondary text
    textLight: "#9ca3af", // Light text
    border: "#e5e7eb", // Border color
    borderLight: "#f3f4f6", // Light border color
    success: "#10b981", // Green for success
    successLight: "#ecfdf5", // Light success background
    warning: "#f59e0b", // Yellow for warning
    warningLight: "#fffbeb", // Light warning background
    error: "#ef4444", // Red for error
    errorLight: "#fef2f2", // Light error background
    info: "#3b82f6", // Blue for info
    infoLight: "#eff6ff", // Light info background
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
    full: 999,
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 28,
    "4xl": 32,
    "5xl": 36,
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    xl: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  opacity: {
    disabled: 0.6,
    hover: 0.8,
    press: 0.7,
  },
  zIndex: {
    modal: 1000,
    overlay: 999,
    dropdown: 998,
    header: 997,
  },
} as const;
