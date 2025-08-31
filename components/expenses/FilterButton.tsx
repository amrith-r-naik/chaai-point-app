import { Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import React from "react";
import { TouchableOpacity } from "react-native";

export const FilterButton: React.FC<{
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ active, onPress, children }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      backgroundColor: active ? "white" : "rgba(255,255,255,0.1)",
      borderWidth: 1,
      borderColor: active ? "white" : "rgba(255,255,255,0.2)",
      marginRight: 12,
      shadowColor: active ? "#000" : "transparent",
      shadowOffset: active ? { width: 0, height: 4 } : { width: 0, height: 0 },
      shadowOpacity: active ? 0.15 : 0,
      shadowRadius: active ? 8 : 0,
      elevation: active ? 4 : 0,
      minWidth: 80,
      alignItems: "center",
    }}
  >
    <Typography
      variant="caption"
      weight="bold"
      style={{
        color: active ? theme.colors.primary : "white",
        fontSize: 13,
      }}
    >
      {children}
    </Typography>
  </TouchableOpacity>
);
