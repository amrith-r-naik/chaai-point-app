import { KotOrder, orderService } from "@/services/orderService";
import { appEvents } from "@/state/appEvents";
import { authState } from "@/state/authState";
import { orderState } from "@/state/orderState";
import { use$ } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function OrderItem({ order }: { order: KotOrder }) {
  const router = useRouter();

  const handleViewOrder = () => {
    orderState.selectedOrder.set(order);
    router.push("/(modals)/order-details");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  return (
    <Pressable
      onPress={handleViewOrder}
      className="bg-white p-4 mb-3 rounded-lg border border-gray-200 shadow-sm"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">
            KOT-{order.kotNumber}
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            {order.customer?.name || "Unknown Customer"}
          </Text>
        </View>
        <View className="items-end">
          <TouchableOpacity
            onPress={handleViewOrder}
            className="bg-blue-50 px-3 py-1 rounded-md"
          >
            <Text className="text-blue-600 text-sm font-medium">
              View Order
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-sm text-gray-500">
          {formatDate(order.createdAt)}
        </Text>
        <Text className="text-lg font-bold text-gray-900">
          ₹{order.total || 0}
        </Text>
      </View>

      {order.items && order.items.length > 0 && (
        <Text className="text-xs text-gray-400 mt-1">
          {order.items.length} item{order.items.length > 1 ? "s" : ""}
        </Text>
      )}
    </Pressable>
  );
}

export default function OrdersScreen() {
  const state = use$(orderState);
  const auth = use$(authState);
  const router = useRouter();

  useEffect(() => {
    if (auth.isDbReady) {
      loadOrders();
    }
  }, [auth.isDbReady]);

  // Auto-refresh when orders or global changes occur
  const ev = use$(appEvents);
  useEffect(() => {
    if (auth.isDbReady) {
      loadOrders();
    }
  }, [ev.ordersVersion, ev.anyVersion, auth.isDbReady]);

  const loadOrders = async () => {
    try {
      orderState.isLoading.set(true);
      orderState.error.set(null);
      const orders = await orderService.getAllOrders();
      orderState.orders.set(orders);
    } catch (error) {
      console.error("Error loading orders:", error);
      orderState.error.set("Failed to load orders");
    } finally {
      orderState.isLoading.set(false);
    }
  };

  const handleCreateOrder = () => {
    // Reset order state before navigation
    orderState.selectedCustomerId.set(null);
    orderState.selectedItems.set([]);
    router.push("/(modals)/create-order");
  };

  if (!auth.isDbReady) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Orders (KOT)</Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-4 pt-4">
        {state.isLoading ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500">Loading orders...</Text>
          </View>
        ) : state.error ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-red-500 mb-4">{state.error}</Text>
            <TouchableOpacity
              onPress={loadOrders}
              className="bg-blue-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : state.orders.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-6xl mb-4">📋</Text>
            <Text className="text-xl font-semibold text-gray-800 mb-2">
              No Orders Yet
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              Start taking orders by creating your first order
            </Text>
            <TouchableOpacity
              onPress={handleCreateOrder}
              className="bg-blue-600 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-medium text-lg">
                Create Order
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={state.orders}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <OrderItem order={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
