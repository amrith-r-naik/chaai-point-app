// app/(modals)/select-customer.tsx
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import { getAllCustomers } from "../../services/customerService";
import { authState } from "../../state/authState";
import { customerState } from "../../state/customerState";
import { orderState } from "../../state/orderState";

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
      style={{
        backgroundColor: "white",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          backgroundColor: theme.colors.primaryLight,
          borderRadius: 24,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        <Text
          style={{
            color: theme.colors.primary,
            fontWeight: "600",
            fontSize: 18,
          }}
        >
          {customer.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            color: theme.colors.text,
            marginBottom: 2,
          }}
        >
          {customer.name}
        </Text>
        {customer.contact && (
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
            }}
          >
            {customer.contact}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderWidth: 2,
          borderColor: theme.colors.borderLight,
          borderRadius: 16,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            backgroundColor: theme.colors.primary,
            borderRadius: 10,
          }}
        />
      </View>
    </Pressable>
  );
}

export default function SelectCustomerScreen() {
  const router = useRouter();
  const customerStateData = use$(customerState);
  const auth = use$(authState);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (auth.isDbReady) {
      loadCustomers();
    }
  }, [auth.isDbReady]);

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

  const handleSelectCustomer = (customer: Customer) => {
    orderState.selectedCustomerId.set(customer.id);
    router.back();
  };

  const handleAddNewCustomer = () => {
    customerState.selectedCustomer.set(null);
    router.push("/(modals)/customer-form");
  };

  const filteredCustomers = customerStateData.customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.contact && customer.contact.includes(searchQuery))
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Select Customer",
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
        <View style={{ flex: 1 }}>
          {/* Search and Add New Section */}
          <View
            style={{
              backgroundColor: "white",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            {/* Search Bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 16,
              }}
            >
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                placeholder="Search by name or contact"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: theme.colors.text,
                  marginLeft: 12,
                }}
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Recent/Add New Customer */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  fontWeight: "500",
                }}
              >
                {searchQuery ? "Search Results" : "Recent Customers"}
              </Text>
              <TouchableOpacity
                onPress={handleAddNewCustomer}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.colors.primaryLight,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <Plus size={16} color={theme.colors.primary} />
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontWeight: "600",
                    marginLeft: 4,
                    fontSize: 14,
                  }}
                >
                  Add New
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Customer List */}
          <View style={{ flex: 1 }}>
            {customerStateData.loading ? (
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
                    fontSize: 16,
                    color: theme.colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  Loading customers...
                </Text>
              </View>
            ) : filteredCustomers.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 32,
                }}
              >
                <Text style={{ fontSize: 64, marginBottom: 16 }}>👥</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: theme.colors.text,
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  {searchQuery
                    ? "No customers found"
                    : "No customers available"}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary,
                    textAlign: "center",
                    marginBottom: 24,
                    lineHeight: 20,
                  }}
                >
                  {searchQuery
                    ? "Try adjusting your search terms"
                    : "Add your first customer to get started"}
                </Text>
                <TouchableOpacity
                  onPress={handleAddNewCustomer}
                  style={{
                    backgroundColor: theme.colors.primary,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 24,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Plus size={18} color="white" />
                  <Text
                    style={{
                      color: "white",
                      fontWeight: "600",
                      marginLeft: 6,
                      fontSize: 16,
                    }}
                  >
                    Add Customer
                  </Text>
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
                contentContainerStyle={{
                  paddingBottom: 32,
                }}
              />
            )}
          </View>
        </View>
      </View>
    </>
  );
}
