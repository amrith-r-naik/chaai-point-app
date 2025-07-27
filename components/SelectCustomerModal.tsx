// components/SelectCustomerModal.tsx
import { use$ } from "@legendapp/state/react";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getAllCustomers } from "../services/customerService";
import { authState } from "../state/authState";
import { customerState } from "../state/customerState";
import { orderState } from "../state/orderState";

interface Customer {
  id: string;
  name: string;
  contact: string | null | undefined;
}

function CustomerItem({
  customer,
  onSelect,
}: {
  customer: Customer;
  onSelect: (customer: Customer) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(customer)}
      className="bg-white p-4 border-b border-gray-100 flex-row items-center"
    >
      <View className="w-10 h-10 bg-blue-100 rounded-full justify-center items-center mr-3">
        <Text className="text-blue-600 font-semibold text-lg">
          {customer.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">
          {customer.name}
        </Text>
        {customer.contact && (
          <Text className="text-sm text-gray-500">{customer.contact}</Text>
        )}
      </View>
      <View className="w-6 h-6 border-2 border-gray-300 rounded-full justify-center items-center">
        <Text className="text-gray-400">→</Text>
      </View>
    </Pressable>
  );
}

export default function SelectCustomerModal() {
  const orderStateData = use$(orderState);
  const customerStateData = use$(customerState);
  const auth = use$(authState);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (orderStateData.showCustomerModal && auth.isDbReady) {
      loadCustomers();
    }
  }, [orderStateData.showCustomerModal, auth.isDbReady]);

  const loadCustomers = async () => {
    try {
      customerState.loading.set(true);
      const customers = await getAllCustomers();
      customerState.customers.set(customers);
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      customerState.loading.set(false);
    }
  };

  const closeModal = () => {
    orderState.showCustomerModal.set(false);
    setSearchQuery("");
  };

  const handleSelectCustomer = (customer: Customer) => {
    orderState.selectedCustomerId.set(customer.id);
    closeModal();
  };

  const handleAddNewCustomer = () => {
    customerState.showAddModal.set(true);
    customerState.selectedCustomer.set(null);
  };

  const filteredCustomers = customerStateData.customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.contact && customer.contact.includes(searchQuery))
  );

  return (
    <Modal
      visible={orderStateData.showCustomerModal}
      animationType="slide"
      transparent={false}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white px-4 py-3 border-b border-gray-200">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={closeModal} className="mr-3 p-1">
              <Text className="text-xl">←</Text>
            </TouchableOpacity>
            <Text className="text-xl font-semibold text-gray-900 flex-1">
              Select Customer
            </Text>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center mb-3">
            <View className="flex-1 bg-gray-100 rounded-lg px-3 py-2 mr-3">
              <TextInput
                placeholder="Type name to search"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="text-base text-gray-900"
              />
            </View>
            <TouchableOpacity className="p-2">
              <Text className="text-gray-400">🔍</Text>
            </TouchableOpacity>
          </View>

          {/* Recent/Add New Customer */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-600">Recent</Text>
            <TouchableOpacity
              onPress={handleAddNewCustomer}
              className="flex-row items-center"
            >
              <Text className="text-blue-600 font-medium mr-1">
                Add new customer
              </Text>
              <Text className="text-blue-600">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer List */}
        <View className="flex-1">
          {customerStateData.loading ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-gray-500">Loading customers...</Text>
            </View>
          ) : filteredCustomers.length === 0 ? (
            <View className="flex-1 justify-center items-center px-4">
              <Text className="text-gray-500 text-center">
                {searchQuery ? "No customers found" : "No customers available"}
              </Text>
              <TouchableOpacity
                onPress={handleAddNewCustomer}
                className="bg-blue-500 px-4 py-2 rounded-lg mt-4"
              >
                <Text className="text-white font-medium">Add New Customer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CustomerItem
                  customer={item as Customer}
                  onSelect={handleSelectCustomer}
                />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
