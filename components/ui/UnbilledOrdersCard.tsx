import { theme } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import { AlertCircle, Clock, Receipt, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface UnbilledOrder {
  id: string;
  kotNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
}

interface UnbilledStats {
  totalCustomers: number;
  totalOrders: number;
  totalAmount: number;
  oldestOrderDate: string | null;
}

export default function UnbilledOrdersCard() {
  const [unbilledOrders, setUnbilledOrders] = useState<UnbilledOrder[]>([]);
  const [stats, setStats] = useState<UnbilledStats>({
    totalCustomers: 0,
    totalOrders: 0,
    totalAmount: 0,
    oldestOrderDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const auth = use$(authState);
  const router = useRouter();

  const loadUnbilledOrders = useCallback(async () => {
    if (!auth.isDbReady) return;

    try {
      setLoading(true);

      // Get all unbilled orders
      const orders = await orderService.getUnbilledOrders();

      // Transform and calculate stats
      const customersSet = new Set<string>();
      let totalAmount = 0;
      let oldestDate: string | null = null;

      const transformedOrders: UnbilledOrder[] = orders.map((order: any) => {
        customersSet.add(order.customerId);
        totalAmount += order.totalAmount;

        if (!oldestDate || order.createdAt < oldestDate) {
          oldestDate = order.createdAt;
        }

        return {
          id: order.id,
          kotNumber: order.kotNumber,
          customerId: order.customerId,
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          itemsCount: order.items?.length || 0,
          createdAt: order.createdAt,
        };
      });

      setUnbilledOrders(transformedOrders);
      setStats({
        totalCustomers: customersSet.size,
        totalOrders: transformedOrders.length,
        totalAmount,
        oldestOrderDate: oldestDate,
      });
    } catch (error) {
      console.error("Error loading unbilled orders:", error);
      Alert.alert("Error", "Failed to load unbilled orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth.isDbReady]);

  useEffect(() => {
    loadUnbilledOrders();
  }, [loadUnbilledOrders]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUnbilledOrders();
  };

  const handleOrderPress = (order: UnbilledOrder) => {
    router.push({
      pathname: "/(modals)/customer-bill",
      params: {
        customerId: order.customerId,
        customerName: order.customerName,
        date: order.createdAt.split('T')[0],
      },
    });
  };

  const handleViewAllUnbilled = () => {
    router.push({
      pathname: "/(modals)/unbilled-orders" as any
    });
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const getUrgencyColor = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return { bg: "#dcfce7", text: "#16a34a", border: "#bbf7d0" }; // Green - today
    if (diffDays <= 3) return { bg: "#fef3c7", text: "#d97706", border: "#fde68a" }; // Yellow - recent
    return { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" }; // Red - old
  };

  if (loading && !refreshing) {
    return (
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Receipt size={20} color={theme.colors.warning} />
          <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text }}>
            Unbilled Orders
          </Text>
        </View>
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontSize: 14 }}>
            Loading unbilled orders...
          </Text>
        </View>
      </View>
    );
  }

  return (
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
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Receipt size={20} color={theme.colors.warning} />
          <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text }}>
            Unbilled Orders
          </Text>
        </View>
        {stats.totalOrders > 0 && (
          <View style={{
            backgroundColor: theme.colors.warningLight,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.warning,
          }}>
            <Text style={{ color: theme.colors.warning, fontSize: 12, fontWeight: "600" }}>
              {stats.totalOrders} pending
            </Text>
          </View>
        )}
      </View>

      {stats.totalOrders === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Receipt size={48} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 12, fontSize: 16 }}>
            All orders are billed!
          </Text>
          <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 4, fontSize: 14 }}>
            No pending orders to bill
          </Text>
        </View>
      ) : (
        <>
          {/* Stats Summary */}
          <View style={{ flexDirection: "row", marginBottom: 16, gap: 12 }}>
            <View style={{
              flex: 1,
              backgroundColor: "#f8fafc",
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
            }}>
              <Users size={16} color={theme.colors.textSecondary} />
              <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text, marginTop: 4 }}>
                {stats.totalCustomers}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                Customers
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: "#f8fafc",
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
            }}>
              <Receipt size={16} color={theme.colors.textSecondary} />
              <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text, marginTop: 4 }}>
                {stats.totalOrders}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                Orders
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: "#f8fafc",
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
            }}>
              <AlertCircle size={16} color={theme.colors.warning} />
              <Text style={{ fontSize: 16, fontWeight: "bold", color: theme.colors.warning, marginTop: 4 }}>
                {formatCurrency(stats.totalAmount)}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                Value
              </Text>
            </View>
          </View>

          {/* Recent Unbilled Orders */}
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.text, marginBottom: 12 }}>
            Recent Unbilled Orders
          </Text>

          <ScrollView
            style={{ maxHeight: 200 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {unbilledOrders.slice(0, 5).map((order, index) => {
              const urgencyStyle = getUrgencyColor(order.createdAt);
              return (
                <TouchableOpacity
                  key={order.id}
                  onPress={() => handleOrderPress(order)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    marginBottom: index === Math.min(unbilledOrders.length, 5) - 1 ? 0 : 8,
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", color: theme.colors.text, marginBottom: 2 }}>
                      {order.customerName}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                      KOT-{order.kotNumber} • {order.itemsCount} items
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "bold", color: theme.colors.text, marginBottom: 2 }}>
                      {formatCurrency(order.totalAmount)}
                    </Text>
                    <View style={{
                      backgroundColor: urgencyStyle.bg,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: urgencyStyle.border,
                    }}>
                      <Text style={{ color: urgencyStyle.text, fontSize: 10, fontWeight: "600" }}>
                        {formatDate(order.createdAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* View All Button */}
          {unbilledOrders.length > 5 && (
            <TouchableOpacity
              onPress={handleViewAllUnbilled}
              style={{
                alignItems: "center",
                paddingVertical: 12,
                marginTop: 12,
                borderTopWidth: 1,
                borderTopColor: "#e2e8f0",
              }}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>
                View All Unbilled Orders ({unbilledOrders.length})
              </Text>
            </TouchableOpacity>
          )}

          {/* Oldest Order Alert */}
          {stats.oldestOrderDate && (
            <View style={{
              backgroundColor: "#fef3c7",
              padding: 12,
              borderRadius: 12,
              marginTop: 12,
              borderLeftWidth: 4,
              borderLeftColor: "#d97706",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Clock size={16} color="#d97706" />
                <Text style={{ color: "#92400e", fontWeight: "600", fontSize: 14 }}>
                  Oldest unbilled order: {formatDate(stats.oldestOrderDate)}
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}
