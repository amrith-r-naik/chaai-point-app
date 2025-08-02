import { theme } from "@/constants/theme";
import { Tabs, useRouter } from "expo-router";
import {
  ClipboardList,
  CreditCard,
  Home,
  Plus,
  Users,
} from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export default function TabLayout() {
  const router = useRouter();

  const handleCreateOrder = () => {
    router.push("/(modals)/create-order");
  };

  const getIcon = (routeName: string, focused: boolean) => {
    const iconColor = focused ? theme.colors.primary : theme.colors.secondary;
    const iconSize = 20;

    switch (routeName) {
      case "index":
        return <Home color={iconColor} size={iconSize} />;
      case "customers":
        return <Users color={iconColor} size={iconSize} />;
      case "add":
        return null; // This will be handled by the custom button
      case "orders":
        return <ClipboardList color={iconColor} size={iconSize} />;
      case "billing":
        return <CreditCard color={iconColor} size={iconSize} />;
      default:
        return <Home color={iconColor} size={iconSize} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarPressColor: "transparent",
          tabBarPressOpacity: 1,
          tabBarStyle: {
            backgroundColor: theme.colors.background,
            borderTopWidth: 0,
            paddingBottom: 50,
            paddingTop: 12,
            paddingHorizontal: 20,
            height: 100,
            elevation: 15,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 8,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.secondary,
          tabBarIcon: ({ focused }: { focused: boolean }) => {
            return (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  backgroundColor: focused
                    ? theme.colors.primaryLight
                    : "transparent",
                  borderRadius: 14,
                }}
              >
                {getIcon(route.name, focused)}
              </View>
            );
          },
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarButton: (props: any) => (
              <TouchableOpacity
                {...props}
                activeOpacity={1}
                style={[props.style, { flex: 1 }]}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: "Customers",
            tabBarButton: (props: any) => (
              <TouchableOpacity
                {...props}
                activeOpacity={1}
                style={[props.style, { flex: 1 }]}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarButton: () => (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TouchableOpacity
                  onPress={handleCreateOrder}
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 40,
                    backgroundColor: theme.colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: -30,
                    borderWidth: 4,
                    borderColor: theme.colors.background,
                  }}
                >
                  <Plus color="white" size={24} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarButton: (props: any) => (
              <TouchableOpacity
                {...props}
                activeOpacity={1}
                style={[props.style, { flex: 1 }]}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
            title: "Expenses",
            tabBarButton: (props: any) => (
              <TouchableOpacity
                {...props}
                activeOpacity={1}
                style={[props.style, { flex: 1 }]}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
