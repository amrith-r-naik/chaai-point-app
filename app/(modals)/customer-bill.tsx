import { theme } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface BillItem {
  id: string;
  menuItemName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

interface Bill {
  billNumber: string;
  customerId: string;
  customerName: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  date: string;
  time: string;
}

export default function CustomerBillScreen() {
  const router = useRouter();
  const { customerId, customerName, date } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
    date: string;
  }>();

  const [isReady, setIsReady] = useState(false);
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Granular state subscription for optimized re-renders
  const isDbReady = use$(authState.isDbReady);

  // Defer heavy rendering until after navigation animation
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  // Server assigns bill number; do not generate locally

  const loadCustomerBill = useCallback(async () => {
    if (!customerId || !isDbReady) return;

    try {
      setLoading(true);
      setError("");

      // Get customer's KOTs for the specific date and generate bill
      const customerKOTs = await orderService.getCustomerKOTsForDate(
        customerId,
        date || new Date().toISOString().split("T")[0],
        true // Only get unbilled orders for billing
      );

      if (customerKOTs.length === 0) {
        setError("No KOTs found for billing");
        return;
      }

      // Consolidate items from all KOTs
      const itemsMap = new Map<string, BillItem>();

      customerKOTs.forEach((kot: any) => {
        kot.items.forEach((item: any) => {
          const key = item.menuItemId;
          if (itemsMap.has(key)) {
            const existing = itemsMap.get(key)!;
            existing.quantity += item.quantity;
            existing.totalPrice += item.totalPrice;
          } else {
            itemsMap.set(key, {
              id: item.id,
              menuItemName: item.menuItemName,
              quantity: item.quantity,
              price: item.price,
              totalPrice: item.totalPrice,
            });
          }
        });
      });

      const consolidatedItems = Array.from(itemsMap.values());
      const subtotal = consolidatedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      // TODO: Calculate tax and discount (you can adjust these rates)
      const taxRate = 0.0; // 5% tax
      const tax = subtotal * taxRate;
      const discount = 0; // No discount for now
      const totalAmount = subtotal + tax - discount;

      const generatedBill: Bill = {
        billNumber: "0",
        customerId,
        customerName: customerName || "Unknown Customer",
        items: consolidatedItems,
        subtotal,
        tax,
        discount,
        totalAmount,
        date: new Date().toLocaleDateString("en-IN"),
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setBill(generatedBill);
    } catch (err: any) {
      setError(err.message || "Failed to generate bill");
      console.error("Error generating bill:", err);
    } finally {
      setLoading(false);
    }
  }, [customerId, customerName, date, isDbReady]);

  // Load data only after screen is ready (after navigation animation)
  useEffect(() => {
    if (isReady) {
      loadCustomerBill();
    }
  }, [isReady, loadCustomerBill]);

  const handlePayment = () => {
    if (!bill) return;

    // Navigate to payment modal with bill details
    router.push({
      pathname: "/(modals)/payment",
      params: {
        billId: bill.billNumber,
        customerId: bill.customerId,
        customerName: bill.customerName,
        totalAmount: bill.totalAmount.toString(),
      },
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Billing",
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
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
            Generating bill...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Billing",
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
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 8,
            }}
          >
            Failed to generate bill
          </Text>
          <Text
            style={{
              color: theme.colors.textSecondary,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {error || "Unable to generate bill"}
          </Text>
          <TouchableOpacity
            onPress={loadCustomerBill}
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Billing",
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

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Bill Header */}
        <View
          style={{
            backgroundColor: "white",
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#f3f4f6",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "700",
                  color: theme.colors.text,
                  marginBottom: 4,
                }}
              >
                Bill No:{" "}
                {bill.billNumber && Number(bill.billNumber) > 0
                  ? bill.billNumber
                  : "—"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 14,
                }}
              >
                {bill.date} {bill.time}
              </Text>
            </View>
          </View>
        </View>

        {/* Bill Items */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          {bill.items.map((item, index) => (
            <View
              key={item.id}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: theme.colors.text,
                    marginBottom: 4,
                  }}
                >
                  {item.menuItemName}
                </Text>
                <View
                  style={{
                    backgroundColor: "#f97316",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    × {item.quantity}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: theme.colors.text,
                }}
              >
                ₹{item.totalPrice}
              </Text>
            </View>
          ))}
        </View>

        {/* Spacer for payment button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Payment Button */}
      <View
        style={{
          backgroundColor: theme.colors.primary,
          marginBottom: 16,
          marginHorizontal: 16,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={handlePayment}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: 20,
            }}
          >
            PAYMENT
          </Text>
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: 20,
            }}
          >
            ₹{Math.round(bill.totalAmount)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
