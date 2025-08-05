// app/(modals)/create-order.tsx
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { Pencil, Plus, ShoppingBag, User } from "lucide-react-native";
import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";
import { orderService } from "../../services/orderService";
import { customerState } from "../../state/customerState";
import { orderState } from "../../state/orderState";

export default function CreateOrderScreen() {
  const router = useRouter();
  const orderStateData = use$(orderState);
  const customerStateData = use$(customerState);

  const handleSelectCustomer = () => {
    router.push("/(modals)/select-customer");
  };

  const handleAddItems = () => {
    router.push("/(modals)/select-items");
  };

  const handlePlaceOrder = async () => {
    if (
      !orderStateData.selectedCustomerId ||
      orderStateData.selectedItems.length === 0
    ) {
      return;
    }

    try {
      orderState.isCreatingOrder.set(true);

      const orderData = {
        customerId: orderStateData.selectedCustomerId,
        items: orderStateData.selectedItems.map((selectedItem) => ({
          itemId: selectedItem.item.id,
          quantity: selectedItem.quantity,
          price: selectedItem.item.price,
        })),
      };

      await orderService.createOrder(orderData);

      // Reload orders
      const orders = await orderService.getAllOrders();
      orderState.orders.set(orders);

      // Show success message
      Alert.alert("Order Created", "KOT created successfully! Amount added to customer dues.", [
        {
          text: "OK",
          onPress: () => {
            // Reset state and navigate back
            orderState.selectedCustomerId.set(null);
            orderState.selectedItems.set([]);
            router.back();
          },
        },
      ]);
    } catch (error) {
      console.error("Error creating order:", error);
      orderState.error.set("Failed to create order");
      
      let errorMessage = "Failed to create order. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes("Customer") && error.message.includes("does not exist")) {
          errorMessage = "Selected customer no longer exists. Please select a different customer.";
        } else if (error.message.includes("Menu item") && error.message.includes("does not exist")) {
          errorMessage = "One or more selected items are no longer available. Please update your selection.";
        } else if (error.message.includes("FOREIGN KEY constraint failed")) {
          errorMessage = "Data integrity error. Please ensure you have selected a valid customer and menu items.";
        }
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      orderState.isCreatingOrder.set(false);
    }
  };

  const getSelectedCustomer = () => {
    if (!orderStateData.selectedCustomerId) return null;
    return customerStateData.customers.find(
      (c) => c.id === orderStateData.selectedCustomerId
    );
  };

  const getTotalAmount = () => {
    return orderStateData.selectedItems.reduce(
      (total, item) => total + item.item.price * item.quantity,
      0
    );
  };

  const selectedCustomer = getSelectedCustomer();
  const totalAmount = getTotalAmount();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Create Order",
          headerTintColor: theme.colors.text,
          headerStyle: {
            backgroundColor: "white",
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
          },
        }}
      />
      <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Customer Section */}
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
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <User size={20} color={theme.colors.textSecondary} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.colors.textSecondary,
                  marginLeft: 8,
                }}
              >
                Customer
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSelectCustomer}
              style={{
                borderWidth: 1,
                borderColor: selectedCustomer
                  ? theme.colors.primary
                  : "#e5e7eb",
                borderRadius: 12,
                padding: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: selectedCustomer
                  ? theme.colors.primaryLight
                  : "#f9fafb",
              }}
            >
              {selectedCustomer ? (
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: theme.colors.text,
                      marginBottom: 2,
                    }}
                  >
                    {selectedCustomer.name}
                  </Text>
                  {selectedCustomer.contact && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {selectedCustomer.contact}
                    </Text>
                  )}
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    color: theme.colors.textSecondary,
                    flex: 1,
                  }}
                >
                  Select Customer
                </Text>
              )}
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 18,
                }}
              >
                →
              </Text>
            </TouchableOpacity>
          </View>

          {/* Items Section */}
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
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <ShoppingBag size={20} color={theme.colors.textSecondary} />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: theme.colors.textSecondary,
                    marginLeft: 8,
                  }}
                >
                  Items
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleAddItems}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.colors.primaryLight,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                {/* TODO: change icon to pencil and text to edit items if orderStateData.selectedItems.length > 0 */}
                {orderStateData.selectedItems.length > 0 ? (
                  <>
                    <Pencil size={16} color={theme.colors.primary} />
                    <Text
                      style={{
                        color: theme.colors.primary,
                        marginLeft: 4,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Edit Items
                    </Text>
                  </>
                ) : (
                  <>
                    <Plus size={16} color={theme.colors.primary} />
                    <Text
                      style={{
                        color: theme.colors.primary,
                        fontWeight: "600",
                        marginLeft: 4,
                        fontSize: 14,
                      }}
                    >
                      Add Items
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {orderStateData.selectedItems.length > 0 ? (
              <View>
                {orderStateData.selectedItems.map((selectedItem, index) => (
                  <View
                    key={`${selectedItem.item.id}-${index}`}
                    style={{
                      borderBottomWidth:
                        index < orderStateData.selectedItems.length - 1 ? 1 : 0,
                      borderBottomColor: "#f3f4f6",
                      paddingVertical: 12,
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
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: theme.colors.text,
                            marginBottom: 2,
                          }}
                        >
                          {selectedItem.item.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: theme.colors.textSecondary,
                          }}
                        >
                          Qty: {selectedItem.quantity} × ₹
                          {selectedItem.item.price}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: theme.colors.text,
                        }}
                      >
                        ₹{selectedItem.item.price * selectedItem.quantity}
                      </Text>
                    </View>
                  </View>
                ))}

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: "#e5e7eb",
                    paddingTop: 16,
                    marginTop: 16,
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
                        fontSize: 16,
                        fontWeight: "600",
                        color: theme.colors.text,
                      }}
                    >
                      Total
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "800",
                        color: theme.colors.primary,
                      }}
                    >
                      ₹{totalAmount}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ paddingVertical: 32 }}>
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    textAlign: "center",
                    fontSize: 16,
                    marginBottom: 4,
                  }}
                >
                  No items selected
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary,
                    textAlign: "center",
                  }}
                >
                  Tap &quot;Add Items&quot; to get started
                </Text>
              </View>
            )}
          </View>

          {/* Bottom spacing for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "white",
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: "#f3f4f6",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <TouchableOpacity
            onPress={handlePlaceOrder}
            disabled={
              !selectedCustomer ||
              orderStateData.selectedItems.length === 0 ||
              orderStateData.isCreatingOrder
            }
            style={{
              backgroundColor:
                selectedCustomer &&
                orderStateData.selectedItems.length > 0 &&
                !orderStateData.isCreatingOrder
                  ? theme.colors.primary
                  : "#d1d5db",
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: "center",
              shadowColor: theme.colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity:
                selectedCustomer &&
                orderStateData.selectedItems.length > 0 &&
                !orderStateData.isCreatingOrder
                  ? 0.3
                  : 0,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                color:
                  selectedCustomer &&
                  orderStateData.selectedItems.length > 0 &&
                  !orderStateData.isCreatingOrder
                    ? "white"
                    : "#9ca3af",
                fontWeight: "600",
                fontSize: 18,
              }}
            >
              {orderStateData.isCreatingOrder
                ? "Placing Order..."
                : "Place Order"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
