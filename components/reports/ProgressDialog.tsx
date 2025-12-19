// components/reports/ProgressDialog.tsx
// Progress dialog for report generation with detailed step tracking

import { theme } from "@/constants/theme";
import { csvExporter } from "@/services/csvExporter";
import {
    DownloadAllProgress,
    REPORT_DEFINITIONS,
    ReportProgress,
    ReportType,
} from "@/types/reports";
import {
    AlertCircle,
    Check,
    CheckCircle,
    Circle,
    Eye,
    Loader2,
    Save,
    Share2,
    XCircle
} from "lucide-react-native";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// ============================================================================
// Types
// ============================================================================

interface ProgressDialogProps {
  visible: boolean;
  mode: "single" | "all";

  // Single report progress
  singleProgress?: ReportProgress | null;

  // Download all progress
  allProgress?: DownloadAllProgress | null;

  // Completion state
  isComplete?: boolean;
  completedFileCount?: number;
  totalFileSize?: string;
  completionTime?: number; // seconds

  // Error state
  error?: string | null;

  // Cancellation
  isCancelled?: boolean;
  hasPartialResults?: boolean;

  // Actions
  onCancel: () => void;
  onView?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onDownloadPartial?: () => void;
  onDiscard?: () => void;
  onClose?: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ProgressBarProps {
  percent: number;
  color?: string;
  height?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  color = theme.colors.primary,
  height = 8,
}) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <View
      style={[
        styles.progressBarContainer,
        { height, borderRadius: height / 2 },
      ]}
    >
      <View
        style={[
          styles.progressBarFill,
          {
            width: `${clampedPercent}%`,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

interface StepItemProps {
  label: string;
  status: "pending" | "in-progress" | "done" | "error";
  detail?: string;
}

const StepItem: React.FC<StepItemProps> = ({ label, status, detail }) => {
  const getIcon = () => {
    switch (status) {
      case "done":
        return <Check size={16} color={theme.colors.success} />;
      case "in-progress":
        return <ActivityIndicator size="small" color={theme.colors.primary} />;
      case "error":
        return <XCircle size={16} color={theme.colors.error} />;
      default:
        return <Circle size={16} color={theme.colors.textLight} />;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case "done":
        return theme.colors.text;
      case "in-progress":
        return theme.colors.primary;
      case "error":
        return theme.colors.error;
      default:
        return theme.colors.textLight;
    }
  };

  return (
    <View style={styles.stepItem}>
      <View style={styles.stepIcon}>{getIcon()}</View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepLabel, { color: getTextColor() }]}>
          {label}
        </Text>
        {detail && <Text style={styles.stepDetail}>{detail}</Text>}
      </View>
    </View>
  );
};

interface ReportListItemProps {
  name: string;
  status: "pending" | "in-progress" | "done" | "error";
  error?: string;
}

const ReportListItem: React.FC<ReportListItemProps> = ({
  name,
  status,
  error,
}) => {
  const getIcon = () => {
    switch (status) {
      case "done":
        return <CheckCircle size={18} color={theme.colors.success} />;
      case "in-progress":
        return <Loader2 size={18} color={theme.colors.primary} />;
      case "error":
        return <XCircle size={18} color={theme.colors.error} />;
      default:
        return <Circle size={18} color={theme.colors.textLight} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "done":
        return "Done";
      case "in-progress":
        return "Generating...";
      case "error":
        return error || "Error";
      default:
        return "Pending";
    }
  };

  return (
    <View style={styles.reportListItem}>
      <View style={styles.reportListIcon}>{getIcon()}</View>
      <Text
        style={[
          styles.reportListName,
          status === "pending" && { color: theme.colors.textLight },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        style={[
          styles.reportListStatus,
          status === "done" && { color: theme.colors.success },
          status === "error" && { color: theme.colors.error },
          status === "in-progress" && { color: theme.colors.primary },
        ]}
      >
        {getStatusText()}
      </Text>
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ProgressDialog: React.FC<ProgressDialogProps> = ({
  visible,
  mode,
  singleProgress,
  allProgress,
  isComplete,
  completedFileCount,
  totalFileSize,
  completionTime,
  error,
  isCancelled,
  hasPartialResults,
  onCancel,
  onView,
  onSave,
  onShare,
  onDownloadPartial,
  onDiscard,
  onClose,
}) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Render: Error State
  // ─────────────────────────────────────────────────────────────────────────
  const renderErrorState = () => (
    <View style={styles.centerContent}>
      <View style={styles.iconCircleError}>
        <AlertCircle size={40} color={theme.colors.error} />
      </View>
      <Text style={styles.title}>Generation Failed</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={onClose || onCancel}
      >
        <Text style={styles.buttonSecondaryText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Cancelled State
  // ─────────────────────────────────────────────────────────────────────────
  const renderCancelledState = () => (
    <View style={styles.centerContent}>
      <View style={styles.iconCircleWarning}>
        <XCircle size={40} color={theme.colors.warning} />
      </View>
      <Text style={styles.title}>Generation Cancelled</Text>
      {hasPartialResults && allProgress ? (
        <>
          <Text style={styles.subtitle}>
            {allProgress.completedReports} of {allProgress.totalReports} reports
            were completed before cancellation.
          </Text>
          <Text style={styles.subtitle}>
            Would you like to download the partial reports?
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
              onPress={onDiscard}
            >
              <Text style={styles.buttonSecondaryText}>Discard All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { flex: 1 }]}
              onPress={onDownloadPartial}
            >
              <Text style={styles.buttonPrimaryText}>Download Partial</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={onClose || onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Complete State
  // ─────────────────────────────────────────────────────────────────────────
  const renderCompleteState = () => (
    <View style={styles.centerContent}>
      <View style={styles.iconCircleSuccess}>
        <CheckCircle size={40} color={theme.colors.success} />
      </View>
      <Text style={styles.title}>
        {mode === "all" ? "Reports Generated!" : "Report Generated!"}
      </Text>

      <View style={styles.statsRow}>
        {completedFileCount !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedFileCount}</Text>
            <Text style={styles.statLabel}>
              {completedFileCount === 1 ? "Report" : "Reports"}
            </Text>
          </View>
        )}
        {totalFileSize && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalFileSize}</Text>
            <Text style={styles.statLabel}>Size</Text>
          </View>
        )}
        {completionTime !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completionTime}s</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        )}
      </View>

      {/* Three action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
          onPress={onView}
        >
          <Eye size={16} color={theme.colors.text} style={{ marginRight: 4 }} />
          <Text style={styles.buttonSecondaryText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
          onPress={onSave}
        >
          <Save size={16} color={theme.colors.text} style={{ marginRight: 4 }} />
          <Text style={styles.buttonSecondaryText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, { flex: 1 }]}
          onPress={onShare}
        >
          <Share2 size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.buttonPrimaryText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Separate Close button */}
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary, { marginTop: 12, width: "100%" }]}
        onPress={onClose || onCancel}
      >
        <Text style={styles.buttonSecondaryText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Single Report Progress
  // ─────────────────────────────────────────────────────────────────────────
  const renderSingleProgress = () => {
    if (!singleProgress) return null;

    const reportDef = REPORT_DEFINITIONS.find(
      (r) => r.type === singleProgress.reportType
    );

    return (
      <View style={styles.progressContent}>
        <Text style={styles.title}>Generating Report</Text>

        <View style={styles.currentReportSection}>
          <Text style={styles.currentReportName}>
            {reportDef?.name || singleProgress.reportName}
          </Text>
        </View>

        <ProgressBar percent={singleProgress.overallPercent} />
        <Text style={styles.percentText}>
          {Math.round(singleProgress.overallPercent)}%
        </Text>

        <View style={styles.divider} />

        <View style={styles.stepsContainer}>
          {singleProgress.steps.map((step) => (
            <StepItem key={step.id} label={step.label} status={step.status} />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.timeRow}>
          <Text style={styles.timeIcon}>⏱️</Text>
          <Text style={styles.timeText}>
            Estimated time remaining:{" "}
            {csvExporter.formatTimeRemaining(
              singleProgress.estimatedSecondsRemaining
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Download All Progress
  // ─────────────────────────────────────────────────────────────────────────
  const renderAllProgress = () => {
    if (!allProgress) return null;

    const overallPercent =
      (allProgress.completedReports / allProgress.totalReports) * 100;

    // Build combined list in order: completed, current, pending
    const allReports: {
      type: ReportType;
      name: string;
      status: "pending" | "in-progress" | "done" | "error";
      error?: string;
    }[] = [];

    // Add completed
    for (const item of allProgress.completedList) {
      allReports.push({
        type: item.type,
        name: item.name,
        status: item.status,
        error: item.error,
      });
    }

    // Add current (if any)
    if (allProgress.currentReport) {
      const def = REPORT_DEFINITIONS.find(
        (r) => r.type === allProgress.currentReport?.reportType
      );
      allReports.push({
        type: allProgress.currentReport.reportType,
        name: def?.name || allProgress.currentReport.reportName,
        status: "in-progress",
      });
    }

    // Add pending
    for (const item of allProgress.pendingList) {
      allReports.push({
        type: item.type,
        name: item.name,
        status: "pending",
      });
    }

    return (
      <View style={styles.progressContent}>
        <Text style={styles.title}>Generating All Reports</Text>

        {/* Overall Progress */}
        <View style={styles.overallSection}>
          <Text style={styles.sectionLabel}>Overall Progress</Text>
          <ProgressBar percent={overallPercent} />
          <Text style={styles.percentText}>
            {allProgress.completedReports} of {allProgress.totalReports} reports
            ({Math.round(overallPercent)}%)
          </Text>
        </View>

        {/* Current Report Progress */}
        {allProgress.currentReport && (
          <View style={styles.currentSection}>
            <Text style={styles.sectionLabel}>
              Current: {allProgress.currentReport.reportName}
            </Text>
            <ProgressBar
              percent={allProgress.currentReport.overallPercent}
              color={theme.colors.info}
              height={6}
            />
            <Text style={styles.smallPercentText}>
              {Math.round(allProgress.currentReport.overallPercent)}%
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Report List */}
        <ScrollView
          style={styles.reportListScroll}
          showsVerticalScrollIndicator={false}
        >
          {allReports.map((report) => (
            <ReportListItem
              key={report.type}
              name={report.name}
              status={report.status}
              error={report.error}
            />
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <View style={styles.timeRow}>
          <Text style={styles.timeIcon}>⏱️</Text>
          <Text style={styles.timeText}>
            Estimated time remaining:{" "}
            {csvExporter.formatTimeRemaining(
              allProgress.estimatedSecondsRemaining
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (error) {
      return renderErrorState();
    }

    if (isCancelled) {
      return renderCancelledState();
    }

    if (isComplete) {
      return renderCompleteState();
    }

    if (mode === "single") {
      return renderSingleProgress();
    }

    return renderAllProgress();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>{renderContent()}</View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  centerContent: {
    alignItems: "center",
    padding: 24,
  },
  progressContent: {
    padding: 24,
  },

  // Title and subtitles
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },

  // Icon circles
  iconCircleSuccess: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.successLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircleWarning: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.warningLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircleError: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.errorLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  // Progress bar
  progressBarContainer: {
    width: "100%",
    backgroundColor: theme.colors.borderLight,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },
  percentText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  smallPercentText: {
    fontSize: 12,
    color: theme.colors.textLight,
    textAlign: "center",
    marginTop: 4,
  },

  // Sections
  overallSection: {
    marginBottom: 16,
  },
  currentSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  currentReportSection: {
    marginBottom: 16,
  },
  currentReportName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
    textAlign: "center",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 16,
  },

  // Steps
  stepsContainer: {
    gap: 8,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepIcon: {
    width: 24,
    alignItems: "center",
  },
  stepContent: {
    flex: 1,
    marginLeft: 8,
  },
  stepLabel: {
    fontSize: 14,
  },
  stepDetail: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
  },

  // Report list
  reportListScroll: {
    maxHeight: 200,
  },
  reportListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  reportListIcon: {
    width: 24,
    alignItems: "center",
  },
  reportListName: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
  },
  reportListStatus: {
    fontSize: 12,
    color: theme.colors.textLight,
  },

  // Time estimate
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  timeText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // Stats (completion)
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginVertical: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Buttons
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
  },
  cancelButton: {
    marginTop: 20,
    alignSelf: "center",
    minWidth: 120,
  },
});

export default ProgressDialog;
