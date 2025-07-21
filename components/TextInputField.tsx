import React from "react";
import { Text, TextInput, View } from "react-native";

export default function TextInputField({
  label,
  value,
  secureTextEntry = false,
  onChangeText,
  onBlur,
  keyboardType,
  autoCapitalize = "sentences",
  autoComplete,
}: {
  label: string;
  value: string;
  secureTextEntry?: boolean;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "off";
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-gray-700 font-medium">{label}</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 focus:bg-white focus:border-black"
        value={value}
        secureTextEntry={secureTextEntry}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}
