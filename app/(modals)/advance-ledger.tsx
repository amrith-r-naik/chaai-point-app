import { advanceService } from "@/services/advanceService";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdvanceLedgerModal() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName?: string;
  }>();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!customerId) return;
      const items = await advanceService.getLedger(String(customerId), 200);
      setRows(items);
    })();
  }, [customerId]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: "white",
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8, borderRadius: 8, backgroundColor: "#f1f5f9" }}
          >
            <ArrowLeft size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }}>
            Advance Ledger {customerName ? `- ${customerName}` : ""}
          </Text>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            >
              <Text style={{ fontWeight: "800" }}>
                {item.entryType} ₹{item.amount}
              </Text>
              <Text style={{ color: "#64748b", fontSize: 12 }}>
                {new Date(item.createdAt).toLocaleString("en-IN")}
              </Text>
              {item.remarks ? (
                <Text style={{ marginTop: 6 }}>{item.remarks}</Text>
              ) : null}
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
