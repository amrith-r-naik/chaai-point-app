import AddExpenseModal from "@/app/(modals)/add-expense";
import { Loading, Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import { dashboardService, DateFilterOptions, ExpenseData } from "@/services/dashboardService";
import { useRouter } from "expo-router";
import {
  Activity,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get('window');

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

const styles = StyleSheet.create({
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)"
  },
  primaryActionButton: {
    backgroundColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "auto",
    gap: 6,
  }
});

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
      paddingVertical: 12,
      borderRadius: 25,
      backgroundColor: active ? "white" : "rgba(255,255,255,0.1)",
      borderWidth: 1,
      borderColor: active ? "white" : "rgba(255,255,255,0.2)",
      marginRight: 12,
      shadowColor: active ? "#000" : "transparent",
      shadowOffset: active ? { width: 0, height: 4 } : { width: 0, height: 0 },
      shadowOpacity: active ? 0.15 : 0,
      shadowRadius: active ? 8 : 0,
      elevation: active ? 4 : 0,
      minWidth: 80,
      alignItems: 'center',
    }}
  >
    <Typography
      variant="caption"
      weight="bold"
      style={{
        color: active ? theme.colors.primary : "white",
        fontSize: 13
      }}
    >
      {children}
    </Typography>
  </TouchableOpacity>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
  backgroundColor: string;
  onPress?: () => void;
}> = ({ icon, title, value, trend, color, backgroundColor, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress}
    style={{
      backgroundColor: 'white',
      padding: 20,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#F8FAFC',
    }}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={{
          width: 56,
          height: 56,
          backgroundColor: backgroundColor,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 16,
        }}>
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
              fontSize: getCurrencyFontSize(parseFloat(value.replace(/[^\d.-]/g, '')), 22),
              lineHeight: 28
            }}
          >
            {value}
          </Typography>
        </View>
      </View>
      {trend && (
        <View style={{
          backgroundColor: trend === 'up' ? '#FEF3C7' : trend === 'down' ? '#FEE2E2' : '#F3F4F6',
          padding: 8,
          borderRadius: 12,
        }}>
          {trend === 'up' && <TrendingUp size={16} color="#D97706" />}
          {trend === 'down' && <TrendingDown size={16} color="#DC2626" />}
          {trend === 'neutral' && <Activity size={16} color="#6B7280" />}
        </View>
      )}
      {onPress && (
        <View style={{
          backgroundColor: color,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 12,
          marginLeft: 12,
        }}>
          <Typography style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
            Manage
          </Typography>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

const ExpenseItem: React.FC<{ expense: ExpenseData; index: number }> = ({ expense, index }) => (
  <View
    style={{
      backgroundColor: 'white',
      padding: 20,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#F8FAFC',
    }}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 40,
            height: 40,
            backgroundColor: '#FEF2F2',
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            <Receipt size={18} color="#EF4444" />
          </View>
          <View style={{
            backgroundColor: '#EEF2FF',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}>
            <Typography variant="caption" style={{ color: '#4F46E5', fontWeight: '600', fontSize: 10 }}>
              #{expense.voucherNo}
            </Typography>
          </View>
        </View>

        <Typography
          variant="body"
          weight="bold"
          style={{
            marginBottom: 6,
            fontSize: 16,
            color: '#1E293B',
            lineHeight: 22
          }}
        >
          {expense.towards}
        </Typography>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{
            backgroundColor: '#F8FAFC',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            marginRight: 8,
          }}>
            <Typography variant="caption" style={{ color: '#64748B', fontSize: 11, fontWeight: '500' }}>
              {expense.mode}
            </Typography>
          </View>
          <Typography variant="caption" color="textSecondary" style={{ fontSize: 11 }}>
            {new Date(expense.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </Typography>
        </View>

        {expense.remarks && (
          <View style={{
            backgroundColor: '#FFFBEB',
            padding: 8,
            borderRadius: 8,
            marginTop: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#F59E0B',
          }}>
            <Typography variant="caption" style={{ color: '#92400E', fontSize: 11, lineHeight: 16 }}>
              💬 {expense.remarks}
            </Typography>
          </View>
        )}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Typography
          variant="h4"
          weight="bold"
          style={{
            color: '#EF4444',
            fontSize: getCurrencyFontSize(expense.amount, 20),
            lineHeight: 24
          }}
        >
          -{formatCurrency(expense.amount)}
        </Typography>
        <View style={{
          backgroundColor: '#FEE2E2',
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          marginTop: 4,
        }}>
          <Typography style={{ color: '#DC2626', fontSize: 9, fontWeight: '600' }}>
            EXPENSE
          </Typography>
        </View>
      </View>
    </View>
  </View>
);

export default function BillingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [outstandingCredit, setOutstandingCredit] = useState(0);

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
      const [expensesData, stats] = await Promise.all([
        dashboardService.getExpenses(dateFilter),
        dashboardService.getDashboardStats()
      ]);
      setExpenses(expensesData);
      setOutstandingCredit(stats.outstandingCredit || 0);

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Loading message="Loading expenses..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
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
        <View style={{
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
        }}>
          {/* Header Title and Action */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 28
          }}>
            <View style={{ flex: 1 }}>
              <Typography
                variant="h1"
                weight="bold"
                style={{
                  color: 'white',
                  marginBottom: 6,
                  fontSize: 32,
                  lineHeight: 38
                }}
              >
                Expenses
              </Typography>
              <Typography
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 16,
                  lineHeight: 22
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
              <Typography style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>Add</Typography>
            </TouchableOpacity>
          </View>

          {/* Enhanced Filter Section */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Calendar size={18} color="rgba(255,255,255,0.9)" style={{ marginRight: 10 }} />
              <Typography style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' }}>
                Filter by period:
              </Typography>
            </View>

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

        {/* Stats Cards Section */}
        <View style={{ paddingHorizontal: 24, marginTop: -20 }}>
          {/* Total Expenses Card */}
          <StatCard
            icon={<TrendingDown size={28} color="#EF4444" />}
            title={`Total Expenses ${selectedFilter !== "all" ? `(${selectedFilter})` : ""}`}
            value={formatCurrency(totalExpenses)}
            trend="down"
            color="#EF4444"
            backgroundColor="#FEF2F2"
          />

          {/* Outstanding Credit Card */}
          <StatCard
            icon={<Clock size={28} color="#D97706" />}
            title="Outstanding Credit"
            value={formatCurrency(outstandingCredit)}
            trend={outstandingCredit > 0 ? "neutral" : "up"}
            color={outstandingCredit > 0 ? "#D97706" : "#10B981"}
            backgroundColor={outstandingCredit > 0 ? "#FEF3C7" : "#D1FAE5"}
          />

          {/* Section Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            marginTop: 12
          }}>
            <Typography
              variant="h3"
              weight="bold"
              style={{ color: '#1E293B', fontSize: 22 }}
            >
              Recent Expenses
            </Typography>
            <View style={{
              backgroundColor: 'white',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}>
              <Typography
                variant="caption"
                style={{
                  color: theme.colors.primary,
                  fontWeight: '700',
                  fontSize: 11
                }}
              >
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              </Typography>
            </View>
          </View>

          {/* Expenses List or Empty State */}
          {expenses.length === 0 ? (
            <View style={{
              backgroundColor: 'white',
              alignItems: 'center',
              padding: 40,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 6,
              borderWidth: 1,
              borderColor: '#F8FAFC',
            }}>
              <View style={{
                width: 100,
                height: 100,
                backgroundColor: '#F8FAFC',
                borderRadius: 50,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 24,
                borderWidth: 3,
                borderColor: '#E2E8F0',
              }}>
                <DollarSign size={48} color="#94A3B8" />
              </View>

              <Typography
                variant="h3"
                weight="bold"
                style={{
                  marginBottom: 12,
                  color: '#1E293B',
                  fontSize: 22
                }}
              >
                No Expenses Found
              </Typography>

              <Typography
                variant="body"
                color="textSecondary"
                style={{
                  textAlign: 'center',
                  marginBottom: 32,
                  lineHeight: 24,
                  paddingHorizontal: 20
                }}
              >
                {selectedFilter === "all"
                  ? "You haven't added any expenses yet. Start tracking your business expenses to get better insights."
                  : `No expenses found for ${selectedFilter}. Try selecting a different time period or add a new expense.`}
              </Typography>

              <TouchableOpacity
                onPress={() => setShowAddExpense(true)}
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 32,
                  paddingVertical: 16,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Plus size={20} color="white" style={{ marginRight: 8 }} />
                <Typography style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                  Add First Expense
                </Typography>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginBottom: 20 }}>
              {expenses.map((expense, index) => (
                <ExpenseItem key={expense.id} expense={expense} index={index} />
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
    </SafeAreaView>
  );
}
