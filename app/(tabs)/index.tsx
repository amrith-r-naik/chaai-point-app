import AddExpenseModal from "@/app/(modals)/add-expense";
import { Button, Loading } from "@/components/ui";
import { theme } from "@/constants/theme";
import { logoutUser } from "@/services/authService";
import { dashboardService, DashboardStats, DateFilterOptions } from "@/services/dashboardService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  Filter,
  LogOut,
  Plus,
  ShoppingCart,
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
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 120
  },
  headerContainer: {
    backgroundColor: theme.colors.primary,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    minHeight: 60,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 4,
    flexShrink: 1,
    textAlign: 'left',
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22
  },
  headerButtonsContainer: {
    flexDirection: "column",
    gap: 8,
    alignItems: 'flex-end'
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  cardsContainer: {
    paddingHorizontal: 16,
    marginTop: -16
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  statCardContent: {
    alignItems: "flex-start"
  },
  statCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 28
  },
  statCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center"
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8
  },
  filterButtonActive: {
    backgroundColor: "rgba(255,255,255,1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  filterButtonInactive: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  todayPerformanceCard: {
    margin: 20,
    marginTop: 24,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  adminCard: {
    margin: 20,
    marginTop: 24,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight
  }
});

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
const getCurrencyFontSize = (amount: number, baseFontSize: number = 24): number => {
  const formatted = formatCurrency(amount);
  const length = formatted.length;
  
  if (length <= 8) return baseFontSize;
  if (length <= 12) return baseFontSize * 0.85;
  if (length <= 16) return baseFontSize * 0.75;
  return baseFontSize * 0.65;
};

// Format large numbers with K, L notation for better readability
const formatNumber = (num: number): string => {
  if (num >= 10000000) { // 1 crore
    return `${(num / 10000000).toFixed(1)}Cr`;
  } else if (num >= 100000) { // 1 lakh
    return `${(num / 100000).toFixed(1)}L`;
  } else if (num >= 1000) { // 1 thousand
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  backgroundColor: string;
  trend?: "up" | "down";
  trendValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  backgroundColor,
  trend,
  trendValue,
}) => {
  const formatValue = () => {
    if (typeof value === "number" && (title.toLowerCase().includes("revenue") || title.toLowerCase().includes("expense") || title.toLowerCase().includes("profit") || title.toLowerCase().includes("due"))) {
      return formatCurrency(value);
    }
    return value.toString();
  };

  const getFontSize = () => {
    if (typeof value === "number" && (title.toLowerCase().includes("revenue") || title.toLowerCase().includes("expense") || title.toLowerCase().includes("profit") || title.toLowerCase().includes("due"))) {
      return getCurrencyFontSize(value, 24);
    }
    return 24;
  };

  return (
    <View style={styles.statCard}>
      <View style={styles.statCardContent}>
        <View style={styles.statCardHeader}>
          <Text style={styles.statCardTitle}>
            {title.toUpperCase()}
          </Text>
          <View style={[styles.statCardIcon, { backgroundColor }]}>
            {icon}
          </View>
        </View>
        
        <Text style={[styles.statCardValue, { fontSize: getFontSize() }]}>
          {formatValue()}
        </Text>
        
        {subtitle && (
          <Text style={{ 
            fontSize: 13, 
            color: '#64748b', 
            marginTop: 4,
            fontWeight: '500'
          }}>
            {subtitle}
          </Text>
        )}
        
        {trend && trendValue && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            {trend === "up" ? (
              <TrendingUp size={14} color={theme.colors.success} />
            ) : (
              <TrendingDown size={14} color={theme.colors.error} />
            )}
            <Text style={{
              marginLeft: 6,
              fontSize: 13,
              fontWeight: '600',
              color: trend === "up" ? theme.colors.success : theme.colors.error
            }}>
              {trendValue}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const FilterButton: React.FC<{
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ active, onPress, children }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.filterButton,
      active ? styles.filterButtonActive : styles.filterButtonInactive
    ]}
  >
    <Text style={[
      styles.filterButtonText,
      {
        color: active ? theme.colors.primary : "rgba(255,255,255,0.95)",
      }
    ]}>
      {children}
    </Text>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const auth = use$(authState);
  const insets = useSafeAreaInsets();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"today" | "week" | "month">("today");
  const [showAddExpense, setShowAddExpense] = useState(false);

  const getDateFilter = (): DateFilterOptions => {
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
      default:
        return { startDate: endDate, endDate };
    }
  };

  const loadDashboardData = async () => {
    try {
      const dateFilter = getDateFilter();
      const dashboardStats = await dashboardService.getDashboardStats(dateFilter);
      setStats(dashboardStats);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      Alert.alert("Error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutUser();
            router.replace("/(auth)/login");
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  const handleExpenseAdded = () => {
    loadDashboardData();
  };

  if (!auth.user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loading message="Loading your dashboard..." />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loading message="Loading dashboard data..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View
          style={[
            styles.headerContainer,
            { paddingTop: insets.top + 32 }
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Dashboard
              </Text>
              <Text style={styles.headerSubtitle}>
                Complete business overview and insights
              </Text>
            </View>
            <View style={styles.headerButtonsContainer}>
              <Button
                title="Add Expense"
                onPress={() => setShowAddExpense(true)}
                variant="secondary"
                size="sm"
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderColor: "rgba(255,255,255,0.3)",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
                textStyle={{ color: "white", fontWeight: "700", fontSize: 14 }}
                icon={<Plus size={20} color="white" />}
              />
              <Button
                title=""
                onPress={handleLogout}
                variant="secondary"
                size="sm"
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderColor: "rgba(255,255,255,0.3)",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
                icon={<LogOut size={20} color="white" />}
              />
            </View>
          </View>

          <View style={styles.filterContainer}>
            <Filter size={18} color="rgba(255,255,255,0.95)" style={{ marginRight: 12 }} />
            <Text style={{ 
              color: "rgba(255,255,255,0.95)", 
              marginRight: 20,
              fontSize: 16,
              fontWeight: '700'
            }}>
              Filter Period:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
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
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={styles.cardsContainer}>
          <View style={styles.cardRow}>
            <StatCard
              title="Total Revenue"
              value={stats?.totalRevenue || 0}
              icon={<DollarSign size={22} color={theme.colors.success} />}
              color={theme.colors.success}
              backgroundColor={theme.colors.successLight}
            />
            <StatCard
              title="Total Orders"
              value={stats?.totalOrders || 0}
              icon={<ShoppingCart size={22} color={theme.colors.primary} />}
              color={theme.colors.primary}
              backgroundColor={theme.colors.primaryLight}
            />
          </View>

          <View style={styles.cardRow}>
            <StatCard
              title="Total Expenses"
              value={stats?.totalExpenses || 0}
              icon={<TrendingDown size={22} color={theme.colors.error} />}
              color={theme.colors.error}
              backgroundColor="#fef2f2"
            />
            <StatCard
              title="Net Profit"
              value={stats?.profit || 0}
              icon={<TrendingUp size={22} color={stats && stats.profit >= 0 ? theme.colors.success : theme.colors.error} />}
              color={stats && stats.profit >= 0 ? theme.colors.success : theme.colors.error}
              backgroundColor={stats && stats.profit >= 0 ? theme.colors.successLight : "#fef2f2"}
            />
          </View>

          <View style={styles.cardRow}>
            <StatCard
              title="Pending Dues"
              value={stats?.pendingDues || 0}
              icon={<AlertCircle size={22} color={theme.colors.warning} />}
              color={theme.colors.warning}
              backgroundColor={theme.colors.warningLight}
            />
            <StatCard
              title="Avg Order Value"
              value={stats?.totalOrders && stats?.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders) : 0}
              icon={<BarChart3 size={22} color={theme.colors.info} />}
              color={theme.colors.info}
              backgroundColor="#eff6ff"
            />
          </View>
        </View>

        {selectedFilter !== "today" && (
          <View style={styles.todayPerformanceCard}>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '800', 
              color: '#1e293b', 
              marginBottom: 20 
            }}>
              Today's Performance
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: 'wrap', gap: 16 }}>
              <View style={{ flex: 1, minWidth: 100 }}>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#64748b', 
                  fontWeight: '600', 
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8
                }}>
                  Orders Today
                </Text>
                <Text style={{ 
                  fontSize: 24, 
                  fontWeight: '800', 
                  color: '#1e293b' 
                }}>
                  {stats?.todayOrders || 0}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", minWidth: 120 }}>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#64748b', 
                  fontWeight: '600', 
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8
                }}>
                  Revenue Today
                </Text>
                <Text style={{ 
                  fontSize: getCurrencyFontSize(stats?.todayRevenue || 0, 24), 
                  fontWeight: '800', 
                  color: theme.colors.success 
                }}>
                  {formatCurrency(stats?.todayRevenue || 0)}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end", minWidth: 100 }}>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#64748b', 
                  fontWeight: '600', 
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8
                }}>
                  Profit Today
                </Text>
                <Text style={{ 
                  fontSize: getCurrencyFontSize(stats?.todayProfit || 0, 24), 
                  fontWeight: '800', 
                  color: stats && stats.todayProfit >= 0 ? theme.colors.success : theme.colors.error
                }}>
                  {formatCurrency(stats?.todayProfit || 0)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {auth.user?.role === "admin" && (
          <View style={styles.adminCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 16 }}>
              <View style={{ flex: 1, paddingRight: 12, minWidth: 200 }}>
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: '800', 
                  color: '#1e293b',
                  marginBottom: 8
                }}>
                  Admin Settings
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: '#64748b', 
                  fontWeight: '500',
                  lineHeight: 20
                }}>
                  Manage menu items, database, and system configuration
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/admin-settings")}
                style={{
                  backgroundColor: theme.colors.primary,
                  padding: 18,
                  borderRadius: 16,
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <BarChart3 size={26} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 100, backgroundColor: 'transparent' }} />
      </ScrollView>

      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleExpenseAdded}
      />
    </SafeAreaView>
  );
}
