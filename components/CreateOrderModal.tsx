// components/CreateOrderModal.tsx
import { use$ } from "@legendapp/state/react";
import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { orderService } from "../services/orderService";
import { customerState } from "../state/customerState";
import { orderState } from "../state/orderState";

export default function CreateOrderModal() {
  const orderStateData = use$(orderState);
  const customerStateData = use$(customerState);

  const closeModal = () => {
    orderState.showCreateOrderModal.set(false);
    orderState.selectedCustomerId.set(null);
    orderState.selectedItems.set([]);
  };

  const handleSelectCustomer = () => {
    orderState.showCustomerModal.set(true);
  };

  const handleAddItems = () => {
    orderState.showItemsModal.set(true);
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

      // Close modal
      closeModal();
    } catch (error) {
      console.error("Error creating order:", error);
      orderState.error.set("Failed to create order");
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
    <Modal
      visible={orderStateData.showCreateOrderModal}
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
            New Order
          </Text>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {/* Customer Section */}
          <View className="bg-white p-4 rounded-lg border border-gray-200 mb-4 shadow-sm">
            <Text className="text-sm text-gray-600 mb-3">Customer</Text>

            <TouchableOpacity
              onPress={handleSelectCustomer}
              className="border border-gray-300 rounded-lg p-3 flex-row justify-between items-center"
            >
              {selectedCustomer ? (
                <View>
                  <Text className="text-base font-medium text-gray-900">
                    {selectedCustomer.name}
                  </Text>
                  {selectedCustomer.contact && (
                    <Text className="text-sm text-gray-500">
                      {selectedCustomer.contact}
                    </Text>
                  )}
                </View>
              ) : (
                <Text className="text-gray-500">Select Customer</Text>
              )}
              <Text className="text-gray-400">→</Text>
            </TouchableOpacity>
          </View>

          {/* Items Section */}
          <View className="bg-white p-4 rounded-lg border border-gray-200 mb-4 shadow-sm">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm text-gray-600">Items</Text>
              <TouchableOpacity
                onPress={handleAddItems}
                className="flex-row items-center"
              >
                <Text className="text-blue-600 font-medium mr-1">
                  Add Items
                </Text>
                <Text className="text-blue-600">+</Text>
              </TouchableOpacity>
            </View>

            {orderStateData.selectedItems.length > 0 ? (
              <>
                {orderStateData.selectedItems.map((selectedItem, index) => (
                  <View
                    key={`${selectedItem.item.id}-${index}`}
                    className="border-b border-gray-100 py-3 last:border-b-0"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-base font-medium text-gray-900">
                          {selectedItem.item.name}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          Qty: {selectedItem.quantity} × ₹
                          {selectedItem.item.price}
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-gray-900">
                        ₹{selectedItem.item.price * selectedItem.quantity}
                      </Text>
                    </View>
                  </View>
                ))}

                <View className="border-t border-gray-200 pt-3 mt-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-base font-semibold text-gray-900">
                      Total
                    </Text>
                    <Text className="text-lg font-bold text-gray-900">
                      ₹{totalAmount}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View className="py-8">
                <Text className="text-gray-500 text-center">
                  No items selected
                </Text>
                <Text className="text-sm text-gray-400 text-center mt-1">
                  Tap &quot;Add Items&quot; to get started
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View className="bg-white p-4 border-t border-gray-200">
          <TouchableOpacity
            onPress={handlePlaceOrder}
            disabled={
              !selectedCustomer ||
              orderStateData.selectedItems.length === 0 ||
              orderStateData.isCreatingOrder
            }
            className={`py-4 rounded-lg ${
              selectedCustomer &&
              orderStateData.selectedItems.length > 0 &&
              !orderStateData.isCreatingOrder
                ? "bg-black"
                : "bg-gray-300"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                selectedCustomer &&
                orderStateData.selectedItems.length > 0 &&
                !orderStateData.isCreatingOrder
                  ? "text-white"
                  : "text-gray-500"
              }`}
            >
              {orderStateData.isCreatingOrder
                ? "Placing Order..."
                : "Place Order"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
