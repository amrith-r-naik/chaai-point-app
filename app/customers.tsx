import CustomerModal from "@/components/CustomerModal";
import {
  Customer,
  deleteCustomer,
  getAllCustomers,
  searchCustomers,
} from "@/services/customerService";
import { authState } from "@/state/authState";
import {
  customerState,
  setSelectedCustomer,
  toggleAddModal,
  toggleEditModal,
} from "@/state/customerState";
import { use$ } from "@legendapp/state/react";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CustomersScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");
  const [refreshing, setRefreshing] = useState(false);
  const customerStateData = use$(customerState);
  const auth = use$(authState);

  const loadCustomers = useCallback(async () => {
    try {
      // Don't load customers if database isn't ready
      if (!auth.isDbReady) {
        return;
      }

      customerState.loading.set(true);
      customerState.error.set("");

      let customers;
      if (searchQuery.trim()) {
        customers = await searchCustomers(searchQuery.trim());
      } else {
        customers = await getAllCustomers();
      }

      customerState.customers.set(customers);
    } catch (error: any) {
      customerState.error.set(error.message || "Failed to load customers");
    } finally {
      customerState.loading.set(false);
    }
  }, [searchQuery, auth.isDbReady]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  }, [loadCustomers]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Filter customers based on active tab
  const filteredCustomers = customerStateData.customers.filter((customer) => {
    if (activeTab === "active") {
      // For now, we'll show customers with recent activity
      // In a real scenario, you'd track active sessions/orders
      return true; // Show all for demo
    }
    return true; // Show all customers
  });

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    toggleEditModal();
  };

  const handleDelete = (customer: Customer) => {
    Alert.alert(
      "Delete Customer",
      `Are you sure you want to delete "${customer.name}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              customerState.loading.set(true);
              await deleteCustomer(customer.id);
              loadCustomers();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to delete customer"
              );
            } finally {
              customerState.loading.set(false);
            }
          },
        },
      ]
    );
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const initials = item.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Generate a random amount for demo purposes (in real app, this would come from orders)
    const amounts = [30, 45, 60, 75, 90, 115, 130, 145, 160, 180];
    // TODO: Get amount from kot_orders
    const randomAmount = amounts[item.id.charCodeAt(0) % amounts.length];

    return (
      <TouchableOpacity className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        {/* Customer Avatar and Info */}
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center mr-3">
            <Text className="text-white font-semibold text-sm">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-medium text-base">
              {item.name}
            </Text>
            {item.contact && (
              <Text className="text-gray-500 text-sm">{item.contact}</Text>
            )}
          </View>
        </View>

        {/* Amount and Actions */}
        <View className="flex-row items-center">
          <Text className="text-gray-900 font-semibold text-base mr-4">
            ₹{randomAmount}
          </Text>
          <TouchableOpacity onPress={() => handleEdit(item)} className="p-2">
            <Text className="text-blue-600">✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} className="p-2">
            <Text className="text-red-600">🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-gray-900">Customers</Text>
          <TouchableOpacity className="p-2">
            <Text className="text-gray-600 text-lg">☰</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="relative mb-4">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Text className="text-gray-400 text-lg mr-2">🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Type name to search"
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-base"
            />
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row mb-4">
          <TouchableOpacity
            onPress={() => setActiveTab("active")}
            className={`px-4 py-2 mr-2 rounded-full ${
              activeTab === "active" ? "bg-green-600" : "bg-gray-200"
            }`}
          >
            <Text
              className={`font-medium ${
                activeTab === "active" ? "text-white" : "text-gray-700"
              }`}
            >
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("all")}
            className={`px-4 py-2 mr-2 rounded-full ${
              activeTab === "all" ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <Text
              className={`font-medium ${
                activeTab === "all" ? "text-white" : "text-gray-700"
              }`}
            >
              All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add Customer Button */}
        <TouchableOpacity
          onPress={toggleAddModal}
          className="flex-row items-center py-3"
        >
          <Text className="text-blue-600 text-base mr-2">👤</Text>
          <Text className="text-blue-600 font-medium">Add new customer</Text>
        </TouchableOpacity>
      </View>

      {/* Customer List */}
      <View className="flex-1">
        {customerStateData.loading && !refreshing ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-2">Loading customers...</Text>
          </View>
        ) : customerStateData.error ? (
          <View className="flex-1 justify-center items-center px-4">
            <Text className="text-6xl mb-4">⚠️</Text>
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              Something went wrong
            </Text>
            <Text className="text-gray-500 text-center mb-4">
              {customerStateData.error}
            </Text>
            <TouchableOpacity
              onPress={loadCustomers}
              className="bg-blue-600 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-medium">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            renderItem={renderCustomerItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center px-4 py-20">
                <Text className="text-6xl mb-4">👥</Text>
                <Text className="text-xl font-semibold text-gray-700 mb-2">
                  No customers yet
                </Text>
                <Text className="text-gray-500 text-center">
                  Add your first customer to get started with orders and billing
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Add Customer Modal */}
      <CustomerModal
        visible={customerStateData.showAddModal}
        onClose={toggleAddModal}
        onSuccess={loadCustomers}
      />

      {/* Edit Customer Modal */}
      {/* <CustomerModal
        visible={customerStateData.showEditModal}
        customer={customerStateData.selectedCustomer}
        onClose={toggleEditModal}
        onSuccess={loadCustomers}
      /> */}
    </SafeAreaView>
  );
}
