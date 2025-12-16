import AddExpenseModal from "@/app/(modals)/add-expense";
import { ListItemSkeleton, Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import { useFocusRefresh } from "@/hooks/useFocusRefresh";
import {
  dashboardService,
  DateFilterOptions,
  ExpenseListItem,
} from "@/services/dashboardService";
import { expenseService } from "@/services/expenseService";
import { appEvents } from "@/state/appEvents";
import { use$ } from "@legendapp/state/react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Activity,
  Calendar,
  DollarSign,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import ExpenseDetailsModal from "@/app/(modals)/expense-details";
import { useScreenPerformance } from "@/hooks/useScreenPerformance";
import { formatCurrency, getCurrencyFontSize } from "@/utils/currency";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExpenseItem } from "../../components/expenses/ExpenseItem";

// Dimensions not used currently

const styles = StyleSheet.create({
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  primaryActionButton: {
    backgroundColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "auto",
    gap: 6,
  },
});

// Memoized StatCard to prevent re-renders when parent state changes
interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  color: string;
  backgroundColor: string;
  onPress?: () => void;
}

const StatCard = React.memo<StatCardProps>(
  function StatCard({
    icon,
    title,
    value,
    trend,
    color,
    backgroundColor,
    onPress,
  }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        style={{
          backgroundColor: "white",
          padding: 20,
          borderRadius: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 6,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#F8FAFC",
        }}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 56,
                height: 56,
                backgroundColor: backgroundColor,
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              {icon}
            </View>
            <View style={{ flex: 1 }}>
              <Typography
                variant="caption"
                color="textSecondary"
                weight="medium"
                style={{ marginBottom: 4, fontSize: 12 }}
              >
                {title}
              </Typography>
              <Typography
                variant="h3"
                weight="bold"
                style={{
                  color: color,
                  fontSize: getCurrencyFontSize(
                    parseFloat(value.replace(/[^\d.-]/g, "")),
                    22
                  ),
                  lineHeight: 28,
                }}
              >
                {value}
              </Typography>
            </View>
          </View>
          {trend && (
            <View
              style={{
                backgroundColor:
                  trend === "up"
                    ? "#FEF3C7"
                    : trend === "down"
                      ? "#FEE2E2"
                      : "#F3F4F6",
                padding: 8,
                borderRadius: 12,
              }}
            >
              {trend === "up" && <TrendingUp size={16} color="#D97706" />}
              {trend === "down" && <TrendingDown size={16} color="#DC2626" />}
              {trend === "neutral" && <Activity size={16} color="#6B7280" />}
            </View>
          )}
          {onPress && (
            <View
              style={{
                backgroundColor: color,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                marginLeft: 12,
              }}
            >
              <Typography
                style={{ color: "white", fontWeight: "600", fontSize: 12 }}
              >
                Manage
              </Typography>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if display data changes
    return (
      prevProps.title === nextProps.title &&
      prevProps.value === nextProps.value &&
      prevProps.color === nextProps.color &&
      prevProps.backgroundColor === nextProps.backgroundColor &&
      prevProps.trend === nextProps.trend
    );
  }
);

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const ev = use$(appEvents);

  // Track screen performance
  useScreenPerformance("Billing");

  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [clearModal, setClearModal] = useState<{
    visible: boolean;
    expense?: ExpenseListItem;
  }>({ visible: false });
  const [clearCash, setClearCash] = useState("");
  const [clearUpi, setClearUpi] = useState("");
  const [focusedField, setFocusedField] = useState<"cash" | "upi" | null>(null);
  const [detailsModal, setDetailsModal] = useState<{
    visible: boolean;
    expenseId: string | null;
  }>({ visible: false, expenseId: null });

  const getDateFilter = React.useCallback((): DateFilterOptions => {
    // Use local calendar day to avoid UTC shift issues
    const startStr = startDate.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const endStr = endDate.toLocaleDateString("en-CA");
    return { startDate: startStr, endDate: endStr };
  }, [startDate, endDate]);

  const loadExpenses = React.useCallback(async () => {
    try {
      const dateFilter = getDateFilter();
      const [expensesData] = await Promise.all([
        dashboardService.getExpensesWithStatus(dateFilter),
        dashboardService.getDashboardStats(),
      ]);
      setExpenses(expensesData);

      const total = expensesData.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );
      setTotalExpenses(total);
    } catch (error) {
      console.error("Error loading expenses:", error);
      Alert.alert("Error", "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateFilter]);

  // Track last version to avoid redundant loads
  const lastVersionRef = useRef<number>(0);

  // Focus refresh callback - extracted to avoid hook nesting issues
  const focusRefreshCallback = useCallback(() => {
    const currentVersion =
      ev.expensesVersion + ev.paymentsVersion + ev.billsVersion + ev.anyVersion;
    if (currentVersion !== lastVersionRef.current) {
      lastVersionRef.current = currentVersion;
      loadExpenses();
    }
  }, [
    ev.expensesVersion,
    ev.paymentsVersion,
    ev.billsVersion,
    ev.anyVersion,
    loadExpenses,
  ]);

  // Use focus-aware refresh - only reload when screen focuses and data changed
  useFocusRefresh(focusRefreshCallback, {
    minInterval: 5000,
    dependencies: [startDate, endDate],
  });

  // Initial load and date filter change
  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadExpenses();
  }, [loadExpenses]);

  const handleExpenseAdded = useCallback(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Note: We no longer block on loading - show skeleton in place instead

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Enhanced Header */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingTop: insets.top + 20,
            paddingBottom: 40,
            paddingHorizontal: 24,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Header Title and Action */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 28,
            }}
          >
            <View style={{ flex: 1 }}>
              <Typography
                variant="h1"
                weight="bold"
                style={{
                  color: "white",
                  marginBottom: 6,
                  fontSize: 32,
                  lineHeight: 38,
                }}
              >
                Expenses
              </Typography>
              <Typography
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 16,
                  lineHeight: 22,
                }}
              >
                Track and manage your business expenses
              </Typography>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={() => setShowAddExpense(true)}
            >
              <Plus size={18} color={theme.colors.primary} />
              <Typography
                style={{
                  color: theme.colors.primary,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                Add
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Date Range Picker Filter Section */}
          <View style={{ marginBottom: 16, flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 8,
              }}
              onPress={() => setShowStartPicker(true)}
            >
              <Calendar
                size={18}
                color="rgba(255,255,255,0.9)"
                style={{ marginRight: 10 }}
              />
              <Typography
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {startDate.toLocaleDateString("en-CA")}
              </Typography>
            </TouchableOpacity>
            <Typography
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 16,
                fontWeight: "600",
                alignSelf: "center",
              }}
            >
              to
            </Typography>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 8,
              }}
              onPress={() => setShowEndPicker(true)}
            >
              <Calendar
                size={18}
                color="rgba(255,255,255,0.9)"
                style={{ marginRight: 10 }}
              />
              <Typography
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {endDate.toLocaleDateString("en-CA")}
              </Typography>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (date && date <= endDate) setStartDate(date);
                }}
                maximumDate={endDate}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (date && date >= startDate) setEndDate(date);
                }}
                minimumDate={startDate}
                maximumDate={new Date()}
              />
            )}
          </View>
        </View>

        {/* Stats Cards Section */}
        <View style={{ paddingHorizontal: 24, marginTop: -20 }}>
          {/* Total Expenses Card */}
          <StatCard
            icon={<TrendingDown size={28} color="#EF4444" />}
            title={`Total Expenses (${startDate.toLocaleDateString("en-CA")} to ${endDate.toLocaleDateString("en-CA")})`}
            value={formatCurrency(totalExpenses)}
            trend="down"
            color="#EF4444"
            backgroundColor="#FEF2F2"
          />

          {/* Section Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              marginTop: 12,
            }}
          >
            <Typography
              variant="h3"
              weight="bold"
              style={{ color: "#1E293B", fontSize: 22 }}
            >
              Recent Expenses
            </Typography>
            <View
              style={{
                backgroundColor: "white",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#E2E8F0",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Typography
                variant="caption"
                style={{
                  color: theme.colors.primary,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
              </Typography>
            </View>
          </View>

          {/* Expenses List or Empty State */}
          {/* Show skeleton while loading */}
          {loading ? (
            <View style={{ marginBottom: 20 }}>
              <ListItemSkeleton />
              <ListItemSkeleton />
              <ListItemSkeleton />
              <ListItemSkeleton />
            </View>
          ) : expenses.length === 0 ? (
            <View
              style={{
                backgroundColor: "white",
                alignItems: "center",
                padding: 40,
                borderRadius: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 6,
                borderWidth: 1,
                borderColor: "#F8FAFC",
              }}
            >
              <View
                style={{
                  width: 100,
                  height: 100,
                  backgroundColor: "#F8FAFC",
                  borderRadius: 50,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 24,
                  borderWidth: 3,
                  borderColor: "#E2E8F0",
                }}
              >
                <DollarSign size={48} color="#94A3B8" />
              </View>

              <Typography
                variant="h3"
                weight="bold"
                style={{
                  marginBottom: 12,
                  color: "#1E293B",
                  fontSize: 22,
                }}
              >
                No Expenses Found
              </Typography>

              <Typography
                variant="body"
                color="textSecondary"
                style={{
                  textAlign: "center",
                  marginBottom: 32,
                  lineHeight: 24,
                  paddingHorizontal: 20,
                }}
              >
                {`No expenses found for the selected date range. Try picking a different range or add a new expense.`}
              </Typography>

              <TouchableOpacity
                onPress={() => setShowAddExpense(true)}
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 32,
                  paddingVertical: 16,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Plus size={20} color="white" style={{ marginRight: 8 }} />
                <Typography
                  style={{ color: "white", fontWeight: "700", fontSize: 16 }}
                >
                  Add First Expense
                </Typography>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginBottom: 20 }}>
              {expenses.map((expense, index) => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  index={index}
                  onClearCredit={(e) => {
                    setClearModal({ visible: true, expense: e });
                  }}
                  onPress={(e) =>
                    setDetailsModal({ visible: true, expenseId: e.id })
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 120 }} />
      </ScrollView>

      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleExpenseAdded}
      />

      <ExpenseDetailsModal
        visible={detailsModal.visible}
        expenseId={detailsModal.expenseId}
        onClose={() => setDetailsModal({ visible: false, expenseId: null })}
      />

      <Modal
        visible={!!clearModal.visible && !!clearModal.expense}
        animationType="slide"
        transparent
        onRequestClose={() => setClearModal({ visible: false })}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            onPress={() => setClearModal({ visible: false })}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: "padding", android: undefined })}
            style={{ width: "100%" }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 16,
                paddingBottom: 16,
              }}
            >
              {clearModal.expense &&
                (() => {
                  const outstanding =
                    clearModal.expense!.creditOutstanding || 0;
                  const nCash = Math.max(
                    0,
                    parseInt((clearCash || "0").replace(/[^0-9]/g, ""), 10) || 0
                  );
                  const nUpi = Math.max(
                    0,
                    parseInt((clearUpi || "0").replace(/[^0-9]/g, ""), 10) || 0
                  );
                  const total = nCash + nUpi;
                  const remaining = Math.max(0, outstanding - total);
                  const over = total > outstanding;

                  const setSafe = (which: "cash" | "upi", txt: string) => {
                    const sanitized = (txt || "").replace(/[^0-9]/g, "");
                    if (which === "cash") setClearCash(sanitized);
                    else setClearUpi(sanitized);
                  };

                  const applyChip = (amt: number | "max") => {
                    const other = focusedField === "cash" ? nUpi : nCash;
                    const available = Math.max(0, outstanding - other);
                    const inc =
                      amt === "max" ? available : Math.min(amt, available);
                    const current = focusedField === "cash" ? nCash : nUpi;
                    const next = Math.max(
                      0,
                      Math.min(available, current + inc)
                    );
                    if (focusedField === "cash") setClearCash(String(next));
                    else setClearUpi(String(next));
                  };

                  const onConfirm = async () => {
                    if (total <= 0 || over) return;
                    try {
                      const splits: { type: "Cash" | "UPI"; amount: number }[] =
                        [];
                      if (nCash > 0)
                        splits.push({ type: "Cash", amount: nCash });
                      if (nUpi > 0) splits.push({ type: "UPI", amount: nUpi });
                      await expenseService.clearExpenseCredit(
                        clearModal.expense!.id,
                        splits
                      );
                      setClearModal({ visible: false });
                      setClearCash("");
                      setClearUpi("");
                      loadExpenses();
                    } catch (e) {
                      Alert.alert("Error", String((e as any)?.message || e));
                    }
                  };

                  return (
                    <>
                      <View style={{ alignItems: "center", paddingBottom: 8 }}>
                        <View
                          style={{
                            width: 40,
                            height: 4,
                            backgroundColor: "#E5E7EB",
                            borderRadius: 2,
                          }}
                        />
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <Typography variant="h3">
                          Clear expense credit
                        </Typography>
                        <TouchableOpacity
                          onPress={() => setClearModal({ visible: false })}
                        >
                          <Typography
                            style={{
                              color: theme.colors.primary,
                              fontWeight: "700",
                            }}
                          >
                            Close
                          </Typography>
                        </TouchableOpacity>
                      </View>
                      <Typography style={{ color: "#64748B", marginBottom: 6 }}>
                        Outstanding
                      </Typography>
                      <Typography
                        variant="h2"
                        weight="bold"
                        style={{ color: "#DC2626", marginBottom: 12 }}
                      >
                        {formatCurrency(outstanding)}
                      </Typography>

                      <View style={{ gap: 12 }}>
                        <View>
                          <Typography
                            variant="caption"
                            style={{ marginBottom: 6, color: "#64748B" }}
                          >
                            Cash amount
                          </Typography>
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: "#E5E7EB",
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              backgroundColor: "#F9FAFB",
                            }}
                          >
                            <TextInput
                              value={clearCash}
                              onChangeText={(t) => setSafe("cash", t)}
                              onFocus={() => setFocusedField("cash")}
                              placeholder="0"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                        <View>
                          <Typography
                            variant="caption"
                            style={{ marginBottom: 6, color: "#64748B" }}
                          >
                            UPI amount
                          </Typography>
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: "#E5E7EB",
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              backgroundColor: "#F9FAFB",
                            }}
                          >
                            <TextInput
                              value={clearUpi}
                              onChangeText={(t) => setSafe("upi", t)}
                              onFocus={() => setFocusedField("upi")}
                              placeholder="0"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 12,
                        }}
                      >
                        {[100, 500, 1000].map((v) => (
                          <TouchableOpacity
                            key={v}
                            onPress={() => applyChip(v)}
                            style={{
                              backgroundColor: "#F3F4F6",
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                            }}
                          >
                            <Typography
                              style={{ color: "#111827", fontWeight: "600" }}
                            >
                              +{formatCurrency(v)}
                            </Typography>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          onPress={() => applyChip("max")}
                          style={{
                            backgroundColor: "#EEF2FF",
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                          }}
                        >
                          <Typography
                            style={{ color: "#4F46E5", fontWeight: "700" }}
                          >
                            Max
                          </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setClearCash("");
                            setClearUpi("");
                          }}
                          style={{
                            backgroundColor: "#FFE4E6",
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                          }}
                        >
                          <Typography
                            style={{ color: "#E11D48", fontWeight: "700" }}
                          >
                            Clear
                          </Typography>
                        </TouchableOpacity>
                      </View>

                      <View style={{ marginTop: 14 }}>
                        <Typography
                          style={{ color: over ? "#DC2626" : "#64748B" }}
                        >
                          Clearing {formatCurrency(total)} · Remaining{" "}
                          {formatCurrency(remaining)}
                        </Typography>
                      </View>

                      <TouchableOpacity
                        disabled={total <= 0 || over}
                        onPress={onConfirm}
                        style={{
                          marginTop: 14,
                          backgroundColor:
                            total <= 0 || over
                              ? "#93C5FD"
                              : theme.colors.primary,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                        }}
                      >
                        <Typography
                          style={{ color: "white", fontWeight: "800" }}
                        >
                          Clear credit{" "}
                          {total > 0 ? `· ${formatCurrency(total)}` : ""}
                        </Typography>
                      </TouchableOpacity>
                    </>
                  );
                })()}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
