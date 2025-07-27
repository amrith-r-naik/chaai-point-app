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
    secondary: "#6b7280", // Gray for inactive elements
    background: "#ffffff", // White background
    text: "#1f2937", // Dark text
    textSecondary: "#6b7280", // Secondary text
    border: "#e5e7eb", // Border color
    success: "#10b981", // Green for success
    warning: "#f59e0b", // Yellow for warning
    error: "#ef4444", // Red for error
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
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
  },
} as const;
