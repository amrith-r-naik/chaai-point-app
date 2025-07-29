// components/TextInputField.tsx
import React from "react";
import { TextInputProps } from "react-native";
import { Input } from "./ui";

export default function TextInputField({
  label,
  value,
  secureTextEntry = false,
  onChangeText,
  onBlur,
  keyboardType,
  autoCapitalize = "sentences",
  autoComplete,
  error,
  hint,
  leftIcon,
  rightIcon,
  ...props
}: {
  label: string;
  value: string;
  secureTextEntry?: boolean;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "off";
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
} & Omit<TextInputProps, "value" | "onChangeText">) {
  return (
    <Input
      label={label}
      value={value}
      secureTextEntry={secureTextEntry}
      onChangeText={onChangeText}
      onBlur={onBlur}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      error={error}
      hint={hint}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      variant="outlined"
      containerStyle={{ marginBottom: 16 }}
      {...props}
    />
  );
}
