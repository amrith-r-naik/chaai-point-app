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

interface Customer {
  id: string;
  name: string;
  contact: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerData {
  customer: Customer;
  totalAmount: number;
  orderCount: number;
  hasCompletedBilling: boolean;
  hasActiveOrders: boolean;
}

interface DateGroup {
  date: string;
  displayDate: string;
  customers: Record<string, CustomerData>;
}

type TabType = "active" | "completed" | "all";

export default function CustomersScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dateGroups, setDateGroups] = useState<Record<string, DateGroup>>({});
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

      // Show search indicator for search queries
      if (searchQuery.trim()) {
        setIsSearching(true);
      }

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
      setIsSearching(false);
    }
  }, [searchQuery, auth.isDbReady, loadOrdersData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCustomers(), loadOrdersData()]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadCustomers, loadOrdersData]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== "") {
        loadCustomers();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadCustomers]);

  useEffect(() => {
    if (searchQuery === "") {
      loadCustomers();
    }
  }, [searchQuery, loadCustomers]);

  // Initial load
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

  // Utility functions for better UX
  const getCustomerInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-cyan-500",
      "bg-lime-500",
      "bg-emerald-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  // Enhanced tab statistics function
  const getTabStats = (data: typeof dateGroups) => {
    const activeCustomers = new Set<string>();
    const completedCustomers = new Set<string>();
    const allCustomers = new Set<string>();

    let activeOrders = 0;
    let completedOrders = 0;
    let activeAmount = 0;
    let completedAmount = 0;

    Object.values(data).forEach((group) => {
      Object.values(group.customers).forEach((customerData) => {
        allCustomers.add(customerData.customer.id);

        if (customerData.hasCompletedBilling) {
          completedCustomers.add(customerData.customer.id);
          completedOrders += customerData.orderCount;
          completedAmount += customerData.totalAmount;
        } else {
          activeCustomers.add(customerData.customer.id);
          activeOrders += customerData.orderCount;
          activeAmount += customerData.totalAmount;
        }
      });
    });

    return {
      active: {
        customers: activeCustomers.size,
        orders: activeOrders,
        amount: activeAmount,
      },
      completed: {
        customers: completedCustomers.size,
        orders: completedOrders,
        amount: completedAmount,
      },
      all: {
        customers: allCustomers.size,
        orders: activeOrders + completedOrders,
        amount: activeAmount + completedAmount,
      },
    };
  };

  const tabStats = getTabStats(dateGroups);

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

  const renderCustomerItem = (customerData: CustomerData) => {
    const customer = customerData.customer;
    const initials = getCustomerInitials(customer.name);
    const avatarColor = getAvatarColor(customer.name);

    return (
      <TouchableOpacity
        key={customer.id}
        className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-50 active:bg-gray-50"
        activeOpacity={0.7}
      >
        {/* Customer Avatar and Info */}
        <View className="flex-row items-center flex-1">
          <View
            className={`w-14 h-14 rounded-full ${avatarColor} items-center justify-center mr-4 shadow-sm`}
          >
            <Text className="text-white font-bold text-base">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-semibold text-base mb-1">
              {customer.name}
            </Text>
            {customer.contact && (
              <Text className="text-gray-500 text-sm">{customer.contact}</Text>
            )}
            <Text className="text-gray-400 text-xs mt-1">
              {customerData.orderCount} order
              {customerData.orderCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Amount and Status */}
        <View className="items-end">
          <Text className="text-gray-900 font-bold text-lg mb-1">
            {formatCurrency(customerData.totalAmount)}
          </Text>
          <View
            className={`px-2 py-1 rounded-full ${
              customerData.hasCompletedBilling
                ? "bg-green-100"
                : "bg-orange-100"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                customerData.hasCompletedBilling
                  ? "text-green-700"
                  : "text-orange-700"
              }`}
            >
              {customerData.hasCompletedBilling ? "Paid" : "Pending"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSimpleCustomerItem = (customer: Customer) => {
    const initials = getCustomerInitials(customer.name);
    const avatarColor = getAvatarColor(customer.name);

    return (
      <TouchableOpacity
        key={customer.id}
        className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-50 active:bg-gray-50"
        activeOpacity={0.7}
      >
        {/* Customer Avatar and Info */}
        <View className="flex-row items-center flex-1">
          <View
            className={`w-10 h-10 rounded-full ${avatarColor} items-center justify-center mr-3 shadow-sm`}
          >
            <Text className="text-white font-semibold text-sm">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-medium text-base mb-0.5">
              {customer.name}
            </Text>
            {customer.contact && (
              <Text className="text-gray-500 text-xs">{customer.contact}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDateSection = (date: string, group: DateGroup) => {
    const customers = Object.values(group.customers);
    const totalAmount = customers.reduce(
      (sum, customerData) => sum + customerData.totalAmount,
      0
    );
    const totalOrders = customers.reduce(
      (sum, customerData) => sum + customerData.orderCount,
      0
    );

    return (
      <View
        key={date}
        className="mb-6 bg-white rounded-lg overflow-hidden shadow-sm"
      >
        {/* Date Header with Stats and EOD Button */}
        <View className="px-4 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-gray-900">
              {group.displayDate}
            </Text>
            {shouldShowEOD(date) && (
              <TouchableOpacity className="bg-red-500 px-4 py-2 rounded-full shadow-sm">
                <Text className="text-white font-semibold text-sm">EOD</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date Statistics */}
          <View className="flex-row items-center">
            <View className="bg-white px-3 py-1.5 rounded-full mr-2 shadow-sm">
              <Text className="text-gray-700 text-xs font-medium">
                {customers.length} customer{customers.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="bg-white px-3 py-1.5 rounded-full mr-2 shadow-sm">
              <Text className="text-gray-700 text-xs font-medium">
                {totalOrders} order{totalOrders !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="bg-white px-3 py-1.5 rounded-full shadow-sm">
              <Text className="text-gray-700 text-xs font-medium">
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Customers for this date */}
        <View>
          {customers.map((customerData: CustomerData) =>
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Enhanced Header */}
      <View className="bg-white shadow-sm">
        <View className="px-4 py-4">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-2xl font-bold text-gray-900">
                Customers
              </Text>
              <Text className="text-gray-500 text-sm mt-1">
                Manage your customer orders and billing
              </Text>
            </View>
            <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
              <Text className="text-gray-600 text-lg">⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Enhanced Search Bar */}
          <View className="relative mb-4">
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <Text className="text-gray-400 text-lg mr-3">🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="Search customers by name..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-base text-gray-900"
              />
              {isSearching && (
                <ActivityIndicator size="small" color="#6B7280" />
              )}
            </View>
          </View>

          {/* Enhanced Filter Tabs with Statistics */}
          <View className="flex-row mb-2">
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
              className="flex-row items-center justify-center py-3 mt-2 bg-indigo-50 rounded-xl border border-indigo-200"
            >
              <Text className="text-indigo-600 text-lg mr-2">👤</Text>
              <Text className="text-indigo-600 font-semibold">
                Add New Customer
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
