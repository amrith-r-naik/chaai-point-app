import { advanceService } from "@/services/advanceService";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Height constant for getItemLayout optimization
const LEDGER_ITEM_HEIGHT = 80;

// Type for ledger entries
interface LedgerEntry {
  id: string;
  entryType: string;
  amount: number;
  createdAt: string;
  remarks?: string | null;
}

// Memoized ledger item component with custom comparison
interface LedgerItemProps {
  item: LedgerEntry;
}

const LedgerItem = React.memo<LedgerItemProps>(
  function LedgerItem({ item }) {
    return (
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
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if relevant data changes
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.amount === nextProps.item.amount &&
      prevProps.item.entryType === nextProps.item.entryType
    );
  }
);

export default function AdvanceLedgerModal() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName?: string;
  }>();
  const [rows, setRows] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    (async () => {
      if (!customerId) return;
      const items = await advanceService.getLedger(String(customerId), 200);
      setRows(items);
    })();
  }, [customerId]);

  // Memoized FlatList callbacks
  const renderItem = useCallback(
    ({ item }: { item: LedgerEntry }) => <LedgerItem item={item} />,
    []
  );

  const keyExtractor = useCallback((item: LedgerEntry) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: LEDGER_ITEM_HEIGHT,
      offset: LEDGER_ITEM_HEIGHT * index,
      index,
    }),
    []
  );

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
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
        />
      </SafeAreaView>
    </Modal>
  );
}
