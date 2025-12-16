import { Button, Loading } from "@/components/ui";
import { theme } from "@/constants/theme";
import { CustomerDue, dueService, DueUpdateData } from "@/services/dueService";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Phone,
  Receipt,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  InteractionManager,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height constant for getItemLayout optimization
const CUSTOMER_DUE_ITEM_HEIGHT = 160;

// Format date helper moved outside component
const formatDueDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Memoized customer item component with custom comparison
interface CustomerDueItemProps {
  item: CustomerDue;
  onPress: (customer: CustomerDue) => void;
}

const CustomerDueItem = React.memo<CustomerDueItemProps>(
  ({ item, onPress }) => (
    <TouchableOpacity
      onPress={() => onPress(item)}
      style={{
        backgroundColor: "white",
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        padding: 16,
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
            <User size={20} color={theme.colors.primary} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
                marginLeft: 8,
                flex: 1,
              }}
            >
              {item.customerName}
            </Text>
          </View>

          {item.customerContact && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Phone size={16} color={theme.colors.textSecondary} />
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginLeft: 8,
                }}
              >
                {item.customerContact}
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Clock size={16} color={theme.colors.textSecondary} />
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginLeft: 8,
              }}
            >
              Last order: {formatDueDate(item.lastOrderDate)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Receipt size={16} color={theme.colors.textSecondary} />
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginLeft: 8,
              }}
            >
              {item.unpaidKots.length} unpaid order
              {item.unpaidKots.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", marginLeft: 16 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: theme.colors.error,
              marginBottom: 8,
            }}
          >
            ₹{item.totalDueAmount.toFixed(2)}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <CreditCard size={14} color="white" />
            <Text
              style={{
                color: "white",
                fontSize: 12,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              Collect
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ),
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if relevant data changes
    return (
      prevProps.item.customerId === nextProps.item.customerId &&
      prevProps.item.totalDueAmount === nextProps.item.totalDueAmount &&
      prevProps.item.unpaidKots.length === nextProps.item.unpaidKots.length &&
      prevProps.item.lastOrderDate === nextProps.item.lastOrderDate
    );
  }
);

interface PaymentModalProps {
  visible: boolean;
  customer: CustomerDue | null;
  onClose: () => void;
  onSubmit: (paymentData: DueUpdateData) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  customer,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");

  const paymentModes = ["Cash", "UPI", "Card", "Bank Transfer"];

  const handleSubmit = () => {
    if (!customer || !amount || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount > customer.totalDueAmount) {
      Alert.alert(
        "Confirm Payment",
        `Payment amount (₹${paymentAmount}) is more than due amount (₹${customer.totalDueAmount}). Extra amount will be treated as advance payment. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => processPayment() },
        ]
      );
      return;
    }

    processPayment();
  };

  const processPayment = () => {
    if (!customer) return;

    onSubmit({
      customerId: customer.customerId,
      amount: parseFloat(amount),
      paymentMode,
      remarks: remarks.trim() || undefined,
    });

    // Reset form
    setAmount("");
    setRemarks("");
    setPaymentMode("Cash");
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!customer) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#f3f4f6",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
            }}
          >
            Collect Payment
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Customer Info */}
          <View
            style={{
              backgroundColor: "#f8fafc",
              margin: 16,
              padding: 16,
              borderRadius: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <User size={20} color={theme.colors.primary} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginLeft: 8,
                }}
              >
                {customer.customerName}
              </Text>
            </View>
            {customer.customerContact && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Phone size={16} color={theme.colors.textSecondary} />
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary,
                    marginLeft: 8,
                  }}
                >
                  {customer.customerContact}
                </Text>
              </View>
            )}
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
                }}
              >
                Total Due Amount
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: theme.colors.error,
                }}
              >
                ₹{customer.totalDueAmount.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Unpaid KOTs */}
          <View style={{ margin: 16 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.colors.text,
                marginBottom: 12,
              }}
            >
              Unpaid Orders ({customer.unpaidKots.length})
            </Text>
            {customer.unpaidKots.map((kot) => (
              <View
                key={kot.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "#f3f4f6",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: theme.colors.text,
                      }}
                    >
                      KOT-{kot.kotNumber}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {formatTime(kot.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: theme.colors.error,
                    }}
                  >
                    ₹{kot.amount.toFixed(2)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {kot.items}
                </Text>
              </View>
            ))}
          </View>

          {/* Payment Form */}
          <View style={{ margin: 16 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.colors.text,
                marginBottom: 16,
              }}
            >
              Payment Details
            </Text>

            {/* Amount Input */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Amount to Collect *
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Enter amount"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: "white",
                }}
              />
            </View>

            {/* Payment Mode */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Payment Mode *
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {paymentModes.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setPaymentMode(mode)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor:
                        paymentMode === mode ? theme.colors.primary : "#d1d5db",
                      backgroundColor:
                        paymentMode === mode ? theme.colors.primary : "white",
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          paymentMode === mode ? "white" : theme.colors.text,
                        fontSize: 14,
                        fontWeight: "500",
                      }}
                    >
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Remarks */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Remarks (Optional)
              </Text>
              <TextInput
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Add payment remarks..."
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  backgroundColor: "white",
                  textAlignVertical: "top",
                }}
              />
            </View>

            {/* Submit Button */}
            <Button
              title="Collect Payment"
              onPress={handleSubmit}
              style={{
                backgroundColor: theme.colors.primary,
                paddingVertical: 16,
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default function DueManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isReady, setIsReady] = useState(false);
  const [customersWithDues, setCustomersWithDues] = useState<CustomerDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalDues, setTotalDues] = useState(0);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDue | null>(
    null
  );

  // Defer heavy rendering until after navigation animation
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  const loadDuesData = useCallback(async () => {
    try {
      setLoading(true);
      const [customers, total] = await Promise.all([
        dueService.getCustomersWithDues(),
        dueService.getTotalPendingDues(),
      ]);
      setCustomersWithDues(customers);
      setTotalDues(total);
    } catch (error) {
      console.error("Error loading dues data:", error);
      Alert.alert("Error", "Failed to load dues data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load data only after screen is ready (after navigation animation)
  useEffect(() => {
    if (isReady) {
      loadDuesData();
    }
  }, [isReady, loadDuesData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDuesData();
  }, [loadDuesData]);

  const handlePaymentSubmit = async (paymentData: DueUpdateData) => {
    try {
      await dueService.processCustomerDuePayment(paymentData);
      setPaymentModalVisible(false);
      setSelectedCustomer(null);
      Alert.alert("Success", "Payment processed successfully", [
        { text: "OK", onPress: loadDuesData },
      ]);
    } catch (error: any) {
      console.error("Error processing payment:", error);
      Alert.alert("Error", error.message || "Failed to process payment");
    }
  };

  // Memoized callbacks for FlatList
  const handleCustomerItemPress = useCallback((customer: CustomerDue) => {
    setSelectedCustomer(customer);
    setPaymentModalVisible(true);
  }, []);

  const renderCustomerItem = useCallback(
    ({ item }: { item: CustomerDue }) => (
      <CustomerDueItem item={item} onPress={handleCustomerItemPress} />
    ),
    [handleCustomerItemPress]
  );

  const keyExtractor = useCallback((item: CustomerDue) => item.customerId, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CUSTOMER_DUE_ITEM_HEIGHT,
      offset: CUSTOMER_DUE_ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loading message="Loading due amounts..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Stack.Screen
        options={{
          title: "Due Management",
          headerStyle: { backgroundColor: "white" },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      <View style={{ flex: 1 }}>
        {/* Summary Header */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingTop: 20,
            paddingBottom: 32,
            paddingHorizontal: 20,
            borderBottomLeftRadius: theme.borderRadius.xl,
            borderBottomRightRadius: theme.borderRadius.xl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <DollarSign size={24} color="white" />
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              Total Pending Dues
            </Text>
          </View>
          <Text
            style={{
              color: "white",
              fontSize: 36,
              fontWeight: "700",
            }}
          >
            ₹{totalDues.toFixed(2)}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            {customersWithDues.length} customer
            {customersWithDues.length !== 1 ? "s" : ""} with pending dues
          </Text>
        </View>

        {/* Customers List */}
        {customersWithDues.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 32,
            }}
          >
            <CheckCircle size={64} color={theme.colors.success} />
            <Text
              style={{
                fontSize: 24,
                fontWeight: "600",
                color: theme.colors.text,
                marginTop: 16,
                textAlign: "center",
              }}
            >
              All Clear!
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: theme.colors.textSecondary,
                marginTop: 8,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              No pending dues found. All customers have cleared their payments.
            </Text>
          </View>
        ) : (
          <FlatList
            data={customersWithDues}
            renderItem={renderCustomerItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            contentContainerStyle={{ paddingVertical: 16 }}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
          />
        )}
      </View>

      {/* Payment Modal */}
      <PaymentModal
        visible={paymentModalVisible}
        customer={selectedCustomer}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedCustomer(null);
        }}
        onSubmit={handlePaymentSubmit}
      />
    </SafeAreaView>
  );
}
