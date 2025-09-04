import { theme } from "@/constants/theme";
import { expenseService } from "@/services/expenseService";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ExpenseDetailsModalProps {
  visible: boolean;
  expenseId: string | null;
  onClose: () => void;
}

export default function ExpenseDetailsModal({
  visible,
  expenseId,
  onClose,
}: ExpenseDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Awaited<
    ReturnType<typeof expenseService.getExpense>
  > | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!visible || !expenseId) return;
      setLoading(true);
      setError(null);
      try {
        const d = await expenseService.getExpense(expenseId);
        setDetails(d);
      } catch (e: any) {
        setError(e?.message || "Failed to load expense details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [visible, expenseId]);

  const formatCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: "white",
            borderBottomWidth: 1,
            borderBottomColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
            Expense Details
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ padding: 8, borderRadius: 8, backgroundColor: "#F3F4F6" }}
          >
            <X size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={{ padding: 20 }}>
            <Text style={{ color: "#B91C1C" }}>{error}</Text>
          </View>
        ) : details ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Top summary */}
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                {details.towards}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 4 }}>
                Voucher #{details.voucherNo}
              </Text>
              <Text style={{ color: "#111827", fontWeight: "800", marginTop: 8 }}>
                Amount: {formatCurrency(details.amount)}
              </Text>
              {details.creditOutstanding > 0 && (
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 8,
                    backgroundColor: "#FEE2E2",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#B91C1C", fontWeight: "700", fontSize: 12 }}>
                    Due: {formatCurrency(details.creditOutstanding)}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                <View style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>{details.status}</Text>
                </View>
                <View style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Mode: {details.mode}</Text>
                </View>
              </View>
              <Text style={{ color: "#6B7280", marginTop: 8, fontSize: 12 }}>
                Expense Date: {new Date(details.expenseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 4, fontSize: 12 }}>
                Created: {fmtDate(details.createdAt)}
              </Text>
            </View>

            {/* Split breakdown */}
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 }}>
                Payments
              </Text>
              {details.settlements.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>No payments recorded.</Text>
              ) : (
                <View>
                  {details.settlements.map((s) => (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: "#F3F4F6",
                      }}
                    >
                      <View>
                        <Text style={{ fontWeight: "700", color: "#111827" }}>
                          {s.paymentType}
                          {s.subType ? ` · ${s.subType}` : ""}
                        </Text>
                        <Text style={{ color: "#6B7280", fontSize: 12 }}>
                          {fmtDate(s.createdAt)}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: "800", color: "#111827" }}>
                        {formatCurrency(s.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Totals removed as per request */}
            </View>

            {/* Notes */}
            {details.remarks ? (
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 }}>
                  Remarks
                </Text>
                <Text style={{ color: "#374151" }}>{details.remarks}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
