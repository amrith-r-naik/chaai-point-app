import { theme } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, Receipt, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface OrderDetails {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'credit' | 'partial';
  paymentMethod?: string;
  createdAt: string;
  items: {
    id: string;
    menuItemName: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  notes?: string;
}

export default function OrderSummaryScreen() {
  const { orderId, orderNumber, from } = useLocalSearchParams<{
    orderId: string;
    orderNumber: string;
    from?: string;
  }>();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      // This function will be implemented in orderService
      const orderDetails = await orderService.getOrderDetailsById(orderId);
      setOrder(orderDetails);
    } catch (error) {
      console.error("Error loading order details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10b981';
      case 'credit':
        return '#f59e0b';
      case 'partial':
        return '#ef4444';
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'credit':
        return 'Credit';
      case 'partial':
        return 'Partial Payment';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderOrderItem = ({ item }: { item: OrderDetails['items'][0] }) => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            color: theme.colors.text,
            marginBottom: 2,
          }}
        >
          {item.menuItemName}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.colors.textSecondary,
          }}
        >
          ₹{item.price.toFixed(2)} × {item.quantity}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.primary,
        }}
      >
        ₹{item.total.toFixed(2)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading order details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ fontSize: 18, color: theme.colors.textSecondary, textAlign: "center" }}>
            Order not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: theme.colors.primary,
          paddingTop: 20,
          paddingBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
              Order #{order.orderNumber}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 14,
                marginTop: 2,
              }}
            >
              Order Summary
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Order Info Card */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadows.sm,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Order Information
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <User size={16} color={theme.colors.textSecondary} />
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginLeft: 8,
                marginRight: 8,
              }}
            >
              Customer:
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}
            >
              {order.customerName}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Calendar size={16} color={theme.colors.textSecondary} />
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginLeft: 8,
                marginRight: 8,
              }}
            >
              Date:
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}
            >
              {formatDate(order.createdAt)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Receipt size={16} color={theme.colors.textSecondary} />
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginLeft: 8,
                  marginRight: 8,
                }}
              >
                Status:
              </Text>
            </View>
            <View
              style={{
                backgroundColor: getStatusColor(order.paymentStatus) + '20',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: getStatusColor(order.paymentStatus),
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: getStatusColor(order.paymentStatus),
                }}
              >
                {getStatusText(order.paymentStatus)}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadows.sm,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Order Items ({order.items.length})
          </Text>

          <FlatList
            data={order.items}
            keyExtractor={(item) => item.id}
            renderItem={renderOrderItem}
            scrollEnabled={false}
          />
        </View>

        {/* Payment Summary */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadows.sm,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Payment Summary
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
              Total Amount:
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: theme.colors.text }}>
              ₹{order.totalAmount.toFixed(2)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
              Amount Paid:
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: theme.colors.text }}>
              ₹{order.amountPaid.toFixed(2)}
            </Text>
          </View>

          {order.totalAmount !== order.amountPaid && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: '#ef4444' }}>
                Pending Amount:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "500", color: '#ef4444' }}>
                ₹{(order.totalAmount - order.amountPaid).toFixed(2)}
              </Text>
            </View>
          )}

          {order.paymentMethod && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
                Payment Method:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "500", color: theme.colors.text }}>
                {order.paymentMethod}
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {order.notes && (
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              ...theme.shadows.sm,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
                marginBottom: 8,
              }}
            >
              Notes
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                lineHeight: 20,
              }}
            >
              {order.notes}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
