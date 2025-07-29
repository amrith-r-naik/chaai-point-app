import { theme } from "@/constants/theme";
import React from "react";
import { View } from "react-native";
import { Typography } from "./Typography";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  backgroundColor?: string;
  textColor?: string;
  style?: any;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = "md",
  backgroundColor,
  textColor,
  style,
}) => {
  const getSize = () => {
    switch (size) {
      case "sm":
        return 32;
      case "md":
        return 40;
      case "lg":
        return 48;
      case "xl":
        return 64;
      default:
        return 40;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return 14;
      case "md":
        return 16;
      case "lg":
        return 18;
      case "xl":
        return 24;
      default:
        return 16;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarSize = getSize();
  const fontSize = getFontSize();

  return (
    <View
      style={[
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: backgroundColor || theme.colors.primaryLight,
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <Typography
        weight="semibold"
        style={{
          fontSize,
          color: textColor || theme.colors.primary,
        }}
      >
        {getInitials(name)}
      </Typography>
    </View>
  );
};
