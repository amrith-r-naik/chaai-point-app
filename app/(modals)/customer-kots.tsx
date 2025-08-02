import { KotOrder, orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { customerState } from "@/state/customerState";
import { orderState } from "@/state/orderState";
import { use$ } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CustomerKOTsScreen() {
  const router = useRouter();
  const selectedCustomer = use$(customerState.selectedCustomer);
  const auth = use$(authState);
  const today = new Date().toISOString().split("T")[0];

  const [kots, setKots] = useState<KotOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Fetch KOTs for the selected customer and date
  const fetchKOTs = useCallback(async () => {
    if (!selectedCustomer?.id || !auth.isDbReady) return;
    setLoading(true);
    setError("");
    try {
      const result = await orderService.getCustomerKOTsForDate(selectedCustomer.id, today);
      setKots(result);
    } catch (err: any) {
      setError(err.message || "Failed to load KOTs");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer?.id, today, auth.isDbReady]);

  useEffect(() => {
    fetchKOTs();
  }, [fetchKOTs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchKOTs();
    setRefreshing(false);
  }, [fetchKOTs]);

  const handleBillNow = () => {
    if (!selectedCustomer?.id) return;
    router.push({
      pathname: "/(modals)/customer-bill",
      params: {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        date: today,
      },
    });
  };

  const getKOTStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "preparing":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "ready":
        return "bg-green-100 text-green-700 border-green-200";
      case "served":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Use kot.total if present, otherwise calculate from items
  const getKOTTotal = (kot: KotOrder) => {
    // Debug log
    if (typeof window !== 'undefined') {
      // Only log in browser/Expo
      // @ts-ignore
      console.log('[KOT DEBUG]', kot);
    }
    if (typeof kot.total === 'number' && isFinite(kot.total) && kot.total > 0) {
      return kot.total;
    }
    if (Array.isArray(kot.items)) {
      return kot.items.reduce((sum: number, item: any) => {
        // Try priceAtTime, then price
        const price = typeof item.priceAtTime === 'number' && isFinite(item.priceAtTime)
          ? item.priceAtTime
          : (typeof item.price === 'number' && isFinite(item.price) ? item.price : 0);
        const qty = typeof item.quantity === 'number' && isFinite(item.quantity) ? item.quantity : 0;
        return sum + price * qty;
      }, 0);
    }
    return 0;
  };
  const totalAmount = kots.reduce((sum, kot) => sum + getKOTTotal(kot), 0);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-200">
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2"
          >
            <Text className="text-gray-600 text-xl">←</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {selectedCustomer?.name}&apos;s KOTs
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              {new Date(today).toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1">
        {loading && !refreshing ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-2">Loading KOTs...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-4">
            <Text className="text-6xl mb-4">⚠️</Text>
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              Something went wrong
            </Text>
            <Text className="text-gray-500 text-center mb-4">{error}</Text>
            <TouchableOpacity
              onPress={fetchKOTs}
              className="bg-blue-600 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-medium">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : kots.length === 0 ? (
          <View className="flex-1 justify-center items-center px-4">
            <Text className="text-6xl mb-4">📋</Text>
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              No KOTs Found
            </Text>
            <Text className="text-gray-500 text-center">
              No kitchen orders found for {selectedCustomer?.name} on this date.
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
            className="flex-1"
          >
            <View className="p-4 space-y-4">
              {kots.map((kot) => (
                <View
                  key={kot.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* KOT Header */}
                  <TouchableOpacity className="px-4 py-3 bg-gray-50 border-b border-gray-200"
                    onPress={() => {
                      console.log("[KOT SELECTED]", kot);

                      orderState.selectedOrder.set({
                        id: kot.id,
                        kotNumber: kot.kotNumber,
                        customerId: kot.customerId,
                        billId: kot.billId,
                        createdAt: kot.createdAt,
                        customer: kot.customer,
                        items: kot.items,
                        total: getKOTTotal(kot),
                      });
                      router.push({
                        pathname: "/(modals)/order-details",
                        params: { orderId: kot.id },
                      });
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-lg font-semibold text-gray-900">
                          {kot.kotNumber}
                        </Text>
                        <Text className="text-gray-500 text-sm">
                          {formatTime(kot.createdAt)}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-gray-900 font-bold text-lg">
                          ₹{getKOTTotal(kot).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bill Now Button */}
      {kots.length > 0 && (
        <View className="bg-white border-t border-gray-200 px-4 py-4">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-gray-600 text-sm">Total Amount</Text>
              <Text className="text-2xl font-bold text-gray-900">
                ₹{totalAmount}
              </Text>
            </View>
            <View className="bg-green-50 px-3 py-1 rounded-full">
              <Text className="text-green-700 text-sm font-medium">
                {kots.length} KOT{kots.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleBillNow}
            className="bg-blue-600 py-4 rounded-lg flex-row items-center justify-center"
          >
            <Text className="text-white font-semibold text-lg mr-2">
              BILL NOW
            </Text>
            <Text className="text-white text-lg">→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
