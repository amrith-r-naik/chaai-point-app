import { Customer, deleteCustomer } from "@/services/customerService";
import {
  customerState,
  setSelectedCustomer,
  toggleEditModal,
} from "@/state/customerState";
import React from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface CustomerListProps {
  customers: Customer[];
  onRefresh: () => void;
  refreshing?: boolean;
  onRefreshAction?: () => void;
}

export default function CustomerList({
  customers,
  onRefresh,
  refreshing = false,
  onRefreshAction,
}: CustomerListProps) {
  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    toggleEditModal();
  };

  const handleDelete = (customer: Customer) => {
    Alert.alert(
      "Delete Customer",
      `Are you sure you want to delete "${customer.name}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              customerState.loading.set(true);
              await deleteCustomer(customer.id);
              onRefresh();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to delete customer"
              );
            } finally {
              customerState.loading.set(false);
            }
          },
        },
      ]
    );
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <View className="bg-white mx-4 mb-3 p-4 rounded-lg shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-800 mb-1">
            {item.name}
          </Text>
          {item.contact && (
            <Text className="text-sm text-gray-600 mb-2">
              📞 {item.contact}
            </Text>
          )}
          <Text className="text-xs text-gray-400">
            Added: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            className="bg-blue-100 px-3 py-2 rounded-lg"
          >
            <Text className="text-blue-600 font-medium text-sm">Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="bg-red-100 px-3 py-2 rounded-lg"
          >
            <Text className="text-red-600 font-medium text-sm">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (customers.length === 0) {
    return (
      <View className="flex-1 justify-center items-center px-4">
        <Text className="text-6xl mb-4">👥</Text>
        <Text className="text-xl font-semibold text-gray-700 mb-2">
          No customers yet
        </Text>
        <Text className="text-gray-500 text-center">
          Add your first customer to get started with orders and billing
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={customers}
      renderItem={renderCustomerItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingVertical: 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefreshAction ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshAction} />
        ) : undefined
      }
    />
  );
}
