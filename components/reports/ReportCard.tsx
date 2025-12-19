// components/reports/ReportCard.tsx
// Individual report card component for the reports list

import { theme } from "@/constants/theme";
import { ReportMeta } from "@/types/reports";
import {
  Banknote,
  Calendar,
  CalendarDays,
  Coffee,
  Download,
  FileCheck,
  FileStack,
  FileText,
  Receipt,
  Smartphone,
  Store,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react-native";
import React, { memo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ============================================================================
// Types
// ============================================================================

interface ReportCardProps {
  report: ReportMeta;
  isLoading?: boolean;
  onDownload: () => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const getReportIcon = (iconName: string, size: number = 24) => {
  const color = theme.colors.primary;

  switch (iconName) {
    case "Banknote":
      return <Banknote size={size} color={color} />;
    case "Smartphone":
      return <Smartphone size={size} color={color} />;
    case "Receipt":
      return <Receipt size={size} color={color} />;
    case "FileText":
      return <FileText size={size} color={color} />;
    case "Users":
      return <Users size={size} color={color} />;
    case "Store":
      return <Store size={size} color={color} />;
    case "Wallet":
      return <Wallet size={size} color={color} />;
    case "Calendar":
      return <Calendar size={size} color={color} />;
    case "CalendarDays":
      return <CalendarDays size={size} color={color} />;
    case "Coffee":
      return <Coffee size={size} color={color} />;
    case "UserCheck":
      return <UserCheck size={size} color={color} />;
    case "FileCheck":
      return <FileCheck size={size} color={color} />;
    case "FileStack":
      return <FileStack size={size} color={color} />;
    default:
      return <FileText size={size} color={color} />;
  }
};

// ============================================================================
// Main Component
// ============================================================================

export const ReportCard: React.FC<ReportCardProps> = memo(
  function ReportCard({ report, isLoading = false, onDownload }) {
    return (
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          {getReportIcon(report.icon, 24)}
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {report.name}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {report.description}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.downloadButton,
            isLoading && styles.downloadButtonLoading,
          ]}
          onPress={onDownload}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Download size={20} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if loading state or report changes
    return (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.report.type === nextProps.report.type
    );
  }
);

// ============================================================================
// Section Header Component
// ============================================================================

interface ReportSectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
}

export const ReportSectionHeader: React.FC<ReportSectionHeaderProps> = ({
  title,
  icon,
}) => (
  <View style={styles.sectionHeader}>
    {icon && <View style={styles.sectionIcon}>{icon}</View>}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ============================================================================
// Download All Button Component
// ============================================================================

interface DownloadAllButtonProps {
  isLoading?: boolean;
  onPress: () => void;
}

export const DownloadAllButton: React.FC<DownloadAllButtonProps> = ({
  isLoading = false,
  onPress,
}) => (
  <TouchableOpacity
    style={[
      styles.downloadAllButton,
      isLoading && styles.downloadAllButtonLoading,
    ]}
    onPress={onPress}
    disabled={isLoading}
    activeOpacity={0.8}
  >
    <View style={styles.downloadAllIcon}>
      {isLoading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Download size={22} color="#fff" />
      )}
    </View>
    <View style={styles.downloadAllContent}>
      <Text style={styles.downloadAllTitle}>Download All Reports</Text>
      <Text style={styles.downloadAllSubtitle}>
        Generate all 13 reports as a ZIP file
      </Text>
    </View>
  </TouchableOpacity>
);

// ============================================================================
// Date Range Display Component
// ============================================================================

interface DateRangeDisplayProps {
  startDate: string;
  endDate: string;
  onPress: () => void;
}

export const DateRangeDisplay: React.FC<DateRangeDisplayProps> = ({
  startDate,
  endDate,
  onPress,
}) => {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <TouchableOpacity
      style={styles.dateRangeCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.dateRangeIconContainer}>
        <Calendar size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.dateRangeContent}>
        <Text style={styles.dateRangeLabel}>Date Range</Text>
        <Text style={styles.dateRangeValue}>
          {formatDate(startDate)} — {formatDate(endDate)}
        </Text>
      </View>
      <View style={styles.changeButton}>
        <Text style={styles.changeButtonText}>Change</Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Report Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  downloadButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary + "30",
  },
  downloadButtonLoading: {
    opacity: 0.7,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Download All Button
  downloadAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 18,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  downloadAllButtonLoading: {
    opacity: 0.8,
  },
  downloadAllIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  downloadAllContent: {
    flex: 1,
  },
  downloadAllTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  downloadAllSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },

  // Date Range Display
  dateRangeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  dateRangeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dateRangeContent: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  dateRangeValue: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
  },
  changeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.primary,
  },
});

export default ReportCard;
