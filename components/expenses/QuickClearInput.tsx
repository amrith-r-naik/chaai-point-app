import { Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import React from "react";
import { TextInput, TouchableOpacity, View } from "react-native";

export const QuickClearInput: React.FC<{
  label: "Cash" | "UPI";
  onConfirm: (amountText: string) => void;
}> = ({ label, onConfirm }) => {
  const [val, setVal] = React.useState("");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Typography
          variant="caption"
          style={{ marginBottom: 4, color: "#64748B" }}
        >
          {label} amount
        </Typography>
        <View
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: "#F9FAFB",
          }}
        >
          <TextInput
            value={val}
            onChangeText={setVal}
            placeholder="0"
            keyboardType="numeric"
            style={{ minWidth: 80 }}
          />
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onConfirm(val)}
        style={{
          marginLeft: 8,
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 10,
        }}
      >
        <Typography style={{ color: "white", fontWeight: "700" }}>
          Add
        </Typography>
      </TouchableOpacity>
    </View>
  );
};
