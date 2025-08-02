import { orderService } from "@/services/orderService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const auth = use$(authState);

  const generateBillNumber = () => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const timeStr = now.getTime().toString().slice(-4);
    return `B${dateStr}${timeStr}`;
  };

  const loadCustomerBill = useCallback(async () => {
    if (!customerId || !auth.isDbReady) return;

    try {
      setLoading(true);
      setError("");

      // Get customer's KOTs for the specific date and generate bill
      const customerKOTs = await orderService.getCustomerKOTsForDate(
        customerId,
        date || new Date().toISOString().split("T")[0]
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

      // Calculate tax and discount (you can adjust these rates)
      const taxRate = 0.05; // 5% tax
      const tax = subtotal * taxRate;
      const discount = 0; // No discount for now
      const totalAmount = subtotal + tax - discount;

      const generatedBill: Bill = {
        billNumber: generateBillNumber(),
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
  }, [customerId, customerName, date, auth.isDbReady]);

  useEffect(() => {
    loadCustomerBill();
  }, [loadCustomerBill]);

  const handlePayment = () => {
    if (!bill) return;

    // TODO: Navigate to payment screen with bill details
    // For now, just go back to the customers screen
    router.push("/(tabs)/customers");

    /* 
    router.push({
      pathname: "/(modals)/payment",
      params: {
        billId: bill.billNumber,
        customerId: bill.customerId,
        customerName: bill.customerName,
        totalAmount: bill.totalAmount.toString(),
      },
    });
    */
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 mt-2">Generating bill...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !bill) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-6xl mb-4">⚠️</Text>
          <Text className="text-xl font-semibold text-gray-700 mb-2">
            Failed to generate bill
          </Text>
          <Text className="text-gray-500 text-center mb-4">
            {error || "Unable to generate bill"}
          </Text>
          <TouchableOpacity
            onPress={loadCustomerBill}
            className="bg-blue-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-200">
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2"
          >
            <Text className="text-gray-600 text-xl">←</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Billing</Text>
            <Text className="text-gray-500 text-sm mt-1">
              Bill No: {bill.billNumber}
            </Text>
          </View>
        </View>
      </View>

      {/* Bill Content */}
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="bg-white mx-4 mt-4 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Bill Header */}
          <View className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <View className="items-center mb-4">
              <Text className="text-2xl font-bold text-gray-900">
                CHAI POINT
              </Text>
              <Text className="text-gray-600 text-sm">
                Your Neighborhood Tea Shop
              </Text>
            </View>

            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-gray-700 font-medium">Bill To:</Text>
                <Text className="text-gray-900 font-semibold text-lg">
                  {bill.customerName}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-700 font-medium">Bill No:</Text>
                <Text className="text-gray-900 font-semibold">
                  {bill.billNumber}
                </Text>
                <Text className="text-gray-500 text-sm mt-1">
                  {bill.date} • {bill.time}
                </Text>
              </View>
            </View>
          </View>

          {/* Bill Items */}
          <View className="px-6 py-4">
            <View className="flex-row py-2 border-b border-gray-200">
              <Text className="flex-1 text-gray-700 font-medium">Item</Text>
              <Text className="w-16 text-center text-gray-700 font-medium">
                Qty
              </Text>
              <Text className="w-20 text-right text-gray-700 font-medium">
                Rate
              </Text>
              <Text className="w-20 text-right text-gray-700 font-medium">
                Amount
              </Text>
            </View>

            {bill.items.map((item, index) => (
              <View
                key={item.id}
                className={`flex-row py-3 ${
                  index < bill.items.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <Text className="flex-1 text-gray-900">
                  {item.menuItemName}
                </Text>
                <Text className="w-16 text-center text-gray-900">
                  {item.quantity}
                </Text>
                <Text className="w-20 text-right text-gray-900">
                  ₹{item.price}
                </Text>
                <Text className="w-20 text-right text-gray-900 font-medium">
                  ₹{item.totalPrice}
                </Text>
              </View>
            ))}
          </View>

          {/* Bill Summary */}
          <View className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <View className="space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-700">Subtotal</Text>
                <Text className="text-gray-900">
                  ₹{bill.subtotal.toFixed(2)}
                </Text>
              </View>

              {bill.tax > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-gray-700">Tax (5%)</Text>
                  <Text className="text-gray-900">₹{bill.tax.toFixed(2)}</Text>
                </View>
              )}

              {bill.discount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-gray-700">Discount</Text>
                  <Text className="text-red-600">
                    -₹{bill.discount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between pt-2 border-t border-gray-300">
                <Text className="text-lg font-bold text-gray-900">Total</Text>
                <Text className="text-lg font-bold text-gray-900">
                  ₹{bill.totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Thank You Note */}
          <View className="px-6 py-4 text-center border-t border-gray-200">
            <Text className="text-gray-600 text-sm text-center">
              Thank you for visiting Chai Point!
            </Text>
            <Text className="text-gray-500 text-xs text-center mt-1">
              Have a great day! ☕
            </Text>
          </View>
        </View>

        {/* Spacer for button */}
        <View className="h-20" />
      </ScrollView>

      {/* Payment Button */}
      <View className="bg-white border-t border-gray-200 px-4 py-4">
        <TouchableOpacity
          onPress={handlePayment}
          className="bg-green-600 py-4 rounded-lg flex-row items-center justify-center"
        >
          <Text className="text-white font-semibold text-lg mr-2">PAYMENT</Text>
          <Text className="text-white font-bold text-lg">
            ₹{bill.totalAmount.toFixed(0)}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
