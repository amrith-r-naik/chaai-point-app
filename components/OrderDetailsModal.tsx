// components/OrderDetailsModal.tsx
import { use$ } from "@legendapp/state/react";
import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { orderState } from "../state/orderState";

export default function OrderDetailsModal() {
  const state = use$(orderState);

  const closeModal = () => {
    orderState.showOrderDetailsModal.set(false);
    orderState.selectedOrder.set(null);
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

  if (!state.selectedOrder) return null;

  const order = state.selectedOrder;

  return (
    <Modal
      visible={state.showOrderDetailsModal}
      animationType="slide"
      transparent={false}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white px-4 py-3 border-b border-gray-200 flex-row items-center">
          <TouchableOpacity onPress={closeModal} className="mr-3 p-1">
            <Text className="text-xl">←</Text>
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-gray-900 flex-1">
            Order Details
          </Text>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {/* Order Info */}
          <View className="bg-white p-4 rounded-lg border border-gray-200 mb-4 shadow-sm">
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  KOT-{order.kotNumber}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {formatDate(order.createdAt)}
                </Text>
              </View>
            </View>

            <View className="border-t border-gray-100 pt-3">
              <Text className="text-sm text-gray-600 mb-1">Customer</Text>
              <Text className="text-lg font-semibold text-gray-900">
                {order.customer?.name || "Unknown Customer"}
              </Text>
              {order.customer?.contact && (
                <Text className="text-sm text-gray-500">
                  {order.customer.contact}
                </Text>
              )}
            </View>
          </View>

          {/* Order Items */}
          <View className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <View className="p-4 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">Items</Text>
            </View>

            {order.items && order.items.length > 0 ? (
              <>
                {order.items.map((item, index) => (
                  <View
                    key={item.id}
                    className={`p-4 ${index < order.items!.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <View className="bg-orange-100 w-12 h-12 rounded-lg justify-center items-center mb-2">
                          <Text className="text-orange-600 font-bold">🍵</Text>
                        </View>
                        <Text className="text-base font-medium text-gray-900">
                          {item.menuItem?.name || "Unknown Item"}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          Qty: {item.quantity}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-gray-900">
                          ₹{item.priceAtTime * item.quantity}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          @ ₹{item.priceAtTime} each
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Total */}
                <View className="p-4 bg-gray-50 border-t border-gray-200">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-lg font-semibold text-gray-900">
                      Total
                    </Text>
                    <Text className="text-xl font-bold text-gray-900">
                      ₹{order.total || 0}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View className="p-4">
                <Text className="text-gray-500 text-center">
                  No items found
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
