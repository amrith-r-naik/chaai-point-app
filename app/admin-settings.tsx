import { theme } from "@/constants/theme";
import { adminService } from "@/services/adminService";
import { menuService } from "@/services/menuService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import { Database, Lock, Plus, Settings, Trash2, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function AdminSettingsScreen() {
  const auth = use$(authState);
  const [loading, setLoading] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Check if user is authenticated and has admin role
    if (!auth.user) {
      router.replace("/(auth)/login");
      return;
    }

    if (auth.user.role !== "admin") {
      Alert.alert(
        "Access Denied",
        "You don&apos;t have permission to access admin settings. Only admin users can access this area.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }

    loadTableCounts();
  }, [auth.user]);

  // Show access denied screen for non-admin users
  if (!auth.user || auth.user.role !== "admin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#fee2e2",
              width: 80,
              height: 80,
              borderRadius: 40,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Lock size={40} color="#dc2626" />
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: "#dc2626",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Access Denied
          </Text>

          <Text
            style={{
              fontSize: 16,
              color: theme.colors.textSecondary,
              textAlign: "center",
              lineHeight: 24,
              marginBottom: 32,
            }}
          >
            You don&apos;t have permission to access admin settings. Only admin
            users can access this area.
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: theme.colors.background,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "600" }}>
                Go Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{
                backgroundColor: theme.colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                Go to Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const loadTableCounts = async () => {
    try {
      const counts = await adminService.getTableCounts();
      setTableCounts(counts);
    } catch (error) {
      console.error("Error loading table counts:", error);
    }
  };

  const handleClearAllTables = () => {
    Alert.alert(
      "Clear All Business Data",
      "This will permanently delete ALL business data (orders, customers, menu items, payments, etc.) but will preserve user accounts. This action cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await adminService.clearAllTables();
              await loadTableCounts();
              Alert.alert("Success", "All business data cleared successfully. User accounts preserved.");
            } catch (error) {
              Alert.alert("Error", `Failed to clear data: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetupDemoData = () => {
    Alert.alert(
      "Setup Demo Data",
      "This will clear all existing business data (but preserve user accounts) and add demo menu items and customers. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Setup",
          onPress: async () => {
            try {
              setLoading(true);
              await adminService.setupDemoData();
              await loadTableCounts();
              Alert.alert("Success", "Demo data setup completed. User accounts preserved.");
            } catch (error) {
              Alert.alert("Error", `Failed to setup demo data: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddDemoMenuItems = () => {
    Alert.alert(
      "Add Demo Menu Items",
      "This will add demo menu items to the database. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.addDemoMenuItems();
              await loadTableCounts();
              Alert.alert("Success", "Demo menu items added successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to add demo menu items: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddDemoCustomers = () => {
    Alert.alert(
      "Add Demo Customers",
      "This will add demo customers to the database. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          onPress: async () => {
            try {
              setLoading(true);
              await adminService.addDemoCustomers();
              await loadTableCounts();
              Alert.alert("Success", "Demo customers added successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to add demo customers: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClearMenuItems = () => {
    Alert.alert(
      "Clear Menu Items",
      "This will delete all menu items. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.clearAllMenuItems();
              await loadTableCounts();
              Alert.alert("Success", "Menu items cleared successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to clear menu items: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const AdminCard = ({
    title,
    description,
    icon: Icon,
    onPress,
    destructive = false,
    disabled = false,
  }: {
    title: string;
    description: string;
    icon: any;
    onPress: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: theme.colors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: destructive ? "#fee2e2" : theme.colors.border,
        opacity: disabled || loading ? 0.6 : 1,
        ...theme.shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: destructive
              ? "#fee2e2"
              : theme.colors.primaryLight,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <Icon
            size={24}
            color={destructive ? "#dc2626" : theme.colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: destructive ? "#dc2626" : theme.colors.text,
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              lineHeight: 20,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({ label, count }: { label: string; count: number }) => (
    <View
      style={{
        backgroundColor: theme.colors.background,
        padding: 16,
        borderRadius: 12,
        marginRight: 12,
        minWidth: 100,
        alignItems: "center",
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "bold",
          color: theme.colors.primary,
          marginBottom: 4,
        }}
      >
        {count}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: theme.colors.textSecondary,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: theme.colors.primary,
          paddingTop: 12,
          paddingBottom: 24,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Settings size={28} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 24,
              fontWeight: "bold",
              marginLeft: 12,
            }}
          >
            Admin Settings
          </Text>
        </View>
        <Text
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: 14,
            marginTop: 4,
          }}
        >
          Manage your application data and settings
        </Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 24 }}>
        {/* Database Statistics */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Database Overview
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <StatCard label="Users" count={tableCounts.users || 0} />
            <StatCard label="Customers" count={tableCounts.customers || 0} />
            <StatCard label="Menu Items" count={tableCounts.menu_items || 0} />
            <StatCard label="Orders" count={tableCounts.kot_orders || 0} />
            <StatCard label="Order Items" count={tableCounts.kot_items || 0} />
            <StatCard label="Expenses" count={tableCounts.expenses || 0} />
          </ScrollView>
        </View>

        {/* Menu Management */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Menu Management
          </Text>

          <AdminCard
            title="Add Demo Menu Items"
            description="Add sample menu items with various categories (Tea, Coffee, Pasta, Snacks, Beverages)"
            icon={Plus}
            onPress={handleAddDemoMenuItems}
          />

          <AdminCard
            title="Clear Menu Items"
            description="Remove all menu items from the database"
            icon={Trash2}
            onPress={handleClearMenuItems}
            destructive
          />
        </View>

        {/* Customer Management */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Customer Management
          </Text>

          <AdminCard
            title="Add Demo Customers"
            description="Add sample customers to test order creation functionality"
            icon={Users}
            onPress={handleAddDemoCustomers}
          />
        </View>

        {/* Database Management */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Database Management
          </Text>

          <AdminCard
            title="Setup Demo Data"
            description="Clear all business data (preserves users) and setup with demo menu items and customers"
            icon={Database}
            onPress={handleSetupDemoData}
          />

          <AdminCard
            title="Clear All Business Data"
            description="⚠️ Permanently delete ALL business data (orders, customers, menu, payments). User accounts are preserved."
            icon={Trash2}
            onPress={handleClearAllTables}
            destructive
          />
        </View>

        {loading && (
          <View
            style={{
              backgroundColor: theme.colors.background,
              padding: 20,
              borderRadius: 12,
              alignItems: "center",
              marginBottom: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              style={{
                marginTop: 12,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Processing...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
