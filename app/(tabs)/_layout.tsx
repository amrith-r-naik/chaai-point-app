import { Tabs } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          paddingBottom: 20,
          paddingTop: 10,
          height: 80,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 4,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
        tabBarIcon: ({ focused, color }) => {
          let emoji = "🏠";
          if (route.name === "customers") emoji = "👥";
          if (route.name === "orders") emoji = "📋";
          if (route.name === "billing") emoji = "💳";

          return (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 50,
                height: 50,
                backgroundColor: focused ? "#eff6ff" : "transparent",
                borderRadius: 25,
              }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="customers" options={{ title: "Customers" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="billing" options={{ title: "Billing" }} />
    </Tabs>
  );
}
