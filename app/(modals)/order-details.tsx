// app/(modals)/order-details.tsx
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Calendar, User } from "lucide-react-native";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { orderState } from "../../state/orderState";

export default function OrderDetailsScreen() {
  const router = useRouter();
  // Granular state subscription for optimized re-renders
  const selectedOrder = use$(orderState.selectedOrder);

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

  if (!selectedOrder) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Order Details",
            headerStyle: {
              backgroundColor: "white",
            },
            headerTitleStyle: {
              fontSize: 20,
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
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 32,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              color: theme.colors.textSecondary,
              textAlign: "center",
            }}
          >
            No order selected
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const order = selectedOrder;

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Order Details",
          headerStyle: {
            backgroundColor: "white",
          },
          headerTitleStyle: {
            fontSize: 20,
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Info Card */}
        <View
          style={{
            backgroundColor: "white",
            padding: 20,
            borderRadius: 16,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "800",
                  color: theme.colors.text,
                  marginBottom: 4,
                }}
              >
                KOT-{order.kotNumber}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Calendar size={16} color={theme.colors.textSecondary} />
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginLeft: 6,
                }}
              >
                {formatDate(order.createdAt)}
              </Text>
            </View>
          </View>

          {/* Customer Info */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: "#f3f4f6",
              paddingTop: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <User size={16} color={theme.colors.textSecondary} />
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginLeft: 6,
                  fontWeight: "500",
                }}
              >
                Customer
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
                marginBottom: 4,
              }}
            >
              {order.customer?.name || "Unknown Customer"}
            </Text>
            {order.customer?.contact && (
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                }}
              >
                {order.customer.contact}
              </Text>
            )}
          </View>
        </View>

        {/* Order Items Card */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
          className="overflow-hidden"
        >
          {/* Header */}
          <View
            style={{
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
              }}
            >
              Order Items
            </Text>
          </View>

          {/* Items List */}
          {order.items && order.items.length > 0 ? (
            <>
              {order.items.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    padding: 20,
                    borderBottomWidth: index < order.items!.length - 1 ? 1 : 0,
                    borderBottomColor: "#f3f4f6",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            backgroundColor: "#fff7ed",
                            borderRadius: 12,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 20,
                              color: "#ea580c",
                            }}
                          >
                            🍵
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "600",
                              color: theme.colors.text,
                              marginBottom: 2,
                            }}
                          >
                            {item.menuItem?.name || "Unknown Item"}
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: theme.colors.textSecondary,
                            }}
                          >
                            Qty: {item.quantity} × ₹{item.priceAtTime}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "700",
                          color: theme.colors.text,
                          marginBottom: 2,
                        }}
                      >
                        ₹{item.priceAtTime * item.quantity}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        @ ₹{item.priceAtTime} each
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Total */}
              <View
                style={{
                  padding: 20,
                  backgroundColor: "#f9fafb",
                  borderTopWidth: 1,
                  borderTopColor: "#f3f4f6",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: theme.colors.text,
                    }}
                  >
                    Total Amount
                  </Text>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "800",
                      color: theme.colors.primary,
                    }}
                  >
                    ₹{order.total || 0}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={{ padding: 20 }}>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  textAlign: "center",
                  fontSize: 16,
                }}
              >
                No items found
              </Text>
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
