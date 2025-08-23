import { theme } from "@/constants/theme";
import { paymentService } from "@/services/paymentService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  History,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface CustomerStats {
  totalBilled: number;
  billCount: number;
  creditBalance: number;
  lastBillAt: string | null;
}

export default function CustomerDetailsScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
  }>();

  const [billHistory, setBillHistory] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const auth = use$(authState);

  const loadCustomerData = useCallback(async () => {
    if (!customerId || !auth.isDbReady) return;

    try {
      setLoading(true);
      const creditBalance =
        await paymentService.getCustomerCreditBalance(customerId);
      const bills =
        await paymentService.getCustomerBillsWithPayments(customerId);
      const paymentRows = await paymentService.getPaymentHistory(customerId);
      const totalBilled = bills.reduce((s: number, b: any) => s + b.total, 0);
      const billCount = bills.length;
      const lastBillAt = bills[0]?.createdAt || null;
      setStats({ totalBilled, billCount, creditBalance, lastBillAt });
      setBillHistory(bills);
      setPaymentHistory(paymentRows);
    } catch (error) {
      console.error("Error loading customer data:", error);
      Alert.alert("Error", "Failed to load customer data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId, auth.isDbReady]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Removed per-order filtering for minimal version

  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomerData();
  };

  const handleCreditClearance = () => {
    if (!stats || stats.creditBalance <= 0) {
      Alert.alert("No Credit", "Nothing to clear.");
      return;
    }
    // Reuse the payment screen in clearance mode; allow partial via split
    router.push({
      pathname: "/(modals)/payment",
      params: {
        billId: "nil",
        customerId,
        customerName,
        totalAmount: String(stats.creditBalance),
        clearance: "1",
      },
    });
  };

  const handleCreateOrder = () => {
    // Navigate to create-order with this customer pre-selected
    router.push({
      pathname: "/(modals)/create-order",
      params: { customerId: String(customerId) },
    });
  };

  // removed unused helpers

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const getCustomerInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderBillRow = (bill: any) => {
    const status = bill.status as "Paid" | "Partial" | "Credit";
    const colorMap: any = {
      Paid: ["#dcfce7", "#16a34a"],
      Partial: ["#fef3c7", "#d97706"],
      Credit: ["#fee2e2", "#dc2626"],
    };
    const [bg, textColor] = colorMap[status] || ["#f3f4f6", "#374151"];
    const canOpen = true; // Always open bill details modal
    const onPress = async () => {
      // Open bill details modal listing KOTs; from there user can open KOT description
      router.push({
        pathname: "/(modals)/bill-details",
        params: { billId: bill.id || bill.billId } as any,
      });
    };
    return (
      <TouchableOpacity
        key={bill.id}
        activeOpacity={canOpen ? 0.7 : 1}
        onPress={onPress}
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
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
            <Text style={{ fontWeight: "700", color: theme.colors.text }}>
              Bill #{bill.billNumber}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
                marginTop: 2,
              }}
            >
              {formatDate(bill.createdAt)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View
              style={{
                backgroundColor: bg,
                paddingHorizontal: 10,
                paddingVertical: 2,
                borderRadius: 12,
                marginBottom: 6,
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: textColor }}
              >
                {status}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: theme.colors.text,
              }}
            >
              {formatCurrency(bill.total)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPaymentRow = (p: any) => {
    const isCreditAccrual = p.mode === "Credit" && p.subType === "Accrual"; // pure credit sale
    const isCreditClear = p.subType === "Clearance"; // clearance receipt
    const bg = isCreditAccrual ? "#fef3c7" : "#ecfeff";
    const chipColor = isCreditAccrual
      ? "#b45309"
      : isCreditClear
        ? "#166534"
        : "#2563eb";
    const canOpen = !isCreditAccrual; // open for non pure-credit
    const onPress = async () => {
      if (!canOpen) return;
      // For bill payments, open the bill's receipt
      if (p.billId) {
        const receiptId = await paymentService.getReceiptIdForBill(p.billId);
        if (receiptId)
          router.push({
            pathname: "/(modals)/receipt-details",
            params: { receiptId },
          });
        return;
      }
      // For clearance (no billId), open nearest clearance receipt
      const receiptId = await paymentService.getNearestClearanceReceiptId(
        p.customerId,
        p.createdAt
      );
      if (receiptId)
        router.push({
          pathname: "/(modals)/receipt-details",
          params: { receiptId },
        });
    };
    return (
      <TouchableOpacity
        key={p.id}
        activeOpacity={canOpen ? 0.7 : 1}
        onPress={onPress}
        style={{
          backgroundColor: "white",
          borderRadius: 10,
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
            <Text style={{ fontWeight: "700", color: theme.colors.text }}>
              {p.mode} ₹{p.amount}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
                marginTop: 2,
              }}
            >
              {formatDate(p.createdAt)}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: bg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: chipColor }}>
              {isCreditAccrual
                ? "Accrual"
                : isCreditClear
                  ? "Clearance"
                  : "Payment"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Filter buttons removed

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading customer details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingTop: 20,
            paddingBottom: 40,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 8,
                marginRight: 8,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            >
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontWeight: "bold",
                }}
              >
                {customerName}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                  marginTop: 2,
                }}
              >
                {stats?.billCount || 0} bill(s)
              </Text>
            </View>
          </View>

          {/* Customer Avatar */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "rgba(255,255,255,0.2)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
                borderWidth: 3,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <Text
                style={{ color: "white", fontSize: 28, fontWeight: "bold" }}
              >
                {getCustomerInitials(customerName || "Unknown")}
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
              onPress={handleCreateOrder}
            >
              <Plus size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600" }}>
                New Order
              </Text>
            </TouchableOpacity>

            {stats && stats.creditBalance > 0 && (
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={handleCreditClearance}
              >
                <CreditCard size={20} color={theme.colors.primary} />
                <Text
                  style={{ color: theme.colors.primary, fontWeight: "600" }}
                >
                  Clear Credit
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Cards */}
        <View style={{ paddingHorizontal: 20, marginTop: -20 }}>
          {/* Credit Balance Alert */}
          {stats && stats.creditBalance > 0 && (
            <View
              style={{
                backgroundColor: "#fef3c7",
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderLeftWidth: 4,
                borderLeftColor: "#d97706",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Wallet size={24} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#92400e",
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    Outstanding Credit
                  </Text>
                  <Text
                    style={{
                      color: "#d97706",
                      fontSize: 24,
                      fontWeight: "bold",
                    }}
                  >
                    {formatCurrency(stats.creditBalance)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCreditClearance}
                  style={{
                    backgroundColor: "#d97706",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{ color: "white", fontWeight: "600", fontSize: 12 }}
                  >
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Overview Stats */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 16,
                color: theme.colors.text,
              }}
            >
              Summary
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Bills
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: theme.colors.text,
                  }}
                >
                  {stats?.billCount || 0}
                </Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Total Billed
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: theme.colors.text,
                  }}
                >
                  {formatCurrency(stats?.totalBilled || 0)}
                </Text>
              </View>
            </View>

            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              Last Bill:{" "}
              {stats?.lastBillAt ? formatDate(stats.lastBillAt) : "—"}
            </Text>
          </View>

          {/* Filters removed */}

          {/* Bill History */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <History size={20} color={theme.colors.text} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: theme.colors.text,
                }}
              >
                Bill History
              </Text>
            </View>
            {billHistory.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Receipt size={48} color={theme.colors.textSecondary} />
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  No bills for this customer
                </Text>
              </View>
            ) : (
              <View>{billHistory.slice(0, 10).map(renderBillRow)}</View>
            )}
          </View>

          {/* Payment History */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 20,
              marginBottom: 40,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <DollarSign size={20} color={theme.colors.text} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: theme.colors.text,
                }}
              >
                Payment History
              </Text>
            </View>
            {paymentHistory.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text style={{ color: theme.colors.textSecondary }}>
                  No payments yet
                </Text>
              </View>
            ) : (
              <View>{paymentHistory.slice(0, 15).map(renderPaymentRow)}</View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
