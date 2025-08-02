import { theme } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { customerState } from "@/state/customerState";
import { orderState } from "@/state/orderState";
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CustomerKOTsScreen() {
  const router = useRouter();
  const selectedCustomer = use$(customerState.selectedCustomer);
  const auth = use$(authState);
  const today = new Date().toISOString().split("T")[0];

  const [kots, setKots] = useState<any[]>([]);
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

  const handleKOTPress = async (kotFromList: any) => {
    try {
      // Fetch the complete order data using the proper orderService method
      const fullOrder = await orderService.getOrderById(kotFromList.id);
      if (fullOrder) {
        orderState.selectedOrder.set(fullOrder);
        router.push("/(modals)/order-details");
      } else {
        console.error("Order not found");
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
    }
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

  // Use kot.totalAmount if present, otherwise calculate from items
  const getKOTTotal = (kot: any) => {
    if (typeof kot.totalAmount === 'number' && isFinite(kot.totalAmount) && kot.totalAmount > 0) {
      return kot.totalAmount;
    }
    if (Array.isArray(kot.items)) {
      return kot.items.reduce((sum: number, item: any) => {
        const price = typeof item.price === 'number' && isFinite(item.price) ? item.price : 0;
        const qty = typeof item.quantity === 'number' && isFinite(item.quantity) ? item.quantity : 0;
        return sum + price * qty;
      }, 0);
    }
    return 0;
  };

  const totalAmount = kots.reduce((sum, kot) => sum + getKOTTotal(kot), 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: `${selectedCustomer?.name || 'Customer'}'s KOTs`,
          headerStyle: {
            backgroundColor: "white",
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 8,
                marginLeft: -8,
                borderRadius: 8,
              }}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      <View style={{ flex: 1 }}>
        <View style={{
          backgroundColor: "white",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6"
        }}>
          <Text style={{
            fontSize: 14,
            color: theme.colors.textSecondary
          }}>
            {new Date(today).toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>
        {loading && !refreshing ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>Loading KOTs...</Text>
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
            <Text style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 8
            }}>
              Something went wrong
            </Text>
            <Text style={{
              color: theme.colors.textSecondary,
              textAlign: "center",
              marginBottom: 16
            }}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={fetchKOTs}
              style={{
                backgroundColor: "#2563eb",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "500" }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : kots.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
            <Text style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 8
            }}>
              No KOTs Found
            </Text>
            <Text style={{
              color: theme.colors.textSecondary,
              textAlign: "center"
            }}>
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
            style={{ flex: 1 }}
          >
            <View style={{ padding: 16 }}>
              {kots.map((kot) => (
                <View
                  key={kot.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    marginBottom: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                    overflow: "hidden",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleKOTPress(kot)}
                    style={{
                      padding: 16,
                      backgroundColor: "#f9fafb",
                      borderBottomWidth: 1,
                      borderBottomColor: "#f3f4f6",
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View>
                        <Text style={{
                          fontSize: 18,
                          fontWeight: "600",
                          color: theme.colors.text
                        }}>
                          {kot.kotNumber}
                        </Text>
                        <Text style={{
                          color: theme.colors.textSecondary,
                          fontSize: 14,
                          marginTop: 2,
                        }}>
                          {formatTime(kot.createdAt)}
                        </Text>
                      </View>
                      <Text style={{
                        color: theme.colors.text,
                        fontWeight: "700",
                        fontSize: 18
                      }}>
                        ₹{getKOTTotal(kot).toFixed(2)}
                      </Text>
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
        <View style={{
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}>
          <View style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16
          }}>
            <View>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>Total Amount</Text>
              <Text style={{
                fontSize: 24,
                fontWeight: "700",
                color: theme.colors.text
              }}>
                ₹{totalAmount.toFixed(2)}
              </Text>
            </View>
            <View style={{
              backgroundColor: "#ecfdf5",
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
            }}>
              <Text style={{
                color: "#059669",
                fontSize: 14,
                fontWeight: "500"
              }}>
                {kots.length} KOT{kots.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleBillNow}
            style={{
              backgroundColor: "#2563eb",
              paddingVertical: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{
              color: "white",
              fontWeight: "600",
              fontSize: 18,
              marginRight: 8
            }}>
              BILL NOW
            </Text>
            <Text style={{ color: "white", fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
