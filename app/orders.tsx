import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrdersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 justify-center items-center px-4">
        <Text className="text-6xl mb-4">📋</Text>
        <Text className="text-2xl font-bold text-gray-800 mb-2">
          Orders Screen
        </Text>
        <Text className="text-gray-500 text-center">
          Order management coming soon...
        </Text>
      </View>
    </SafeAreaView>
  );
}
