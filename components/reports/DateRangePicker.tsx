// components/reports/DateRangePicker.tsx
// Date range picker with quick select options for reports

import { theme } from "@/constants/theme";
import { QuickDateRange, ReportDateRange } from "@/types/reports";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ============================================================================
// Types
// ============================================================================

interface DateRangePickerProps {
  visible: boolean;
  currentRange: ReportDateRange;
  onApply: (range: ReportDateRange) => void;
  onClose: () => void;
}

interface QuickOption {
  id: QuickDateRange;
  label: string;
  icon: React.ReactNode;
  getRange: () => ReportDateRange;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date as YYYY-MM-DD
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format date for display (e.g., "Dec 19, 2025")
 */
function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Get Indian Financial Year start (April 1)
 */
function getFYStart(forDate: Date): Date {
  const year =
    forDate.getMonth() >= 3 ? forDate.getFullYear() : forDate.getFullYear() - 1;
  return new Date(year, 3, 1); // April 1
}

/**
 * Get Indian Financial Year end (March 31)
 */
function getFYEnd(forDate: Date): Date {
  const year =
    forDate.getMonth() >= 3 ? forDate.getFullYear() + 1 : forDate.getFullYear();
  return new Date(year, 2, 31); // March 31
}

/**
 * Get start of week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get end of week (Sunday)
 */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

// ============================================================================
// Quick Date Range Options
// ============================================================================

const getQuickOptions = (): QuickOption[] => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const thisWeekStart = getWeekStart(today);
  const thisWeekEnd = getWeekEnd(today);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const thisFYStart = getFYStart(today);
  const thisFYEnd = getFYEnd(today);

  const lastFYEnd = new Date(thisFYStart);
  lastFYEnd.setDate(lastFYEnd.getDate() - 1);
  const lastFYStart = getFYStart(lastFYEnd);

  return [
    {
      id: "today",
      label: "Today",
      icon: <Calendar size={18} color={theme.colors.primary} />,
      getRange: () => ({
        startDate: formatDateISO(today),
        endDate: formatDateISO(today),
      }),
    },
    {
      id: "yesterday",
      label: "Yesterday",
      icon: <Calendar size={18} color={theme.colors.textSecondary} />,
      getRange: () => ({
        startDate: formatDateISO(yesterday),
        endDate: formatDateISO(yesterday),
      }),
    },
    {
      id: "thisWeek",
      label: "This Week",
      icon: <CalendarDays size={18} color={theme.colors.primary} />,
      getRange: () => ({
        startDate: formatDateISO(thisWeekStart),
        endDate: formatDateISO(thisWeekEnd),
      }),
    },
    {
      id: "lastWeek",
      label: "Last Week",
      icon: <CalendarDays size={18} color={theme.colors.textSecondary} />,
      getRange: () => ({
        startDate: formatDateISO(lastWeekStart),
        endDate: formatDateISO(lastWeekEnd),
      }),
    },
    {
      id: "thisMonth",
      label: "This Month",
      icon: <CalendarRange size={18} color={theme.colors.primary} />,
      getRange: () => ({
        startDate: formatDateISO(thisMonthStart),
        endDate: formatDateISO(thisMonthEnd),
      }),
    },
    {
      id: "lastMonth",
      label: "Last Month",
      icon: <CalendarRange size={18} color={theme.colors.textSecondary} />,
      getRange: () => ({
        startDate: formatDateISO(lastMonthStart),
        endDate: formatDateISO(lastMonthEnd),
      }),
    },
    {
      id: "thisFY",
      label: "This Financial Year",
      icon: <CalendarRange size={18} color={theme.colors.success} />,
      getRange: () => ({
        startDate: formatDateISO(thisFYStart),
        endDate: formatDateISO(thisFYEnd),
      }),
    },
    {
      id: "lastFY",
      label: "Last Financial Year",
      icon: <CalendarRange size={18} color={theme.colors.textSecondary} />,
      getRange: () => ({
        startDate: formatDateISO(lastFYStart),
        endDate: formatDateISO(lastFYEnd),
      }),
    },
  ];
};

// ============================================================================
// Sub-components
// ============================================================================

interface QuickOptionButtonProps {
  option: QuickOption;
  isSelected: boolean;
  onPress: () => void;
}

const QuickOptionButton: React.FC<QuickOptionButtonProps> = ({
  option,
  isSelected,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.quickOption, isSelected && styles.quickOptionSelected]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.quickOptionIcon}>{option.icon}</View>
    <Text
      style={[
        styles.quickOptionLabel,
        isSelected && styles.quickOptionLabelSelected,
      ]}
    >
      {option.label}
    </Text>
    {isSelected && (
      <Check size={16} color={theme.colors.primary} style={styles.checkIcon} />
    )}
  </TouchableOpacity>
);

interface DateFieldProps {
  label: string;
  value: string;
  onPress: () => void;
}

const DateField: React.FC<DateFieldProps> = ({ label, value, onPress }) => (
  <TouchableOpacity
    style={styles.dateField}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={styles.dateFieldLabel}>{label}</Text>
    <View style={styles.dateFieldValue}>
      <Calendar size={16} color={theme.colors.primary} />
      <Text style={styles.dateFieldText}>{formatDateDisplay(value)}</Text>
      <ChevronRight size={16} color={theme.colors.textLight} />
    </View>
  </TouchableOpacity>
);

// ============================================================================
// Main Component
// ============================================================================

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  visible,
  currentRange,
  onApply,
  onClose,
}) => {
  // Local state for editing
  const [startDate, setStartDate] = useState(currentRange.startDate);
  const [endDate, setEndDate] = useState(currentRange.endDate);
  const [selectedQuick, setSelectedQuick] = useState<QuickDateRange | null>(
    null
  );

  // Date picker state
  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

  // Quick options (memoized)
  const quickOptions = useMemo(() => getQuickOptions(), []);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setStartDate(currentRange.startDate);
      setEndDate(currentRange.endDate);
      setSelectedQuick(null);
    }
  }, [visible, currentRange]);

  // Handle quick option selection
  const handleQuickSelect = useCallback((option: QuickOption) => {
    const range = option.getRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSelectedQuick(option.id);
  }, []);

  // Handle date change from picker
  const handleDateChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowPicker(null);
      }

      if (event.type === "dismissed" || !selectedDate) {
        setShowPicker(null);
        return;
      }

      const dateStr = formatDateISO(selectedDate);

      if (showPicker === "start") {
        setStartDate(dateStr);
        // If start is after end, adjust end
        if (dateStr > endDate) {
          setEndDate(dateStr);
        }
      } else if (showPicker === "end") {
        setEndDate(dateStr);
        // If end is before start, adjust start
        if (dateStr < startDate) {
          setStartDate(dateStr);
        }
      }

      // Clear quick selection since user is customizing
      setSelectedQuick("custom");

      if (Platform.OS === "android") {
        setShowPicker(null);
      }
    },
    [showPicker, startDate, endDate]
  );

  // Handle apply
  const handleApply = useCallback(() => {
    onApply({ startDate, endDate });
    onClose();
  }, [startDate, endDate, onApply, onClose]);

  // Check if current selection matches a quick option
  const getMatchingQuickOption = useCallback((): QuickDateRange | null => {
    for (const option of quickOptions) {
      const range = option.getRange();
      if (range.startDate === startDate && range.endDate === endDate) {
        return option.id;
      }
    }
    return null;
  }, [quickOptions, startDate, endDate]);

  // Determine which quick option is selected (if any)
  const effectiveQuickSelection = selectedQuick ?? getMatchingQuickOption();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date Range</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Select Options */}
            <Text style={styles.sectionTitle}>Quick Select</Text>
            <View style={styles.quickOptionsGrid}>
              {quickOptions.map((option) => (
                <QuickOptionButton
                  key={option.id}
                  option={option}
                  isSelected={effectiveQuickSelection === option.id}
                  onPress={() => handleQuickSelect(option)}
                />
              ))}
            </View>

            {/* Custom Date Range */}
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Custom Range</Text>

            <View style={styles.dateFields}>
              <DateField
                label="From"
                value={startDate}
                onPress={() => setShowPicker("start")}
              />
              <View style={styles.dateArrow}>
                <ChevronRight size={20} color={theme.colors.textLight} />
              </View>
              <DateField
                label="To"
                value={endDate}
                onPress={() => setShowPicker("end")}
              />
            </View>

            {/* Summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Selected Range</Text>
              <Text style={styles.summaryValue}>
                {formatDateDisplay(startDate)} — {formatDateDisplay(endDate)}
              </Text>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleApply}
            >
              <Check size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.buttonPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Native Date Picker */}
      {showPicker &&
        (Platform.OS === "ios" ? (
          <Modal
            visible={true}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPicker(null)}
          >
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowPicker(null)}>
                    <Text style={styles.pickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>
                    {showPicker === "start" ? "From Date" : "To Date"}
                  </Text>
                  <TouchableOpacity onPress={() => setShowPicker(null)}>
                    <Text style={styles.pickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={
                    new Date(
                      (showPicker === "start" ? startDate : endDate) +
                        "T00:00:00"
                    )
                  }
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  style={styles.picker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={
              new Date(
                (showPicker === "start" ? startDate : endDate) + "T00:00:00"
              )
            }
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        ))}
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
    justifyContent: "flex-end",
  },
  dialog: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Quick Options
  quickOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  quickOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  quickOptionIcon: {
    marginRight: 8,
  },
  quickOptionLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  quickOptionLabelSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  checkIcon: {
    marginLeft: 6,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 20,
  },

  // Date Fields
  dateFields: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateField: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  dateFieldValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateFieldText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    marginLeft: 8,
  },
  dateArrow: {
    paddingHorizontal: 8,
  },

  // Summary
  summaryBox: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
  },

  // Footer
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
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

  // iOS Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
  },
  pickerCancel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  picker: {
    height: 200,
  },
});

export default DateRangePicker;
