import AddExpenseModal from "@/app/(modals)/add-expense";
import { Button, Card, Loading, Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import { dashboardService, DateFilterOptions, ExpenseData } from "@/services/dashboardService";
import {
    Calendar,
    DollarSign,
    Plus,
    Receipt,
    TrendingDown
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Format currency properly without truncation
const formatCurrency = (amount: number): string => {
  const value = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  
  return amount < 0 ? `-${formatted}` : formatted;
};

// Get appropriate font size based on amount length
const getCurrencyFontSize = (amount: number, baseFontSize: number = 18): number => {
  const formatted = formatCurrency(amount);
  const length = formatted.length;
  
  if (length <= 8) return baseFontSize;
  if (length <= 12) return baseFontSize * 0.85;
  if (length <= 16) return baseFontSize * 0.75;
  return baseFontSize * 0.65;
};

const FilterButton: React.FC<{
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ active, onPress, children }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.full,
      backgroundColor: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)",
      borderWidth: 1,
      borderColor: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
      marginRight: 12,
      shadowColor: active ? "#000" : "transparent",
      shadowOffset: active ? { width: 0, height: 2 } : { width: 0, height: 0 },
      shadowOpacity: active ? 0.1 : 0,
      shadowRadius: active ? 4 : 0,
      elevation: active ? 2 : 0,
    }}
  >
    <Typography
      variant="caption"
      weight="semibold"
      style={{ color: active ? theme.colors.primary : "white" }}
    >
      {children}
    </Typography>
  </TouchableOpacity>
);

const ExpenseItem: React.FC<{ expense: ExpenseData }> = ({ expense }) => (
  <Card style={{ marginBottom: 16 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <View style={{
            width: 32,
            height: 32,
            backgroundColor: theme.colors.errorLight,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}>
            <Receipt size={16} color={theme.colors.error} />
          </View>
          <Typography variant="caption" color="textSecondary">
            Voucher #{expense.voucherNo}
          </Typography>
        </View>
        <Typography variant="body" weight="semibold" style={{ marginBottom: 6, marginLeft: 44 }}>
          {expense.towards}
        </Typography>
        <Typography variant="caption" color="textSecondary" style={{ marginLeft: 44 }}>
          {expense.mode} • {new Date(expense.createdAt).toLocaleDateString('en-IN')}
        </Typography>
        {expense.remarks && (
          <Typography variant="caption" color="textSecondary" style={{ marginTop: 6, marginLeft: 44 }}>
            {expense.remarks}
          </Typography>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Typography 
          variant="h4" 
          weight="bold" 
          color="error"
          style={{ fontSize: getCurrencyFontSize(expense.amount, 18) }}
        >
          -{formatCurrency(expense.amount)}
        </Typography>
      </View>
    </View>
  </Card>
);

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const getDateFilter = (): DateFilterOptions | undefined => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    
    switch (selectedFilter) {
      case "today":
        return { startDate: endDate, endDate };
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        return { 
          startDate: weekStart.toISOString().split('T')[0], 
          endDate 
        };
      case "month":
        const monthStart = new Date(today);
        monthStart.setDate(1);
        return { 
          startDate: monthStart.toISOString().split('T')[0], 
          endDate 
        };
      case "all":
      default:
        return undefined;
    }
  };

  const loadExpenses = async () => {
    try {
      const dateFilter = getDateFilter();
      const expensesData = await dashboardService.getExpenses(dateFilter);
      setExpenses(expensesData);
      
      const total = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
      setTotalExpenses(total);
    } catch (error) {
      console.error("Error loading expenses:", error);
      Alert.alert("Error", "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [selectedFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleExpenseAdded = () => {
    loadExpenses();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loading message="Loading expenses..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={{ 
          backgroundColor: theme.colors.primary,
          paddingTop: insets.top + 32,
          paddingBottom: 32,
          paddingHorizontal: 20,
          borderBottomLeftRadius: theme.borderRadius.xl,
          borderBottomRightRadius: theme.borderRadius.xl,
        }}>
          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            alignItems: "flex-start",
            marginBottom: 20 
          }}>
            <View style={{ flex: 1 }}>
              <Typography variant="h2" style={{ color: "white", marginBottom: 4 }}>
                Expenses
              </Typography>
              <Typography style={{ color: "rgba(255,255,255,0.8)" }}>
                Track and manage your business expenses
              </Typography>
            </View>
            <Button
              title="Add Expense"
              onPress={() => setShowAddExpense(true)}
              variant="secondary"
              size="sm"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderColor: "rgba(255,255,255,0.25)",
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
              textStyle={{ color: "white", fontWeight: "600" }}
              icon={<Plus size={18} color="white" />}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Calendar size={16} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
            <Typography style={{ color: "rgba(255,255,255,0.8)", marginRight: 16 }}>
              Filter:
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterButton
                active={selectedFilter === "today"}
                onPress={() => setSelectedFilter("today")}
              >
                Today
              </FilterButton>
              <FilterButton
                active={selectedFilter === "week"}
                onPress={() => setSelectedFilter("week")}
              >
                This Week
              </FilterButton>
              <FilterButton
                active={selectedFilter === "month"}
                onPress={() => setSelectedFilter("month")}
              >
                This Month
              </FilterButton>
              <FilterButton
                active={selectedFilter === "all"}
                onPress={() => setSelectedFilter("all")}
              >
                All Time
              </FilterButton>
            </ScrollView>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: -16 }}>
          <Card style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{
                  width: 48,
                  height: 48,
                  backgroundColor: "#fef2f2",
                  borderRadius: 24,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 16,
                }}>
                  <TrendingDown size={24} color={theme.colors.error} />
                </View>
                <View>
                  <Typography variant="caption" color="textSecondary">
                    Total Expenses {selectedFilter !== "all" ? `(${selectedFilter})` : ""}
                  </Typography>
                  <Typography 
                    variant="h3" 
                    weight="bold" 
                    color="error"
                    style={{ fontSize: getCurrencyFontSize(totalExpenses, 20) }}
                  >
                    {formatCurrency(totalExpenses)}
                  </Typography>
                </View>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Typography variant="h4">Recent Expenses</Typography>
            <View style={{
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: theme.borderRadius.full,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
              <Typography variant="caption" color="textSecondary" weight="semibold">
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              </Typography>
            </View>
          </View>

          {expenses.length === 0 ? (
            <Card style={{ alignItems: "center", padding: 40 }}>
              <View style={{
                width: 80,
                height: 80,
                backgroundColor: theme.colors.surface,
                borderRadius: 40,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 24,
                borderWidth: 2,
                borderColor: theme.colors.border,
              }}>
                <DollarSign size={36} color={theme.colors.textSecondary} />
              </View>
              <Typography variant="h4" style={{ marginBottom: 12 }}>
                No Expenses Found
              </Typography>
              <Typography variant="body" color="textSecondary" style={{ textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
                {selectedFilter === "all" 
                  ? "You haven't added any expenses yet. Start tracking your business expenses to get better insights."
                  : `No expenses found for ${selectedFilter}. Try selecting a different time period or add a new expense.`}
              </Typography>
              <Button
                title="Add First Expense"
                onPress={() => setShowAddExpense(true)}
                size="sm"
              />
            </Card>
          ) : (
            <View>
              {expenses.map((expense) => (
                <ExpenseItem key={expense.id} expense={expense} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleExpenseAdded}
      />
    </SafeAreaView>
  );
}
