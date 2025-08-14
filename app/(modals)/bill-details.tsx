import { theme } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { orderState } from "@/state/orderState";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Calendar } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function BillDetailsModal() {
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<{
    id: string; billNumber: number; customerId: string; customerName: string; total: number; createdAt: string;
  } | null>(null);
  const [kots, setKots] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    setError("");
    try {
      const b = await orderService.getBillById(billId);
      if (!b) {
        setError("Bill not found");
        return;
      }
      setBill(b);
      const list = await orderService.getKOTsForBill(billId);
      setKots(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useEffect(() => { load(); }, [load]);

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" });
  const currency = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

  const openKot = async (kotId: string) => {
    try {
      // Reuse existing order-details modal: populate orderState and navigate
      const full = await orderService.getOrderById(kotId);
      if (full) {
        orderState.selectedOrder.set(full as any);
        router.push("/(modals)/order-details");
      }
    } catch { }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Bill Details",
          headerStyle: { backgroundColor: "white" },
          headerTitleStyle: { fontSize: 18, fontWeight: "600", color: theme.colors.text },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}>
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
          <Text style={{ fontSize: 18, color: theme.colors.text, fontWeight: "600", marginBottom: 8 }}>Unable to load</Text>
          <Text style={{ color: theme.colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : !bill ? null : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Bill header */}
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#f3f4f6" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>Bill #{bill.billNumber}</Text>
                <Text style={{ marginTop: 6, color: theme.colors.textSecondary }}>{bill.customerName}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={16} color={theme.colors.textSecondary} />
                <Text style={{ marginLeft: 6, color: theme.colors.textSecondary }}>{formatDateTime(bill.createdAt)}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: "600" }}>Total</Text>
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 20 }}>{currency(bill.total)}</Text>
            </View>
          </View>

          {/* KOT list */}
          <View style={{ backgroundColor: "white", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#f3f4f6" }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.text }}>KOTs in this Bill</Text>
            </View>
            {kots.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: theme.colors.textSecondary }}>No KOTs linked</Text>
              </View>
            ) : (
              kots.map((kot, idx) => (
                <TouchableOpacity key={kot.id} onPress={() => openKot(kot.id)} style={{ padding: 16, borderBottomWidth: idx < kots.length - 1 ? 1 : 0, borderBottomColor: "#f3f4f6" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ fontWeight: "700", color: theme.colors.text }}>KOT-{kot.kotNumber}</Text>
                      <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{formatDateTime(kot.createdAt)}</Text>
                    </View>
                    <Text style={{ fontWeight: "800", color: theme.colors.text }}>{currency(kot.totalAmount)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}
