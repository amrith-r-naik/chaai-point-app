/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // IMPORTANT: Keep these colors in sync with constants/theme.ts
        primary: "#3b82f6", // Change this along with theme.ts primary color
        "primary-light": "#eff6ff", // Change this along with theme.ts primaryLight color
        secondary: "#6b7280",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
      },
    },
  },
  plugins: [],
};
