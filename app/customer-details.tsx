import { theme } from "@/constants/theme";
import { formatCurrency } from "@/lib/money";
import { orderService } from "@/services/orderService";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, CreditCard, DollarSign, Receipt } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface CustomerOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'credit' | 'partial';
  createdAt: string;
  items: {
    id: string;
    menuItemName: string;
    quantity: number;
    price: number;
  }[];
}

export default function CustomerDetailsScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
  }>();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'billed' | 'credit'>('all');

  useEffect(() => {
    if (customerId) {
      loadCustomerOrders();
    }
  }, [customerId]);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedFilter]);

  const loadCustomerOrders = async () => {
    try {
      setLoading(true);
      // This function will be implemented in orderService
      const customerOrders = await orderService.getOrdersByCustomerId(customerId);
      setOrders(customerOrders);
    } catch (error) {
      console.error("Error loading customer orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    switch (selectedFilter) {
      case 'billed':
        setFilteredOrders(orders.filter(order => order.paymentStatus === 'paid'));
        break;
      case 'credit':
        setFilteredOrders(orders.filter(order => order.paymentStatus === 'credit' || order.paymentStatus === 'partial'));
        break;
      default:
        setFilteredOrders(orders);
    }
  };

  const handleOrderPress = (order: CustomerOrder) => {
    router.push({
      pathname: "/order-summary",
      params: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        from: "customer-details"
      }
    });
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
        return 'Partial';
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

  const getTotalStats = () => {
    const totalBilled = orders
      .filter(order => order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const totalCredit = orders
      .filter(order => order.paymentStatus === 'credit' || order.paymentStatus === 'partial')
      .reduce((sum, order) => sum + (order.totalAmount - order.amountPaid), 0);

    return { totalBilled, totalCredit };
  };

  const { totalBilled, totalCredit } = getTotalStats();

  const renderOrderItem = ({ item }: { item: CustomerOrder }) => (
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
            Order #{item.orderNumber}
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
                backgroundColor: getStatusColor(item.paymentStatus) + '20',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: getStatusColor(item.paymentStatus),
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: getStatusColor(item.paymentStatus),
                }}
              >
                {getStatusText(item.paymentStatus)}
              </Text>
            </View>
          </View>

          {item.paymentStatus === 'partial' && (
            <Text
              style={{
                fontSize: 12,
                color: '#ef4444',
                marginTop: 4,
              }}
            >
              Pending: {formatCurrency(item.totalAmount - item.amountPaid)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
      </View>

      {/* Stats Cards */}
      <View style={{ flexDirection: "row", padding: 16, gap: 12 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: "center",
            ...theme.shadows.sm,
          }}
        >
          <DollarSign size={24} color="#10b981" />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: "#10b981",
              marginTop: 8,
            }}
          >
            {formatCurrency(totalBilled)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.textSecondary,
              textAlign: "center",
            }}
          >
            Total Billed
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: "center",
            ...theme.shadows.sm,
          }}
        >
          <CreditCard size={24} color="#f59e0b" />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: "#f59e0b",
              marginTop: 8,
            }}
          >
            {formatCurrency(totalCredit)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.textSecondary,
              textAlign: "center",
            }}
          >
            Credit Pending
          </Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <View style={{ flexDirection: "row" }}>
          <FilterButton filter="all" label="All Orders" icon={Receipt} />
          <FilterButton filter="billed" label="Billed" icon={DollarSign} />
          <FilterButton filter="credit" label="Credit" icon={CreditCard} />
        </View>
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading orders...
          </Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ fontSize: 18, color: theme.colors.textSecondary, textAlign: "center" }}>
            {selectedFilter === 'all' ? "No orders found" : `No ${selectedFilter} orders found`}
          </Text>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", marginTop: 8 }}>
            This customer hasn&apos;t placed any orders yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}
