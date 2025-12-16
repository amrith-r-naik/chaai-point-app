import { useScreenPerformance } from "@/hooks/useScreenPerformance";
import {
  getAllCustomers,
  getCustomersSummary,
  searchCustomers,
} from "@/services/customerService";
import { orderService } from "@/services/orderService";
import { paymentService } from "@/services/paymentService";
import { appEvents } from "@/state/appEvents";
import { authState } from "@/state/authState";
import { customerState } from "@/state/customerState";
import { use$ } from "@legendapp/state/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// (type removed) unused Customer interface

// (type removed) unused CustomerData interface

// (types removed) Unused interfaces DateGroup and CompletedBillGroup

type TabType = "active" | "completed" | "all";

// Utility functions moved outside component
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

// Memoized customer item for FlatList virtualization
const CustomerListItem = memo(function CustomerListItem({
  customer,
  onPress,
}: {
  customer: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-white mb-3 px-4 py-3 rounded-lg shadow-sm"
      activeOpacity={0.7}
    >
      <View
        className={`w-10 h-10 rounded-full ${getAvatarColor(customer.name)} items-center justify-center mr-3`}
      >
        <Text className="text-white font-bold text-sm">
          {getCustomerInitials(customer.name)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-semibold text-base">
          {customer.name}
        </Text>
        {customer.contact && (
          <Text className="text-gray-500 text-xs">{customer.contact}</Text>
        )}
        <Text className="text-gray-400 text-xs mt-1">
          {customer.billCount} bill{customer.billCount === 1 ? "" : "s"} •{" "}
          {formatCurrency(customer.totalBilled || 0)}
        </Text>
      </View>
      {customer.creditBalance > 0 && (
        <View className="items-end">
          <Text className="text-orange-600 font-semibold text-xs">
            CR {formatCurrency(customer.creditBalance)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Memoized completed bill item for SectionList virtualization
const CompletedBillItem = memo(function CompletedBillItem({
  bill,
  onPress,
}: {
  bill: any;
  onPress: () => void;
}) {
  const isPureCredit =
    bill.status === "Credit" &&
    (bill.paidTotal === 0 || bill.paidTotal == null);
  const isClearance = bill.status === "Clearance";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isPureCredit}
      className={`flex-row items-center justify-between px-4 py-4 bg-white border border-gray-100 rounded-xl mb-3 mx-4 ${isPureCredit ? "" : "active:bg-gray-50"}`}
      activeOpacity={0.65}
    >
      {/* Customer Avatar and Info */}
      <View className="flex-row items-center flex-1">
        <View
          className={`w-14 h-14 rounded-full ${getAvatarColor(bill.customerName)} items-center justify-center mr-4 shadow-sm`}
        >
          <Text className="text-white font-bold text-base">
            {getCustomerInitials(bill.customerName)}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            {isPureCredit && (
              <Lock size={14} color="#b45309" style={{ marginRight: 4 }} />
            )}
            <Text className="text-gray-900 font-semibold text-base">
              {bill.customerName}
            </Text>
          </View>
          {bill.customerContact && (
            <Text className="text-gray-500 text-sm">
              {bill.customerContact}
            </Text>
          )}
          <Text className="text-gray-400 text-xs mt-1">
            {isClearance
              ? `Receipt #${bill.receiptNo || "—"} • Credit Clearance`
              : `Bill #${bill.billNumber || "—"} ${bill.status ? `• ${bill.status}` : ""}`}
          </Text>
          {bill.status === "Partial" && (
            <View className="flex-row mt-2 items-center">
              {bill.paidTotal > 0 && (
                <View className="mr-2 px-2 py-0.5 rounded-full bg-green-100">
                  <Text className="text-[10px] text-green-700 font-semibold">
                    Paid ₹{bill.paidTotal}
                  </Text>
                </View>
              )}
              {bill.creditPortion > 0 && (
                <View className="px-2 py-0.5 rounded-full bg-orange-100">
                  <Text className="text-[10px] text-orange-700 font-semibold">
                    Cr ₹{bill.creditPortion}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Amount and Status */}
      <View className="items-end">
        <Text className="text-gray-900 font-bold text-lg mb-1">
          {formatCurrency((bill.total ?? bill.amount) || 0)}
        </Text>
        {isClearance ? (
          <View className="px-2 py-1 rounded-full bg-blue-100">
            <Text className="text-xs font-medium text-blue-700">
              Credit Clearance
            </Text>
          </View>
        ) : bill.status === "Paid" ? (
          <View className="px-2 py-1 rounded-full bg-green-100">
            <Text className="text-xs font-medium text-green-700">Paid</Text>
          </View>
        ) : bill.status === "Partial" ? (
          <View className="px-2 py-1 rounded-full bg-orange-100">
            <Text className="text-xs font-medium text-orange-700">Partial</Text>
          </View>
        ) : bill.status === "Credit" ? (
          <View className="px-2 py-1 rounded-full bg-orange-100">
            <Text className="text-xs font-medium text-orange-700">Credit</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default function CustomersScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dateGroups, setDateGroups] = useState<any>({});
  const [completedBills, setCompletedBills] = useState<any>({});
  const [allSummaries, setAllSummaries] = useState<any[]>([]);
  const [isProcessingEOD, setIsProcessingEOD] = useState(false);
  const customerStateData = use$(customerState);
  const auth = use$(authState);
  const router = useRouter();
  const ev = use$(appEvents);

  // Track screen performance
  useScreenPerformance("Customers");

  // Initialize/Update active tab from route param when present
  useEffect(() => {
    if (tab && ["active", "completed", "all"].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [tab]);

  const loadOrdersData = useCallback(async () => {
    try {
      if (!auth.isDbReady) return;

      const ordersGrouped = await orderService.getOrdersGroupedByDate();
      setDateGroups(ordersGrouped);
    } catch (error) {
      console.error("Error loading orders data:", error);
    }
  }, [auth.isDbReady]);

  const loadCompletedBillsData = useCallback(async () => {
    try {
      if (!auth.isDbReady) return;

      const billsGrouped = await paymentService.getBillsGroupedByDate();
      setCompletedBills(billsGrouped);
    } catch (error) {
      console.error("Error loading completed bills data:", error);
    }
  }, [auth.isDbReady]);

  const loadCustomersWithStats = useCallback(async () => {
    try {
      if (!auth.isDbReady) return [];
      // Minimal summary: bills & credit only (orders detail removed for performance)
      const summaries = await getCustomersSummary();
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return summaries.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.contact && c.contact.includes(q))
        );
      }
      return summaries;
    } catch (e) {
      console.error("Error loading customer summaries:", e);
      return [];
    }
  }, [searchQuery, auth.isDbReady]);

  const loadCustomers = useCallback(async () => {
    try {
      if (!auth.isDbReady) return;

      customerState.loading.set(true);
      customerState.error.set("");

      // Show search indicator for search queries
      if (searchQuery.trim()) {
        setIsSearching(true);
      }

      // For "All" tab, load customers with payment statistics
      if (activeTab === "all") {
        const customersWithStats = await loadCustomersWithStats();
        setAllSummaries(customersWithStats);
      } else {
        // Load customers and orders data in parallel for other tabs
        const [customers] = await Promise.all([
          searchQuery.trim()
            ? searchCustomers(searchQuery.trim())
            : getAllCustomers(),
          loadOrdersData(),
          loadCompletedBillsData(),
        ]);

        customerState.customers.set(customers);
      }
    } catch (error: any) {
      customerState.error.set(error.message || "Failed to load customers");
    } finally {
      customerState.loading.set(false);
      setIsSearching(false);
    }
  }, [
    searchQuery,
    auth.isDbReady,
    activeTab,
    loadOrdersData,
    loadCompletedBillsData,
    loadCustomersWithStats,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "all") {
        await loadCustomers();
      } else {
        await Promise.all([
          loadCustomers(),
          loadOrdersData(),
          loadCompletedBillsData(),
        ]);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadCustomers, loadOrdersData, loadCompletedBillsData, activeTab]);

  const handleEOD = useCallback(
    async (dateString: string) => {
      try {
        setIsProcessingEOD(true);

        // Show confirmation dialog
        Alert.alert(
          "End of Day Process",
          `Are you sure you want to process EOD for ${dateString}? This will convert all active KOTs to credit payments.`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsProcessingEOD(false),
            },
            {
              text: "Confirm",
              style: "destructive",
              onPress: async () => {
                try {
                  // Process EOD
                  const result = await orderService.processEndOfDay(dateString);

                  if (result.processedKOTs > 0) {
                    // Run database maintenance after EOD (ANALYZE + WAL checkpoint)
                    try {
                      const { analyzeDatabase, walCheckpoint } = await import(
                        "@/lib/db"
                      );
                      await analyzeDatabase();
                      await walCheckpoint("TRUNCATE");
                      console.log("✅ Post-EOD database maintenance complete");
                    } catch (maintenanceError) {
                      console.warn(
                        "Post-EOD maintenance failed (non-critical):",
                        maintenanceError
                      );
                    }

                    Alert.alert(
                      "EOD Completed",
                      `Successfully processed ${result.processedKOTs} KOTs as credit payments.\nTotal Amount: ₹${result.totalAmount.toFixed(2)}`,
                      [{ text: "OK" }]
                    );

                    // Refresh data to reflect changes
                    await handleRefresh();
                  } else {
                    Alert.alert(
                      "No Active KOTs",
                      "No active KOTs found for EOD processing.",
                      [{ text: "OK" }]
                    );
                  }
                } catch (error) {
                  console.error("Error processing EOD:", error);
                  Alert.alert(
                    "Error",
                    "Failed to process EOD. Please try again.",
                    [{ text: "OK" }]
                  );
                } finally {
                  setIsProcessingEOD(false);
                }
              },
            },
          ]
        );
      } catch (error) {
        console.error("Error in handleEOD:", error);
        setIsProcessingEOD(false);
      }
    },
    [handleRefresh]
  );

  // Check if it's time for automatic EOD (11:30 PM IST)
  const checkAutoEOD = useCallback(async () => {
    try {
      const now = new Date();
      const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // Convert to IST
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();

      // Check if it's 11:30 PM IST
      if (hours === 23 && minutes === 30) {
        const today = istTime.toISOString().split("T")[0];

        // Check if EOD was already processed today
        const eodKey = `eod_processed_${today}`;
        const alreadyProcessed = await AsyncStorage.getItem(eodKey);

        if (!alreadyProcessed) {
          // Auto-process EOD without confirmation at 11:30 PM
          const result = await orderService.processEndOfDay(today);

          if (result.processedKOTs > 0) {
            await AsyncStorage.setItem(eodKey, "true");

            // Show notification that auto-EOD was processed
            Alert.alert(
              "Auto EOD Completed",
              `Automatic EOD processed ${result.processedKOTs} KOTs as credit payments.\nTotal: ₹${result.totalAmount.toFixed(2)}`,
              [{ text: "OK" }]
            );

            // Refresh data
            await handleRefresh();
          }
        }
      }
    } catch (error) {
      console.error("Error in auto EOD check:", error);
    }
  }, [handleRefresh]);

  // Set up automatic EOD check - optimized to check less frequently
  useEffect(() => {
    const checkAutoEODOptimized = async () => {
      const now = new Date();
      const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // Convert to IST
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();

      // Only run the actual check if we're close to 11:30 PM
      if (hours === 23 && minutes >= 25 && minutes <= 35) {
        await checkAutoEOD();
      }
    };

    // Check every 5 minutes for better performance
    const interval = setInterval(checkAutoEODOptimized, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAutoEOD]);

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

  // Initial load and tab change
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers, activeTab]);

  // Auto-refresh when key data changes (orders/bills/payments/customers)
  useEffect(() => {
    if (auth.isDbReady) {
      loadCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ev.ordersVersion,
    ev.billsVersion,
    ev.paymentsVersion,
    ev.customersVersion,
    ev.anyVersion,
    auth.isDbReady,
    activeTab,
  ]);

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

  // const tabStats = getTabStats(dateGroups); // currently unused

  // Check if EOD button should be shown for a specific date
  const shouldShowEOD = (dateString: string) => {
    const today = new Date().toISOString().split("T")[0];

    // For older dates, always show EOD button
    if (dateString < today) {
      return true;
    }

    // For today, always show EOD button (manual processing available anytime)
    if (dateString === today) {
      return true;
    }

    // For future dates (shouldn't happen but just in case), don't show
    return false;
  };

  // Filter customers based on active tab and search
  const getFilteredData = () => {
    if (activeTab === "completed") {
      // For completed tab, return completed bills data
      const filtered: any = {};

      Object.entries(completedBills).forEach(([date, group]: [string, any]) => {
        const filteredBills = (group.bills || []).filter((bill: any) => {
          if (searchQuery.trim()) {
            return (
              bill.customerName
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              (bill.customerContact &&
                bill.customerContact.includes(searchQuery)) ||
              (bill.receiptNo &&
                bill.receiptNo.toString().includes(searchQuery))
            );
          }
          return true;
        });

        if (filteredBills.length > 0) {
          filtered[date] = {
            ...group,
            bills: filteredBills,
          };
        }
      });

      return filtered;
    }

    if (activeTab === "all") {
      // For "All" tab, show all customers regardless of orders
      return customerStateData.customers.filter((customer: any) => {
        if (searchQuery.trim()) {
          return (
            customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (customer.contact && customer.contact.includes(searchQuery))
          );
        }
        return true;
      });
    } else {
      // For "Active" tab, use date groups
      const filtered: any = {};

      Object.entries(dateGroups).forEach(([date, group]: [string, any]) => {
        const filteredCustomers: any = {};

        Object.entries(group.customers || {}).forEach(
          ([customerId, customerData]: [string, any]) => {
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

            // Apply tab filter for active
            if (activeTab === "active" && customerData.hasActiveOrders) {
              filteredCustomers[customerId] = customerData;
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

  const renderDateSection = (date: string, group: any) => {
    const customers = Object.values(group.customers || {});
    const totalAmount = customers.reduce(
      (sum: number, customerData: any) =>
        sum +
        (activeTab === "active"
          ? customerData.activeAmount
          : activeTab === "completed"
            ? customerData.completedAmount
            : customerData.totalAmount),
      0
    );
    const totalOrders = customers.reduce(
      (sum: number, customerData: any) =>
        sum +
        (activeTab === "active"
          ? customerData.activeOrderCount
          : activeTab === "completed"
            ? customerData.completedOrderCount
            : customerData.orderCount),
      0
    );

    return (
      <View
        key={`active-date-${date}`}
        className="mb-6 bg-white rounded-lg overflow-hidden shadow-sm"
      >
        {/* Date Header with Stats and EOD Button */}
        <View className="px-4 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-gray-900">
              {group.displayDate}
            </Text>
            <View className="flex-row items-center">
              {shouldShowEOD(group.date) && (
                <TouchableOpacity
                  className={`px-4 py-2 rounded-full shadow-sm mr-2 ${isProcessingEOD ? "bg-gray-400" : "bg-red-500"}`}
                  onPress={() => handleEOD(group.date)}
                  disabled={isProcessingEOD}
                >
                  <Text className="text-white font-semibold text-sm">
                    {isProcessingEOD ? "Processing..." : "EOD"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Show auto-EOD indicator for today */}
              {group.date === new Date().toISOString().split("T")[0] && (
                <View className="px-3 py-1 rounded-full bg-blue-100 border border-blue-300">
                  <Text className="text-blue-700 text-xs font-medium">
                    Auto-EOD: 11:30 PM
                  </Text>
                </View>
              )}
            </View>
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
          {customers.map((customerData: any, index) => (
            <TouchableOpacity
              key={`customer-${customerData.customer.id}-${index}`}
              onPress={() => {
                customerState.selectedCustomer.set({
                  ...customerData.customer,
                  contact: customerData.customer.contact || undefined,
                });
                router.push("/(modals)/customer-kots");
              }}
              className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-50 active:bg-gray-50"
              activeOpacity={0.7}
            >
              {/* Customer Avatar and Info */}
              <View className="flex-row items-center flex-1">
                <View
                  className={`w-14 h-14 rounded-full ${getAvatarColor(customerData.customer.name)} items-center justify-center mr-4 shadow-sm`}
                >
                  <Text className="text-white font-bold text-base">
                    {getCustomerInitials(customerData.customer.name)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold text-base mb-1">
                    {customerData.customer.name}
                  </Text>
                  {customerData.customer.contact && (
                    <Text className="text-gray-500 text-sm">
                      {customerData.customer.contact}
                    </Text>
                  )}
                  <Text className="text-gray-400 text-xs mt-1">
                    {activeTab === "active"
                      ? customerData.activeOrderCount
                      : activeTab === "completed"
                        ? customerData.completedOrderCount
                        : customerData.orderCount}{" "}
                    order
                    {(activeTab === "active"
                      ? customerData.activeOrderCount
                      : activeTab === "completed"
                        ? customerData.completedOrderCount
                        : customerData.orderCount) !== 1
                      ? "s"
                      : ""}
                  </Text>
                </View>
              </View>

              {/* Amount and Status */}
              <View className="items-end">
                <Text className="text-gray-900 font-bold text-lg mb-1">
                  {formatCurrency(
                    activeTab === "active"
                      ? customerData.activeAmount
                      : activeTab === "completed"
                        ? customerData.completedAmount
                        : customerData.totalAmount
                  )}
                </Text>
                <View
                  className={`px-2 py-1 rounded-full ${
                    activeTab === "active"
                      ? "bg-orange-100" // Always orange for active tab
                      : customerData.hasCompletedBilling
                        ? customerData.isPaidCustomer
                          ? "bg-green-100"
                          : "bg-orange-100"
                        : "bg-orange-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      activeTab === "active"
                        ? "text-orange-700" // Always orange text for active tab
                        : customerData.hasCompletedBilling
                          ? customerData.isPaidCustomer
                            ? "text-green-700"
                            : "text-orange-700"
                          : "text-orange-700"
                    }`}
                  >
                    {activeTab === "active"
                      ? "Pending"
                      : customerData.hasCompletedBilling
                        ? customerData.isPaidCustomer
                          ? "Paid"
                          : "Pending"
                        : "Pending"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCompletedBillDateSection = (date: string, group: any) => {
    const bills = group.bills || [];
    // Revenue-style total for the day: exclude pure credit (accrual) amounts
    // - Clearance: add receipt amount
    // - Paid: add full bill total
    // - Partial: add only paid portion
    // - Credit (pure accrual): add 0
    const totalAmount = bills.reduce((sum: number, bill: any) => {
      if (bill.status === "Clearance")
        return sum + (bill.amount || bill.total || 0);
      if (bill.status === "Paid") return sum + (bill.total || 0);
      if (bill.status === "Partial") return sum + (bill.paidTotal || 0);
      // 'Credit' or unknown
      return sum;
    }, 0);

    return (
      <View
        key={`completed-date-${date} w-full`}
        className="mb-6 bg-white rounded-lg overflow-hidden shadow-sm"
      >
        {/* Date Header with Stats */}
        <View className="px-4 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-gray-900">
              {group.displayDate}
            </Text>
          </View>

          {/* Date Statistics */}
          <View className="flex-row items-center">
            <View className="bg-white px-3 py-1.5 rounded-full mr-2 shadow-sm">
              <Text className="text-gray-700 text-xs font-medium">
                {bills.length} bill{bills.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="bg-white px-3 py-1.5 rounded-full shadow-sm">
              <Text className="text-gray-700 text-xs font-medium">
                {formatCurrency(totalAmount)} total
              </Text>
            </View>
          </View>
        </View>

        {/* Bills for this date */}
        <View className="w-full pb-6">
          {bills
            .slice()
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .map((bill: any, index: number) => {
              const isPureCredit =
                bill.status === "Credit" &&
                (bill.paidTotal === 0 || bill.paidTotal == null);
              const isClearance = bill.status === "Clearance";
              const handlePress = () => {
                if (isPureCredit) return; // no navigation
                router.push({
                  pathname: "/(modals)/receipt-details",
                  params: { receiptId: bill.receiptId || bill.id },
                });
              };
              return (
                <TouchableOpacity
                  key={`bill-${bill.id}-${index}`}
                  onPress={handlePress}
                  disabled={isPureCredit}
                  className={`flex-row items-center justify-between px-4 py-4 bg-white border border-gray-100 rounded-xl mb-3 ${isPureCredit ? "" : "active:bg-gray-50"}`}
                  activeOpacity={0.65}
                >
                  {/* Customer Avatar and Info */}
                  <View className="flex-row items-center flex-1">
                    <View
                      className={`w-14 h-14 rounded-full ${getAvatarColor(bill.customerName)} items-center justify-center mr-4 shadow-sm`}
                    >
                      <Text className="text-white font-bold text-base">
                        {getCustomerInitials(bill.customerName)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center mb-1">
                        {isPureCredit && (
                          <Lock
                            size={14}
                            color="#b45309"
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text className="text-gray-900 font-semibold text-base">
                          {bill.customerName}
                        </Text>
                      </View>
                      {bill.customerContact && (
                        <Text className="text-gray-500 text-sm">
                          {bill.customerContact}
                        </Text>
                      )}
                      <Text className="text-gray-400 text-xs mt-1">
                        {isClearance
                          ? `Receipt #${bill.receiptNo || "—"} • Credit Clearance`
                          : `Bill #${bill.billNumber || "—"} ${bill.status ? `• ${bill.status}` : ""}`}
                      </Text>
                      {bill.status === "Partial" && (
                        <View className="flex-row mt-2 items-center">
                          {bill.paidTotal > 0 && (
                            <View className="mr-2 px-2 py-0.5 rounded-full bg-green-100">
                              <Text className="text-[10px] text-green-700 font-semibold">
                                Paid ₹{bill.paidTotal}
                              </Text>
                            </View>
                          )}
                          {bill.creditPortion > 0 && (
                            <View className="px-2 py-0.5 rounded-full bg-orange-100">
                              <Text className="text-[10px] text-orange-700 font-semibold">
                                Cr ₹{bill.creditPortion}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Amount and Status */}
                  <View className="items-end">
                    <Text className="text-gray-900 font-bold text-lg mb-1">
                      {formatCurrency((bill.total ?? bill.amount) || 0)}
                    </Text>
                    {isClearance ? (
                      <View className="px-2 py-1 rounded-full bg-blue-100">
                        <Text className="text-xs font-medium text-blue-700">
                          Credit Clearance
                        </Text>
                      </View>
                    ) : (
                      bill.status === "Paid" && (
                        <View className="px-2 py-1 rounded-full bg-green-100">
                          <Text className="text-xs font-medium text-green-700">
                            Paid
                          </Text>
                        </View>
                      )
                    )}
                    {bill.status === "Partial" && (
                      <View className="px-2 py-1 rounded-full bg-orange-100">
                        <Text className="text-xs font-medium text-orange-700">
                          Partial
                        </Text>
                      </View>
                    )}
                    {bill.status === "Credit" && (
                      <View className="px-2 py-1 rounded-full bg-orange-100">
                        <Text className="text-xs font-medium text-orange-700">
                          Credit
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

          {/* Spacer to ensure end-of-day separation visually */}
          <View className="mt-2" />
        </View>
      </View>
    );
  };

  const filteredData = getFilteredData();
  const isAllTab = activeTab === "all";
  const isCompletedTab = activeTab === "completed";
  const filteredDateGroups =
    isAllTab || isCompletedTab ? {} : (filteredData as any);
  const allCustomers = isAllTab ? allSummaries : [];
  const completedBillGroups = isCompletedTab ? (filteredData as any) : {};
  const sortedDates = isAllTab
    ? []
    : Object.keys(
        isCompletedTab ? completedBillGroups : filteredDateGroups
      ).sort(
        (a, b) =>
          new Date(b.split("-")[0]).getTime() -
          new Date(a.split("-")[0]).getTime()
      );

  // Prepare section data for completed bills SectionList
  const completedBillSections = useMemo(() => {
    if (!isCompletedTab) return [];
    return sortedDates.map((date) => {
      const group = completedBillGroups[date];
      const bills = (group?.bills || [])
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const totalAmount = bills.reduce((sum: number, bill: any) => {
        if (bill.status === "Clearance")
          return sum + (bill.amount || bill.total || 0);
        if (bill.status === "Paid") return sum + (bill.total || 0);
        if (bill.status === "Partial") return sum + (bill.paidTotal || 0);
        return sum;
      }, 0);
      return {
        date,
        displayDate: group?.displayDate || date,
        billCount: bills.length,
        totalAmount,
        data: bills,
      };
    });
  }, [isCompletedTab, sortedDates, completedBillGroups]);

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

          {activeTab === "all" && (
            <TouchableOpacity
              onPress={handleAddCustomer}
              className="flex-row items-center justify-center py-3 mt-2 bg-indigo-50 rounded-xl border border-indigo-200"
            >
              <Text className="text-indigo-600 font-semibold">
                Add Customer
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
        ) : isAllTab ? (
          // Use FlatList for "All" customers tab (virtualized for performance)
          <FlatList
            data={allCustomers}
            keyExtractor={(item, index) => `cust-${item.id}-${index}`}
            renderItem={({ item }) => (
              <CustomerListItem
                customer={item}
                onPress={() =>
                  router.push({
                    pathname: "/customer-details",
                    params: {
                      customerId: item.id,
                      customerName: item.name,
                    },
                  })
                }
              />
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#2563eb"]}
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 96,
            }}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            getItemLayout={(data, index) => ({
              length: 76, // Approximate height of each item
              offset: 76 * index,
              index,
            })}
          />
        ) : isCompletedTab ? (
          // Use SectionList for completed bills (virtualized with date sections)
          <SectionList
            sections={completedBillSections}
            keyExtractor={(item, index) => `bill-${item.id}-${index}`}
            renderItem={({ item }) => (
              <CompletedBillItem
                bill={item}
                onPress={() => {
                  const isPureCredit =
                    item.status === "Credit" &&
                    (item.paidTotal === 0 || item.paidTotal == null);
                  if (!isPureCredit) {
                    router.push({
                      pathname: "/(modals)/receipt-details",
                      params: { receiptId: item.receiptId || item.id },
                    });
                  }
                }}
              />
            )}
            renderSectionHeader={({ section }) => (
              <View className="px-4 py-4 bg-gradient-to-r from-green-50 to-emerald-50 mb-3 rounded-lg mx-4 mt-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-lg font-bold text-gray-900">
                    {section.displayDate}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="bg-white px-3 py-1.5 rounded-full mr-2 shadow-sm">
                    <Text className="text-gray-700 text-xs font-medium">
                      {section.billCount} bill
                      {section.billCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View className="bg-white px-3 py-1.5 rounded-full shadow-sm">
                    <Text className="text-gray-700 text-xs font-medium">
                      {formatCurrency(section.totalAmount)} total
                    </Text>
                  </View>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#2563eb"]}
              />
            }
            contentContainerStyle={{ paddingBottom: 96 }}
            stickySectionHeadersEnabled={false}
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
          />
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
            contentContainerStyle={{ paddingBottom: 96 }}
          >
            {/* Render active customers grouped by date */}
            <View className="px-4 pt-4">
              {sortedDates.map((date, index) =>
                renderDateSection(`${date}-${index}`, filteredDateGroups[date])
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
