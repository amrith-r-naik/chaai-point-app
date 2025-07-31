import { getAllCustomers, searchCustomers } from "@/services/customerService";
import { orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { customerState } from "@/state/customerState";
import { use$ } from "@legendapp/state/react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CustomersScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "all">(
    "active"
  );
  const [refreshing, setRefreshing] = useState(false);
  const [dateGroups, setDateGroups] = useState<
    Record<
      string,
      {
        date: string;
        displayDate: string;
        customers: Record<
          string,
          {
            customer: any;
            totalAmount: number;
            orderCount: number;
            hasCompletedBilling: boolean;
            hasActiveOrders: boolean;
          }
        >;
      }
    >
  >({});
  const customerStateData = use$(customerState);
  const auth = use$(authState);
  const router = useRouter();

  const loadOrdersData = useCallback(async () => {
    try {
      if (!auth.isDbReady) return;

      const ordersGrouped = await orderService.getOrdersGroupedByDate();
      setDateGroups(ordersGrouped);
    } catch (error) {
      console.error("Error loading orders data:", error);
    }
  }, [auth.isDbReady]);

  const loadCustomers = useCallback(async () => {
    try {
      if (!auth.isDbReady) return;

      customerState.loading.set(true);
      customerState.error.set("");

      // Load customers and orders data in parallel
      const [customers] = await Promise.all([
        searchQuery.trim()
          ? searchCustomers(searchQuery.trim())
          : getAllCustomers(),
        loadOrdersData(),
      ]);

      customerState.customers.set(customers);
    } catch (error: any) {
      customerState.error.set(error.message || "Failed to load customers");
    } finally {
      customerState.loading.set(false);
    }
  }, [searchQuery, auth.isDbReady, loadOrdersData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCustomers(), loadOrdersData()]);
    setRefreshing(false);
  }, [loadCustomers, loadOrdersData]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (auth.isDbReady) {
        loadOrdersData();
      }
    }, [auth.isDbReady, loadOrdersData])
  );

  const handleAddCustomer = () => {
    customerState.selectedCustomer.set(null);
    router.push("/(modals)/customer-form");
  };

  // Check if EOD button should be shown for a specific date
  const shouldShowEOD = (dateString: string) => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // For older dates, always show EOD button
    if (dateString < today) {
      return true;
    }

    // For today, show only after 8 PM
    if (dateString === today) {
      return now.getHours() >= 20; // 8 PM = 20:00
    }

    // For future dates (shouldn't happen but just in case), don't show
    return false;
  };

  // Filter customers based on active tab and search
  const getFilteredData = () => {
    if (activeTab === "all") {
      // For "All" tab, show all customers regardless of orders
      return customerStateData.customers.filter((customer) => {
        if (searchQuery.trim()) {
          return (
            customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (customer.contact && customer.contact.includes(searchQuery))
          );
        }
        return true;
      });
    } else {
      // For "Active" and "Completed" tabs, use date groups
      const filtered: typeof dateGroups = {};

      Object.entries(dateGroups).forEach(([date, group]) => {
        const filteredCustomers: typeof group.customers = {};

        Object.entries(group.customers).forEach(
          ([customerId, customerData]) => {
            // Apply search filter
            if (searchQuery.trim()) {
              const matchesSearch =
                customerData.customer.name
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                (customerData.customer.contact &&
                  customerData.customer.contact.includes(searchQuery));
              if (!matchesSearch) return;
            }

            // Apply tab filter
            switch (activeTab) {
              case "active":
                if (customerData.hasActiveOrders) {
                  filteredCustomers[customerId] = customerData;
                }
                break;
              case "completed":
                if (customerData.hasCompletedBilling) {
                  filteredCustomers[customerId] = customerData;
                }
                break;
            }
          }
        );

        if (Object.keys(filteredCustomers).length > 0) {
          filtered[date] = {
            ...group,
            customers: filteredCustomers,
          };
        }
      });

      return filtered;
    }
  };

  const renderCustomerItem = (customerData: any) => {
    const customer = customerData.customer;
    const initials = customer.name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <View
        key={customer.id}
        className="flex-row items-center justify-between px-4 py-3"
      >
        {/* Customer Avatar and Info */}
        <View className="flex-row items-center flex-1">
          <View className="w-12 h-12 rounded-full bg-amber-600 items-center justify-center mr-3">
            <Text className="text-white font-semibold text-base">
              {initials}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-medium text-base">
              {customer.name}
            </Text>
            {customer.contact && (
              <Text className="text-gray-500 text-sm">{customer.contact}</Text>
            )}
          </View>
        </View>

        {/* Amount */}
        <Text className="text-gray-900 font-semibold text-lg">
          ₹{customerData.totalAmount.toFixed(0)}
        </Text>
      </View>
    );
  };

  const renderSimpleCustomerItem = (customer: any) => {
    const initials = customer.name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <View
        key={customer.id}
        className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100"
      >
        {/* Customer Avatar and Info */}
        <View className="flex-row items-center flex-1">
          <View className="w-12 h-12 rounded-full bg-amber-600 items-center justify-center mr-3">
            <Text className="text-white font-semibold text-base">
              {initials}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-medium text-base">
              {customer.name}
            </Text>
            {customer.contact && (
              <Text className="text-gray-500 text-sm">{customer.contact}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderDateSection = (date: string, group: any) => {
    const customers = Object.values(group.customers);

    return (
      <View key={date} className="mb-6">
        {/* Date Header with EOD Button */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-gray-50">
          <Text className="text-lg font-semibold text-gray-800">
            {group.displayDate}
          </Text>
          {shouldShowEOD(date) && (
            <TouchableOpacity className="bg-red-500 px-4 py-2 rounded-full">
              <Text className="text-white font-medium text-sm">EOD</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Customers for this date */}
        <View className="bg-white">
          {customers.map((customerData: any) =>
            renderCustomerItem(customerData)
          )}
        </View>
      </View>
    );
  };

  const filteredData = getFilteredData();
  const isAllTab = activeTab === "all";
  const filteredDateGroups = isAllTab
    ? {}
    : (filteredData as typeof dateGroups);
  const allCustomers = isAllTab ? (filteredData as any[]) : [];
  const sortedDates = isAllTab
    ? []
    : Object.keys(filteredDateGroups).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      );

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="px-4 py-3 bg-white border-b border-gray-200">
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
            onPress={() => setActiveTab("completed")}
            className={`px-4 py-2 mr-2 rounded-full ${
              activeTab === "completed" ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <Text
              className={`font-medium ${
                activeTab === "completed" ? "text-white" : "text-gray-700"
              }`}
            >
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("all")}
            className={`px-4 py-2 mr-2 rounded-full ${
              activeTab === "all" ? "bg-gray-600" : "bg-gray-200"
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

        {/* Add Customer Button - Only show in "all" tab */}
        {activeTab === "all" && (
          <TouchableOpacity
            onPress={handleAddCustomer}
            className="flex-row items-center py-3"
          >
            <Text className="text-blue-600 text-base mr-2">👤</Text>
            <Text className="text-blue-600 font-medium">Add new customer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
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
        ) : (isAllTab && allCustomers.length === 0) ||
          (!isAllTab && sortedDates.length === 0) ? (
          <View className="flex-1 justify-center items-center px-4 py-20">
            <Text className="text-6xl mb-4">👥</Text>
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              {activeTab === "all"
                ? "No customers yet"
                : `No ${activeTab} customers`}
            </Text>
            <Text className="text-gray-500 text-center">
              {activeTab === "all"
                ? "Add your first customer to get started with orders and billing"
                : `No customers found with ${activeTab} orders`}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#2563eb"]}
              />
            }
          >
            {isAllTab ? (
              // Render simple customer list for "All" tab
              <View className="bg-white">
                {allCustomers.map((customer) =>
                  renderSimpleCustomerItem(customer)
                )}
              </View>
            ) : (
              // Render date-grouped customers for "Active" and "Completed" tabs
              sortedDates.map((date) =>
                renderDateSection(date, filteredDateGroups[date])
              )
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
