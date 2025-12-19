// app/reports.tsx
// Reports screen for generating and downloading CSV reports

import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { ProgressDialog } from "@/components/reports/ProgressDialog";
import {
  DateRangeDisplay,
  DownloadAllButton,
  ReportCard,
  ReportSectionHeader,
} from "@/components/reports/ReportCard";
import { theme } from "@/constants/theme";
import { reportService } from "@/services/reportService";
import { authState } from "@/state/authState";
import {
  CancellationToken,
  DownloadAllProgress,
  REPORT_DEFINITIONS,
  ReportDateRange,
  ReportProgress,
  ReportType,
} from "@/types/reports";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import {
  ArrowLeft,
  Banknote,
  BarChart3,
  ClipboardList,
  Lock,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ============================================================================
// Types
// ============================================================================

type DialogMode = "single" | "all";

interface DialogState {
  visible: boolean;
  mode: DialogMode;
  singleProgress: ReportProgress | null;
  allProgress: DownloadAllProgress | null;
  isComplete: boolean;
  error: string | null;
  isCancelled: boolean;
  completedFileCount: number;
  totalFileSize: string;
  completionTime: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getThisMonthDateRange(): ReportDateRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  return { startDate, endDate };
}

// ============================================================================
// Main Component
// ============================================================================

export default function ReportsScreen() {
  // Auth check
  const user = use$(authState.user);

  // Date range state - default to this month
  const [dateRange, setDateRange] = useState<ReportDateRange>(
    getThisMonthDateRange()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Loading state for individual reports
  const [loadingReport, setLoadingReport] = useState<ReportType | null>(null);

  // Cancellation token ref
  const cancellationTokenRef = useRef<CancellationToken | null>(null);

  // Progress dialog state
  const [dialogState, setDialogState] = useState<DialogState>({
    visible: false,
    mode: "single",
    singleProgress: null,
    allProgress: null,
    isComplete: false,
    error: null,
    isCancelled: false,
    completedFileCount: 0,
    totalFileSize: "",
    completionTime: 0,
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login");
    }
  }, [user]);

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  // Group reports by category
  const reportsByCategory = useMemo(() => {
    const categories: Record<string, typeof REPORT_DEFINITIONS> = {
      financial: [],
      receivables: [],
      summary: [],
      analytics: [],
      audit: [],
    };

    REPORT_DEFINITIONS.forEach((report) => {
      categories[report.category].push(report);
    });

    return categories;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleDateRangeChange = useCallback((range: ReportDateRange) => {
    setDateRange(range);
  }, []);

  const handleDownloadReport = useCallback(
    async (reportType: ReportType) => {
      // All 13 reports are now implemented
      const implementedReports: ReportType[] = [
        "cashBook",
        "upiBook",
        "salesRegister",
        "expenseRegister",
        "debtorsReport",
        "creditorsReport",
        "advanceLiability",
        "dailySummary",
        "monthlySummary",
        "itemwiseSales",
        "customerAnalysis",
        "receiptRegister",
        "billRegister",
      ];

      if (!implementedReports.includes(reportType)) {
        Alert.alert(
          "Coming Soon",
          "This report is not yet available. It will be implemented soon.",
          [{ text: "OK" }]
        );
        return;
      }

      // Create cancellation token
      cancellationTokenRef.current = new CancellationToken();
      const startTime = Date.now();

      // Show progress dialog
      setDialogState({
        visible: true,
        mode: "single",
        singleProgress: null,
        allProgress: null,
        isComplete: false,
        error: null,
        isCancelled: false,
        completedFileCount: 0,
        totalFileSize: "",
        completionTime: 0,
      });

      setLoadingReport(reportType);

      try {
        const result = await reportService.exportReport(
          reportType,
          { dateRange },
          (progress) => {
            setDialogState((prev) => ({
              ...prev,
              singleProgress: progress,
            }));
          },
          cancellationTokenRef.current
        );

        if (result.success) {
          const endTime = Date.now();
          setDialogState((prev) => ({
            ...prev,
            isComplete: true,
            completedFileCount: 1,
            completionTime: Math.round((endTime - startTime) / 1000),
          }));
        } else if (result.error === "Operation cancelled") {
          setDialogState((prev) => ({
            ...prev,
            isCancelled: true,
          }));
        } else {
          setDialogState((prev) => ({
            ...prev,
            error: result.error || "Export failed",
          }));
        }
      } catch (error) {
        console.error("[Reports] Export error:", error);
        setDialogState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Export failed",
        }));
      } finally {
        setLoadingReport(null);
      }
    },
    [dateRange]
  );

  const handleDownloadAll = useCallback(() => {
    Alert.alert(
      "Coming Soon",
      "Download All Reports feature will be available once all individual reports are implemented.",
      [{ text: "OK" }]
    );
  }, []);

  const handleCancelDownload = useCallback(() => {
    cancellationTokenRef.current?.cancel();
    setDialogState((prev) => ({
      ...prev,
      isCancelled: true,
    }));
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogState({
      visible: false,
      mode: "single",
      singleProgress: null,
      allProgress: null,
      isComplete: false,
      error: null,
      isCancelled: false,
      completedFileCount: 0,
      totalFileSize: "",
      completionTime: 0,
    });
  }, []);

  const handleShare = useCallback(() => {
    // The file was already shared when export completed
    handleCloseDialog();
  }, [handleCloseDialog]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Access Denied for non-admin
  // ─────────────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reports</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.accessDenied}>
          <View style={styles.accessDeniedIcon}>
            <Lock size={48} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.accessDeniedTitle}>Admin Access Required</Text>
          <Text style={styles.accessDeniedText}>
            Reports are only available for admin users. Please contact your
            administrator for access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Main Screen
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Selector */}
        <DateRangeDisplay
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onPress={() => setShowDatePicker(true)}
        />

        {/* Download All Button */}
        <DownloadAllButton isLoading={false} onPress={handleDownloadAll} />

        {/* Financial Ledgers Section */}
        <ReportSectionHeader
          title="Financial Ledgers"
          icon={<Banknote size={16} color={theme.colors.textSecondary} />}
        />
        {reportsByCategory.financial.map((report) => (
          <ReportCard
            key={report.type}
            report={report}
            isLoading={loadingReport === report.type}
            onDownload={() => handleDownloadReport(report.type)}
          />
        ))}

        {/* Receivables & Payables Section */}
        <ReportSectionHeader
          title="Receivables & Payables"
          icon={<Wallet size={16} color={theme.colors.textSecondary} />}
        />
        {reportsByCategory.receivables.map((report) => (
          <ReportCard
            key={report.type}
            report={report}
            isLoading={loadingReport === report.type}
            onDownload={() => handleDownloadReport(report.type)}
          />
        ))}

        {/* Summary Reports Section */}
        <ReportSectionHeader
          title="Summary Reports"
          icon={<BarChart3 size={16} color={theme.colors.textSecondary} />}
        />
        {reportsByCategory.summary.map((report) => (
          <ReportCard
            key={report.type}
            report={report}
            isLoading={loadingReport === report.type}
            onDownload={() => handleDownloadReport(report.type)}
          />
        ))}

        {/* Analytics Section */}
        <ReportSectionHeader
          title="Analytics"
          icon={<TrendingUp size={16} color={theme.colors.textSecondary} />}
        />
        {reportsByCategory.analytics.map((report) => (
          <ReportCard
            key={report.type}
            report={report}
            isLoading={loadingReport === report.type}
            onDownload={() => handleDownloadReport(report.type)}
          />
        ))}

        {/* Audit Trail Section */}
        <ReportSectionHeader
          title="Audit Trail"
          icon={<ClipboardList size={16} color={theme.colors.textSecondary} />}
        />
        {reportsByCategory.audit.map((report) => (
          <ReportCard
            key={report.type}
            report={report}
            isLoading={loadingReport === report.type}
            onDownload={() => handleDownloadReport(report.type)}
          />
        ))}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Date Range Picker Modal */}
      <DateRangePicker
        visible={showDatePicker}
        currentRange={dateRange}
        onApply={handleDateRangeChange}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Progress Dialog */}
      <ProgressDialog
        visible={dialogState.visible}
        mode={dialogState.mode}
        singleProgress={dialogState.singleProgress}
        allProgress={dialogState.allProgress}
        isComplete={dialogState.isComplete}
        completedFileCount={dialogState.completedFileCount}
        totalFileSize={dialogState.totalFileSize}
        completionTime={dialogState.completionTime}
        error={dialogState.error}
        isCancelled={dialogState.isCancelled}
        hasPartialResults={false}
        onCancel={handleCancelDownload}
        onShare={handleShare}
        onClose={handleCloseDialog}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  headerRight: {
    width: 40,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  bottomPadding: {
    height: 40,
  },

  // Access Denied
  accessDenied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  accessDeniedIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  accessDeniedText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
