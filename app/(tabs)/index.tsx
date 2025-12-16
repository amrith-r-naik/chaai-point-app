import AddExpenseModal from "@/app/(modals)/add-expense";
import { Loading } from "@/components/ui";
// UnbilledOrdersCard removed as unbilled KOT concept deprecated
import { theme } from "@/constants/theme";
import { useFocusRefresh } from "@/hooks/useFocusRefresh";
import { useScreenPerformance } from "@/hooks/useScreenPerformance";
import { openDatabase } from "@/lib/db";
import { logoutUser } from "@/services/authService";
import { backupService } from "@/services/backupService";
import {
  dashboardService,
  DashboardStats,
  DateFilterOptions,
} from "@/services/dashboardService";
import { syncService } from "@/services/syncService";
import { appEvents } from "@/state/appEvents";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  AlertCircle,
  BanknoteArrowDown,
  Calendar,
  Database,
  IndianRupee,
  LogOut,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// const { width: screenWidth } = Dimensions.get("window"); // not used

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  headerGradient: {
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  headerContent: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 20,
  },
  greeting: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  headerTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexShrink: 0,
  },
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
  filterSection: {
    marginTop: 4,
  },
  filterLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  filterLabelText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: "rgba(255,255,255,1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  filterTextActive: {
    color: theme.colors.primary,
  },
  filterTextInactive: {
    color: "rgba(255,255,255,0.9)",
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: -8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 18,
    marginTop: 24,
    letterSpacing: -0.2,
  },
  metricsGrid: {
    gap: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    minHeight: 120,
    maxHeight: 120,
    justifyContent: "space-between",
  },
  metricCardFeatured: {
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.12,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    height: 32,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flex: 1,
    lineHeight: 16,
    marginTop: 2,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 6,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  metricSubtext: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  performanceCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 20,
    marginTop: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  performanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  performanceTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    letterSpacing: -0.2,
  },
  performanceBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  performanceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  performanceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  performanceMetric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
  },
  performanceMetricTitle: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  performanceMetricValue: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  adminCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    padding: 20,
    marginTop: 28,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  adminContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adminText: {
    flex: 1,
    paddingRight: 16,
  },
  adminTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  adminSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  adminButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
});

const formatCurrency = (amount: number): string => {
  const value = Math.abs(amount);
  if (value >= 10000000) {
    return `${amount < 0 ? "-" : ""}₹${(value / 10000000).toFixed(1)}Cr`;
  } else if (value >= 100000) {
    return `${amount < 0 ? "-" : ""}₹${(value / 100000).toFixed(1)}L`;
  } else if (value >= 1000) {
    return `${amount < 0 ? "-" : ""}₹${(value / 1000).toFixed(1)}K`;
  }
  return `${amount < 0 ? "-" : ""}₹${value.toLocaleString("en-IN")}`;
};

const getCurrencyFontSize = (
  amount: number,
  baseFontSize: number = 22
): number => {
  const formatted = formatCurrency(amount);
  const length = formatted.length;

  if (length <= 6) return baseFontSize;
  if (length <= 8) return baseFontSize * 0.9;
  if (length <= 10) return baseFontSize * 0.8;
  return baseFontSize * 0.7;
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  featured?: boolean;
  subtitle?: string;
  onPress?: () => void;
}

// Memoized MetricCard to prevent re-renders when parent state changes
const MetricCard = React.memo<MetricCardProps>(
  function MetricCard({
    title,
    value,
    icon,
    iconBg,
    valueColor = "#1e293b",
    featured = false,
    subtitle,
    onPress,
  }) {
    const formatValue = () => {
      if (
        typeof value === "number" &&
        (title.toLowerCase().includes("revenue") ||
          title.toLowerCase().includes("expense") ||
          title.toLowerCase().includes("payment") ||
          title.toLowerCase().includes("profit") ||
          title.toLowerCase().includes("due") ||
          title.toLowerCase().includes("value") ||
          title.toLowerCase().includes("advance") ||
          title.toLowerCase().includes("outstanding"))
      ) {
        return formatCurrency(value);
      }
      return value.toString();
    };

    const getFontSize = () => {
      if (
        typeof value === "number" &&
        (title.toLowerCase().includes("revenue") ||
          title.toLowerCase().includes("expense") ||
          title.toLowerCase().includes("payment") ||
          title.toLowerCase().includes("profit") ||
          title.toLowerCase().includes("due") ||
          title.toLowerCase().includes("value") ||
          title.toLowerCase().includes("advance") ||
          title.toLowerCase().includes("outstanding"))
      ) {
        return getCurrencyFontSize(value, 22);
      }
      return 22;
    };

    const CardContent = () => (
      <View
        style={[
          styles.metricCard,
          featured && styles.metricCardFeatured,
          onPress && { flex: 1 },
        ]}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>
            {icon}
          </View>
        </View>
        <Text
          style={[
            styles.metricValue,
            { fontSize: getFontSize(), color: valueColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatValue()}
        </Text>
        {subtitle && (
          <Text style={styles.metricSubtext} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={{ flex: 1 }}
        >
          <CardContent />
        </TouchableOpacity>
      );
    }

    return <CardContent />;
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if display data changes
    return (
      prevProps.title === nextProps.title &&
      prevProps.value === nextProps.value &&
      prevProps.iconBg === nextProps.iconBg &&
      prevProps.valueColor === nextProps.valueColor &&
      prevProps.featured === nextProps.featured &&
      prevProps.subtitle === nextProps.subtitle
    );
  }
);

// FilterButton removed (no longer needed with date-range picker)

export default function HomeScreen() {
  // Granular state subscriptions for optimized re-renders
  const user = use$(authState.user);
  const insets = useSafeAreaInsets();

  // Track screen performance
  useScreenPerformance("Dashboard");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Date range (default to today)
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [pushRunning, setPushRunning] = useState(false);
  const [pullRunning, setPullRunning] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [latestBackup, setLatestBackup] = useState<{ name: string } | null>(
    null
  );

  const getDateFilter = React.useCallback((): DateFilterOptions => {
    // Use local calendar day to avoid UTC shift issues
    const startStr = startDate.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const endStr = endDate.toLocaleDateString("en-CA");
    return { startDate: startStr, endDate: endStr };
  }, [startDate, endDate]);

  const loadDashboardData = React.useCallback(async () => {
    try {
      const dateFilter = getDateFilter();
      const dashboardStats =
        await dashboardService.getDashboardStats(dateFilter);
      setStats(dashboardStats);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      Alert.alert("Error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateFilter]);

  // Track last version to avoid redundant loads
  const lastVersionRef = useRef<number>(0);
  const ev = use$(appEvents);

  // Focus refresh callback - extracted to avoid hook nesting issues
  const focusRefreshCallback = useCallback(() => {
    const currentVersion = ev.anyVersion;
    if (currentVersion !== lastVersionRef.current) {
      lastVersionRef.current = currentVersion;
      loadDashboardData();
    }
  }, [ev.anyVersion, loadDashboardData]);

  // Use focus-aware refresh - only reload when screen focuses and data changed
  useFocusRefresh(focusRefreshCallback, {
    minInterval: 5000,
    dependencies: [startDate, endDate],
  });

  // Initial load and date filter change
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLogout = useCallback(async () => {
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
  }, []);

  const handlePushToCloud = useCallback(async () => {
    try {
      setPushRunning(true);
      await openDatabase();
      await syncService.pushLocalChanges();
      const ts = await syncService.getLastSyncAt();
      if (ts) setLastSyncAt(ts);
      Alert.alert("Push Complete", "Local data pushed to cloud successfully");
    } catch (e: any) {
      console.error("[sync] push failed", e);
      Alert.alert("Push Failed", e?.message || String(e));
    } finally {
      setPushRunning(false);
    }
  }, []);

  const handlePullFromCloud = useCallback(async () => {
    try {
      setPullRunning(true);
      await openDatabase();
      await syncService.pullCloudChanges();
      const ts = await syncService.getLastSyncAt();
      if (ts) setLastSyncAt(ts);
      Alert.alert("Pull Complete", "Cloud data synced to local successfully");
      loadDashboardData(); // Refresh dashboard after pull
    } catch (e: any) {
      console.error("[sync] pull failed", e);
      Alert.alert("Pull Failed", e?.message || String(e));
    } finally {
      setPullRunning(false);
    }
  }, [loadDashboardData]);

  const handleBackupDb = useCallback(async () => {
    try {
      setBackupRunning(true);
      await openDatabase();
      const res = await backupService.backupNow();
      setLatestBackup({
        name: res.objectPath.split("/").pop() || res.objectPath,
      });
      Alert.alert("Backup", `Backup uploaded: ${res.objectPath}`);
    } catch (e: any) {
      console.error("[backup] failed", e);
      Alert.alert("Backup failed", e?.message || String(e));
    } finally {
      setBackupRunning(false);
    }
  }, []);

  // Load last sync and latest backup on mount
  useEffect(() => {
    (async () => {
      try {
        await openDatabase();
        const ts = await syncService.getLastSyncAt();
        if (ts) setLastSyncAt(ts);
        const latest = await backupService.getLatestBackup();
        if (latest) setLatestBackup({ name: latest.name });
      } catch (e) {
        console.warn("[sync] failed to load last sync time", e);
      }
    })();
  }, []);

  const handleExpenseAdded = () => {
    loadDashboardData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (!user) {
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
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark || "#1e40af"]}
          style={[styles.headerGradient, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.headerTitle}>Dashboard</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleLogout}
                >
                  <LogOut size={18} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterSection}>
              <View style={styles.filterLabel}>
                <Calendar size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.filterLabelText}>Time Period</Text>
              </View>
              {/* Date Range Picker (default today) */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Calendar
                    size={16}
                    color="rgba(255,255,255,0.9)"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.95)",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {startDate.toLocaleDateString("en-CA")}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: 14,
                    alignSelf: "center",
                    fontWeight: "700",
                  }}
                >
                  to
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Calendar
                    size={16}
                    color="rgba(255,255,255,0.9)"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.95)",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {endDate.toLocaleDateString("en-CA")}
                  </Text>
                </TouchableOpacity>
              </View>
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
        </LinearGradient>

        <View style={styles.contentContainer}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricsRow}>
              <MetricCard
                title="Revenue"
                value={stats?.totalRevenue || 0}
                icon={<IndianRupee size={20} color={theme.colors.success} />}
                iconBg={theme.colors.successLight}
                valueColor={theme.colors.success}
                featured={true}
                subtitle="Total billed amount"
              />
              <MetricCard
                title="Profit"
                value={stats?.profit || 0}
                icon={
                  <TrendingUp
                    size={20}
                    color={
                      stats && stats.profit >= 0
                        ? theme.colors.success
                        : theme.colors.error
                    }
                  />
                }
                iconBg={
                  stats && stats.profit >= 0
                    ? theme.colors.successLight
                    : "#fef2f2"
                }
                valueColor={
                  stats && stats.profit >= 0
                    ? theme.colors.success
                    : theme.colors.error
                }
                featured={true}
                subtitle="Net earnings"
              />
            </View>

            <View style={styles.metricsRow}>
              <MetricCard
                title="Cash Received"
                value={stats?.cashReceived || 0}
                icon={
                  <BanknoteArrowDown size={20} color={theme.colors.primary} />
                }
                iconBg={theme.colors.primaryLight}
                subtitle="Cash payments"
              />
              <MetricCard
                title="Expenses"
                value={stats?.totalExpenses || 0}
                icon={<TrendingDown size={20} color={theme.colors.error} />}
                iconBg="#fef2f2"
                valueColor={theme.colors.error}
                subtitle="Total costs"
              />
            </View>

            <View style={styles.metricsRow}>
              <MetricCard
                title="Outstanding Credit"
                value={stats?.outstandingCredit || 0}
                icon={<AlertCircle size={20} color={theme.colors.warning} />}
                iconBg={theme.colors.warningLight}
                valueColor={theme.colors.warning}
                subtitle="Customer credit"
              />
              <MetricCard
                title="UPI Received"
                value={stats?.upiReceived || 0}
                icon={
                  <BanknoteArrowDown size={20} color={theme.colors.success} />
                }
                iconBg={theme.colors.successLight}
                valueColor={theme.colors.success}
                featured={true}
                subtitle="UPI payments"
              />
            </View>

            {/* Advance metric cards removed as per request */}
          </View>

          {/* Unbilled Orders Card removed */}

          {/* Sync & Backup */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              marginTop: 32,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Database size={20} color={theme.colors.primary} />
              <Text style={{ marginLeft: 8, fontWeight: "700", fontSize: 16 }}>
                Sync & Backup
              </Text>
            </View>
            <Text style={{ color: "#6b7280", marginBottom: 12 }}>
              Push local changes to cloud or pull cloud data to your device.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={handlePushToCloud}
                disabled={pushRunning || pullRunning}
                style={{
                  backgroundColor:
                    pushRunning || pullRunning ? "#9CA3AF" : "#10B981",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                {pushRunning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    ↑ Push
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePullFromCloud}
                disabled={pushRunning || pullRunning}
                style={{
                  backgroundColor:
                    pushRunning || pullRunning ? "#9CA3AF" : "#3B82F6",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                {pullRunning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    ↓ Pull
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                onPress={handleBackupDb}
                disabled={backupRunning}
                style={{
                  backgroundColor: "#fff",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  opacity: backupRunning ? 0.6 : 1,
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {backupRunning ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={{ color: "#111827", fontWeight: "600" }}>
                    Backup DB
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {lastSyncAt && (
              <Text style={{ marginTop: 8, color: "#6b7280" }}>
                Last sync: {new Date(lastSyncAt).toLocaleString()}
              </Text>
            )}
            {latestBackup && (
              <Text style={{ marginTop: 4, color: "#6b7280" }}>
                Latest backup: {latestBackup.name}
              </Text>
            )}
          </View>

          {user?.role === "admin" && (
            <View style={styles.adminCard}>
              <View style={styles.adminContent}>
                <View style={styles.adminText}>
                  <Text style={styles.adminTitle}>Admin Center</Text>
                  <Text style={styles.adminSubtitle}>Manage settings</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/admin-settings")}
                  style={styles.adminButton}
                >
                  <Settings size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleExpenseAdded}
      />
    </SafeAreaView>
  );
}
