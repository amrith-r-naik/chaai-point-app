import { theme } from "@/constants/theme";
import { creditService } from "@/services/creditService";
import { orderService } from "@/services/orderService";
import { paymentService } from "@/services/paymentService";
import { authState } from "@/state/authState";
import { useCreditRefreshTrigger } from "@/state/creditState";
import { use$ } from "@legendapp/state/react";
import { router, useLocalSearchParams } from "expo-router";
import {
    ArrowLeft,
    Calendar,
    CreditCard,
    DollarSign,
    History,
    Plus,
    Receipt,
    TrendingDown,
    TrendingUp,
    Wallet
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface CustomerOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'credit' | 'pending';
  createdAt: string;
  items: {
    id: string;
    menuItemName: string;
    quantity: number;
    price: number;
    total: number;
  }[];
}

interface CustomerStats {
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  paidOrders: number;
  creditOrders: number;
  pendingOrders: number;
  pendingAmount: number;
  creditBalance: number;
}

export default function CustomerDetailsScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
  }>();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<CustomerOrder[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'paid' | 'credit'>('all');
  const auth = use$(authState);
  const creditRefreshTrigger = useCreditRefreshTrigger(); // Listen for credit updates

  const loadCustomerData = useCallback(async () => {
    if (!customerId || !auth.isDbReady) return;

    try {
      setLoading(true);

      // Load order history
      const customerOrders = await orderService.getOrdersByCustomerId(customerId);
      setOrders(customerOrders);

      // Calculate stats
      let totalOrders = customerOrders.length;
      let totalAmount = 0;
      let paidAmount = 0;
      let creditAmount = 0;
      let paidOrders = 0;
      let creditOrders = 0;
      let pendingOrders = 0;
      let pendingAmount = 0;

      customerOrders.forEach(order => {
        totalAmount += order.totalAmount;

        if (order.paymentStatus === 'paid') {
          paidAmount += order.totalAmount;
          paidOrders++;
        } else if (order.paymentStatus === 'credit') {
          creditAmount += order.totalAmount;
          creditOrders++;
        } else if (order.paymentStatus === 'pending') {
          pendingAmount += order.totalAmount;
          pendingOrders++;
        }
      });

      // Get customer credit balance
      const creditBalance = await paymentService.getCustomerCreditBalance(customerId);

      const customerStats: CustomerStats = {
        totalOrders,
        totalAmount,
        paidAmount,
        creditAmount,
        paidOrders,
        creditOrders,
        pendingOrders,
        pendingAmount,
        creditBalance,
      };

      setStats(customerStats);
    } catch (error) {
      console.error("Error loading customer data:", error);
      Alert.alert("Error", "Failed to load customer data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId, auth.isDbReady]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Listen for credit refresh triggers and reload data
  useEffect(() => {
    if (creditRefreshTrigger > 0 && customerId && auth.isDbReady) {
      loadCustomerData();
    }
  }, [creditRefreshTrigger, customerId, auth.isDbReady, loadCustomerData]);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedFilter]);

  const filterOrders = () => {
    switch (selectedFilter) {
      case 'paid':
        setFilteredOrders(orders.filter(order => order.paymentStatus === 'paid'));
        break;
      case 'credit':
        setFilteredOrders(orders.filter(order => order.paymentStatus === 'credit'));
        break;
      default:
        setFilteredOrders(orders);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomerData();
  };

  const handleCreditClearance = () => {
    if (!stats || stats.creditBalance <= 0) {
      Alert.alert("No Credit", "This customer has no outstanding credit balance.");
      return;
    }

    Alert.alert(
      "Clear Credit Balance",
      `Are you sure you want to clear the credit balance of ₹${stats.creditBalance.toFixed(2)} for ${customerName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Credit",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              
              // Process credit clearance using new unified flow
              await creditService.collectCredit({
                customerId,
                amount: stats.creditBalance,
                paymentComponents: [{
                  type: 'Cash',
                  amount: stats.creditBalance
                }],
                remarks: 'Credit balance clearance'
              });

              Alert.alert("Success", "Credit balance cleared successfully!");
              // The global state will be automatically updated by creditService
              // Customer data will refresh via useEffect listening to creditRefreshTrigger
            } catch (error: any) {
              console.error("Error clearing credit:", error);
              Alert.alert("Error", error.message || "Failed to clear credit balance");
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateOrder = () => {
    router.push({
      pathname: "/(modals)/create-order",
      params: {
        customerId,
        customerName,
      }
    });
  };

  const handleOrderPress = (order: CustomerOrder) => {
    router.push({
      pathname: "/(modals)/order-details",
      params: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' };
      case 'credit':
        return { bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
      case 'pending':
        return { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'credit':
        return 'Credit';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const getCustomerInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderOrderItem = ({ item }: { item: CustomerOrder }) => {
    const statusStyle = getStatusColor(item.paymentStatus);
    return (
      <TouchableOpacity
        onPress={() => handleOrderPress(item)}
        style={{
          backgroundColor: theme.colors.background,
          marginHorizontal: 16,
          marginVertical: 6,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: theme.colors.border,
          ...theme.shadows.sm,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.colors.text,
                marginBottom: 4,
              }}
            >
              {item.orderNumber}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Calendar size={14} color={theme.colors.textSecondary} />
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginLeft: 4,
                }}
              >
                {formatDate(item.createdAt)}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginBottom: 8,
              }}
            >
              {item.items.length} item(s)
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: theme.colors.primary,
                }}
              >
                {formatCurrency(item.totalAmount)}
              </Text>

              <View
                style={{
                  backgroundColor: statusStyle.bg,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: statusStyle.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: statusStyle.text,
                  }}
                >
                  {getStatusText(item.paymentStatus)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FilterButton = ({ filter, label, icon: Icon }: { filter: typeof selectedFilter, label: string, icon: any }) => (
    <TouchableOpacity
      onPress={() => setSelectedFilter(filter)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: selectedFilter === filter ? theme.colors.primary : "#f3f4f6",
        borderWidth: 1,
        borderColor: selectedFilter === filter ? theme.colors.primary : "#e5e7eb",
        flexDirection: "row",
        alignItems: "center",
        marginRight: 8,
      }}
    >
      <Icon size={14} color={selectedFilter === filter ? "white" : theme.colors.text} />
      <Text
        style={{
          fontSize: 14,
          fontWeight: selectedFilter === filter ? "600" : "400",
          color: selectedFilter === filter ? "white" : theme.colors.text,
          marginLeft: 4,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading customer details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingTop: 20,
            paddingBottom: 40,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 8,
                marginRight: 8,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            >
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontWeight: "bold",
                }}
              >
                {customerName}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                  marginTop: 2,
                }}
              >
                {filteredOrders.length} order(s) {selectedFilter !== 'all' ? `(${selectedFilter})` : ''}
              </Text>
            </View>
          </View>

          {/* Customer Avatar */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "rgba(255,255,255,0.2)",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
              borderWidth: 3,
              borderColor: "rgba(255,255,255,0.3)",
            }}>
              <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
                {getCustomerInitials(customerName || "Unknown")}
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
              onPress={handleCreateOrder}
            >
              <Plus size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600" }}>New Order</Text>
            </TouchableOpacity>

            {stats && stats.creditBalance > 0 && (
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={handleCreditClearance}
              >
                <CreditCard size={20} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>Clear Credit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Cards */}
        <View style={{ paddingHorizontal: 20, marginTop: -20 }}>
          {/* Credit Balance Alert */}
          {stats && stats.creditBalance > 0 && (
            <View style={{
              backgroundColor: "#fef3c7",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderLeftWidth: 4,
              borderLeftColor: "#d97706",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Wallet size={24} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#92400e", fontWeight: "700", fontSize: 16 }}>
                    Outstanding Credit
                  </Text>
                  <Text style={{ color: "#d97706", fontSize: 24, fontWeight: "bold" }}>
                    {formatCurrency(stats.creditBalance)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCreditClearance}
                  style={{
                    backgroundColor: "#d97706",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Overview Stats */}
          <View style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16, color: theme.colors.text }}>
              Overview
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                  Total Orders
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.text }}>
                  {stats?.totalOrders || 0}
                </Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                  Total Value
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.text }}>
                  {formatCurrency(stats?.totalAmount || 0)}
                </Text>
              </View>
            </View>

            {/* Payment Breakdown */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{
                flex: 1,
                backgroundColor: "#dcfce7",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#bbf7d0",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <TrendingUp size={16} color="#16a34a" />
                  <Text style={{ color: "#16a34a", fontSize: 12, fontWeight: "600" }}>
                    Paid
                  </Text>
                </View>
                <Text style={{ color: "#15803d", fontSize: 16, fontWeight: "bold" }}>
                  {stats?.paidOrders || 0} orders
                </Text>
                <Text style={{ color: "#16a34a", fontSize: 14, fontWeight: "600" }}>
                  {formatCurrency(stats?.paidAmount || 0)}
                </Text>
              </View>

              <View style={{
                flex: 1,
                backgroundColor: "#fef3c7",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#fde68a",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <CreditCard size={16} color="#d97706" />
                  <Text style={{ color: "#d97706", fontSize: 12, fontWeight: "600" }}>
                    Credit
                  </Text>
                </View>
                <Text style={{ color: "#b45309", fontSize: 16, fontWeight: "bold" }}>
                  {stats?.creditOrders || 0} orders
                </Text>
                <Text style={{ color: "#d97706", fontSize: 14, fontWeight: "600" }}>
                  {formatCurrency(stats?.creditAmount || 0)}
                </Text>
              </View>

              {stats && stats.pendingOrders > 0 && (
                <View style={{
                  flex: 1,
                  backgroundColor: "#fee2e2",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#fecaca",
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <TrendingDown size={16} color="#dc2626" />
                    <Text style={{ color: "#dc2626", fontSize: 12, fontWeight: "600" }}>
                      Pending
                    </Text>
                  </View>
                  <Text style={{ color: "#b91c1c", fontSize: 16, fontWeight: "bold" }}>
                    {stats.pendingOrders} orders
                  </Text>
                  <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>
                    {formatCurrency(stats.pendingAmount)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Filter Buttons */}
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row" }}>
              <FilterButton filter="all" label="All Orders" icon={Receipt} />
              <FilterButton filter="paid" label="Paid" icon={DollarSign} />
              <FilterButton filter="credit" label="Credit" icon={CreditCard} />
            </View>
          </View>

          {/* Order History */}
          <View style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <History size={20} color={theme.colors.text} />
              <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text }}>
                Order History
              </Text>
            </View>

            {filteredOrders.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Receipt size={48} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 12 }}>
                  {selectedFilter === 'all' ? "No orders found for this customer" : `No ${selectedFilter} orders found`}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredOrders.slice(0, 10)}
                keyExtractor={(item) => item.id}
                renderItem={renderOrderItem}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            )}

            {filteredOrders.length > 10 && (
              <TouchableOpacity
                style={{
                  alignItems: "center",
                  paddingVertical: 12,
                  marginTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#e2e8f0",
                }}
              >
                <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>
                  View All Orders ({filteredOrders.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
