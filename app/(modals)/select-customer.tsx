// app/(modals)/select-customer.tsx
import { use$ } from "@legendapp/state/react";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  InteractionManager,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import { Customer, getAllCustomers } from "../../services/customerService";
import { authState } from "../../state/authState";
import { customerState } from "../../state/customerState";
import { orderState } from "../../state/orderState";

// Using Customer type from service for consistency

function CustomerItem({
  customer,
  onSelect,
  isSelected,
}: {
  customer: Customer;
  onSelect: (customer: Customer) => void;
  isSelected: boolean;
}) {
  const getAvatarColor = (name: string): string => {
    const colors = [
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#eab308",
      "#84cc16",
      "#22c55e",
      "#10b981",
      "#14b8a6",
      "#06b6d4",
      "#0ea5e9",
      "#3b82f6",
      "#6366f1",
      "#8b5cf6",
      "#a855f7",
      "#d946ef",
      "#ec4899",
      "#f43f5e",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getCustomerInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
          backgroundColor: getAvatarColor(customer.name),
          borderRadius: 24,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "600",
            fontSize: 18,
          }}
        >
          {getCustomerInitials(customer.name)}
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
      {isSelected ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: theme.colors.primary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            ✓
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function SelectCustomerScreen() {
  const router = useRouter();
  const customerStateData = use$(customerState);
  const auth = use$(authState);
  const order$ = use$(orderState);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (auth.isDbReady) {
      const task = InteractionManager.runAfterInteractions(() => {
        loadCustomers();
      });
      return () => task?.cancel?.();
    }
  }, [auth.isDbReady]);

  // Reload customers when screen comes back into focus (e.g., after adding a new customer)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (auth.isDbReady) {
        const task = InteractionManager.runAfterInteractions(() => {
          if (!cancelled) loadCustomers();
        });
        return () => {
          cancelled = true;
          task?.cancel?.();
        };
      }
      return () => {};
    }, [auth.isDbReady])
  );

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
              <FlatList<Customer>
                data={filteredCustomers}
                keyExtractor={(item: Customer) => item.id}
                renderItem={({ item }: { item: Customer }) => (
                  <CustomerItem
                    customer={item}
                    onSelect={handleSelectCustomer}
                    isSelected={order$.selectedCustomerId === item.id}
                  />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: 32,
                }}
                // Performance tuning
                initialNumToRender={12}
                windowSize={10}
                maxToRenderPerBatch={12}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews
              />
            )}
          </View>
        </View>
      </View>
    </>
  );
}
