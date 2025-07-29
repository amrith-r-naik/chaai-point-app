import { theme } from "@/constants/theme";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Typography } from "./Typography";

interface LoadingProps {
  message?: string;
  size?: "small" | "large";
  color?: string;
  style?: any;
}

export const Loading: React.FC<LoadingProps> = ({
  message = "Loading...",
  size = "large",
  color = theme.colors.primary,
  style,
}) => {
  return (
    <View
      style={[
        {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        },
        style,
      ]}
    >
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Typography
          variant="body"
          color="textSecondary"
          style={{ marginTop: 16, textAlign: "center" }}
        >
          {message}
        </Typography>
      )}
    </View>
  );
};
