import { theme } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Calendar, Receipt, User } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface UnbilledOrder {
  id: string;
  kotNumber: string;
  customerId: string;
  customerName: string;
  customerContact?: string;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
  items: any[];
}

export default function UnbilledOrdersScreen() {
  const [unbilledOrders, setUnbilledOrders] = useState<UnbilledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const auth = use$(authState);
  const router = useRouter();

  const loadUnbilledOrders = useCallback(async () => {
    if (!auth.isDbReady) return;

    try {
      setLoading(true);
      const orders = await orderService.getUnbilledOrders();
      setUnbilledOrders(orders);
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
      year: "numeric",
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

  const getCustomerInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderOrderItem = ({ item }: { item: UnbilledOrder }) => {
    const urgencyStyle = getUrgencyColor(item.createdAt);
    
    return (
      <TouchableOpacity
        onPress={() => handleOrderPress(item)}
        style={{
          backgroundColor: "white",
          marginHorizontal: 16,
          marginVertical: 6,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: urgencyStyle.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Customer Avatar */}
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: theme.colors.primaryLight,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}>
            <Text style={{ color: theme.colors.primary, fontWeight: "bold", fontSize: 16 }}>
              {getCustomerInitials(item.customerName)}
            </Text>
          </View>

          {/* Order Details */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 2,
            }}>
              {item.customerName}
            </Text>
            
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Receipt size={14} color={theme.colors.textSecondary} />
              <Text style={{
                fontSize: 13,
                color: theme.colors.textSecondary,
                marginLeft: 4,
              }}>
                KOT-{item.kotNumber} • {item.itemsCount} items
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Calendar size={14} color={urgencyStyle.text} />
              <Text style={{
                fontSize: 12,
                color: urgencyStyle.text,
                marginLeft: 4,
                fontWeight: "500",
              }}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>

          {/* Amount and Urgency */}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 6,
            }}>
              {formatCurrency(item.totalAmount)}
            </Text>
            
            <View style={{
              backgroundColor: urgencyStyle.bg,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: urgencyStyle.border,
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: "600",
                color: urgencyStyle.text,
              }}>
                UNBILLED
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalAmount = unbilledOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalCustomers = new Set(unbilledOrders.map(order => order.customerId)).size;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Unbilled Orders",
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTitleStyle: { color: "white" },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header Stats */}
      <View style={{
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 20,
        paddingBottom: 24,
        marginTop: -10,
      }}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{
            flex: 1,
            backgroundColor: "rgba(255,255,255,0.2)",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
          }}>
            <Receipt size={24} color="white" />
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 8 }}>
              {unbilledOrders.length}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
              Orders
            </Text>
          </View>

          <View style={{
            flex: 1,
            backgroundColor: "rgba(255,255,255,0.2)",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
          }}>
            <User size={24} color="white" />
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 8 }}>
              {totalCustomers}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
              Customers
            </Text>
          </View>

          <View style={{
            flex: 1,
            backgroundColor: "rgba(255,255,255,0.2)",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
          }}>
            <AlertCircle size={24} color="white" />
            <Text style={{ color: "white", fontSize: 18, fontWeight: "bold", marginTop: 8 }}>
              {formatCurrency(totalAmount)}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
              Total Value
            </Text>
          </View>
        </View>
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading unbilled orders...
          </Text>
        </View>
      ) : unbilledOrders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Receipt size={64} color={theme.colors.textSecondary} />
          <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.text, marginTop: 16 }}>
            All Orders Billed!
          </Text>
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary, textAlign: "center", marginTop: 8 }}>
            There are no pending orders to bill at the moment.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingTop: 16 }}>
          <FlatList
            data={unbilledOrders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrderItem}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
