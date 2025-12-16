import { useFocusRefresh } from "@/hooks/useFocusRefresh";
import { useScreenPerformance } from "@/hooks/useScreenPerformance";
import { KotOrder, orderService } from "@/services/orderService";
import { appEvents } from "@/state/appEvents";
import { authState } from "@/state/authState";
import { orderState } from "@/state/orderState";
import { use$ } from "@legendapp/state/react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
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
          {order.billId && (
            <View className="mb-2 rounded-full bg-green-100 px-2 py-0.5">
              <Text className="text-green-700 text-xs font-semibold">
                Billed
              </Text>
            </View>
          )}
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
  // Granular subscriptions - only re-render when specific fields change
  const orders = use$(orderState.orders);
  const isLoading = use$(orderState.isLoading);
  const error = use$(orderState.error);
  const isDbReady = use$(authState.isDbReady);
  const userRole = use$(authState.user)?.role;
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);

  // Track screen performance
  useScreenPerformance("Orders");

  const toISTDateKey = (d: Date) => {
    const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
    return new Date(istMs).toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const loadOrders = useCallback(async () => {
    try {
      orderState.isLoading.set(true);
      orderState.error.set(null);
      const dateKey = toISTDateKey(selectedDate);
      const orders = await orderService.getOrdersByDate(dateKey);
      orderState.orders.set(orders);
    } catch (error) {
      console.error("Error loading orders:", error);
      orderState.error.set("Failed to load orders");
    } finally {
      orderState.isLoading.set(false);
    }
  }, [selectedDate]);

  // Track last data version to avoid redundant loads
  const lastVersionRef = useRef<number>(0);
  const ev = use$(appEvents);

  // Use focus-aware refresh with 5-second minimum interval
  useFocusRefresh(
    useCallback(() => {
      if (isDbReady) {
        const currentVersion = ev.ordersVersion + ev.anyVersion;
        // Only reload if version changed or first load
        if (currentVersion !== lastVersionRef.current) {
          lastVersionRef.current = currentVersion;
          loadOrders();
        }
      }
    }, [isDbReady, ev.ordersVersion, ev.anyVersion, loadOrders]),
    { minInterval: 3000, dependencies: [selectedDate] }
  );

  // Load on date change
  useEffect(() => {
    if (isDbReady) {
      loadOrders();
    }
  }, [isDbReady, selectedDate, loadOrders]);

  const handleCreateOrder = () => {
    // Reset order state before navigation
    orderState.selectedCustomerId.set(null);
    orderState.selectedItems.set([]);
    router.push("/(modals)/create-order");
  };

  if (!isDbReady) {
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
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">Orders (KOT)</Text>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            className="px-3 py-2 rounded-md bg-blue-50"
          >
            <Text className="text-blue-600 font-medium">
              {toISTDateKey(selectedDate)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {showPicker && (
        <View className="bg-white px-4 py-2 border-b border-gray-200">
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(event, date) => {
              if (Platform.OS !== "ios") setShowPicker(false);
              if (date) setSelectedDate(date);
            }}
          />
          {Platform.OS === "ios" && (
            <View className="flex-row justify-end mt-2">
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                className="px-4 py-2 bg-blue-600 rounded-md"
              >
                <Text className="text-white font-medium">Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500">Loading orders...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-red-500 mb-4">{error}</Text>
            <TouchableOpacity
              onPress={loadOrders}
              className="bg-blue-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-6xl mb-4">📋</Text>
            <Text className="text-xl font-semibold text-gray-800 mb-2">
              No Orders Yet
            </Text>
            {(() => {
              const isTodaySelected =
                toISTDateKey(selectedDate) === toISTDateKey(new Date());
              const role = userRole?.toLowerCase?.();
              const isAdmin = role === "admin";
              const canCreate = isAdmin || isTodaySelected;
              return (
                <>
                  <Text className="text-gray-500 text-center mb-6">
                    {canCreate
                      ? "Start taking orders by creating your first order"
                      : "Order creation is available only for today's date (admins can create for other dates)."}
                  </Text>
                  {canCreate && (
                    <TouchableOpacity
                      onPress={handleCreateOrder}
                      className="bg-blue-600 px-6 py-3 rounded-lg"
                    >
                      <Text className="text-white font-medium text-lg">
                        Create Order
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <OrderItem order={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
