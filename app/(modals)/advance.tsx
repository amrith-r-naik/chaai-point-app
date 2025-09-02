import { theme } from "@/constants/theme";
import { advanceService } from "@/services/advanceService";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Plus, RotateCcw, Wallet } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Mode = "add" | "apply" | "refund";

export default function AdvanceModal() {
  const { customerId, customerName, mode } = useLocalSearchParams<{
    customerId: string;
    customerName?: string;
    mode?: Mode;
  }>();
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const activeMode: Mode = (mode as Mode) || "add";

  useEffect(() => {
    (async () => {
      if (!customerId) return;
      try {
        const b = await advanceService.getBalance(String(customerId));
        setBalance(b);
      } catch {}
    })();
  }, [customerId]);

  const onClose = () => router.back();

  const submit = async () => {
    if (!customerId) return;
    const n = Math.round(Number(amount));
    if (!n || n <= 0 || !Number.isFinite(n)) {
      Alert.alert("Invalid amount", "Enter a positive amount.");
      return;
    }
    setSubmitting(true);
    try {
      if (activeMode === "add") {
        await advanceService.addAdvance(String(customerId), n, {
          remarks: remarks || undefined,
        });
      } else if (activeMode === "apply") {
        await advanceService.applyAdvance(String(customerId), n, {
          remarks: remarks || undefined,
        });
      } else {
        await advanceService.refundAdvance(String(customerId), n, {
          remarks: remarks || undefined,
        });
      }
      Alert.alert("Success", `Advance ${activeMode} recorded`);
      onClose();
    } catch (e: any) {
      Alert.alert("Error", String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const header =
    activeMode === "add"
      ? "Add Advance"
      : activeMode === "apply"
        ? "Use Advance"
        : "Refund Advance";
  const ActionIcon =
    activeMode === "add" ? Plus : activeMode === "apply" ? Wallet : RotateCcw;
  const primaryColor =
    activeMode === "refund" ? "#dc2626" : theme.colors.primary;

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
            onPress={onClose}
            style={{ padding: 8, borderRadius: 8, backgroundColor: "#f1f5f9" }}
          >
            <ArrowLeft size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }}>
            {header}
          </Text>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {customerName ? (
            <Text style={{ color: "#334155" }}>
              Customer:{" "}
              <Text style={{ fontWeight: "700" }}>{customerName}</Text>
            </Text>
          ) : null}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <Text style={{ color: "#64748b", marginBottom: 6 }}>
              Amount (₹)
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              inputMode="numeric"
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
              }}
            />
            <Text style={{ color: "#64748b", marginTop: 12, marginBottom: 6 }}>
              Remarks (optional)
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Reason or note"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
              }}
            />
          </View>
          <View
            style={{
              backgroundColor: "#fff7ed",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "#fed7aa",
            }}
          >
            <Text style={{ color: "#9a3412" }}>
              Current advance balance:{" "}
              <Text style={{ fontWeight: "800" }}>
                ₹{(balance ?? 0).toLocaleString("en-IN")}
              </Text>
            </Text>
            {activeMode !== "add" ? (
              <Text style={{ color: "#9a3412", marginTop: 6, fontSize: 12 }}>
                {activeMode === "apply"
                  ? "Using advance only records a ledger entry in this phase. It does not attach to a bill."
                  : "Refund reduces customer advance balance."}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            marginTop: "auto",
            padding: 16,
            backgroundColor: "white",
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
          }}
        >
          <TouchableOpacity
            disabled={submitting}
            onPress={submit}
            style={{
              backgroundColor: primaryColor,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <ActionIcon color="#fff" size={18} />
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
              {header}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
