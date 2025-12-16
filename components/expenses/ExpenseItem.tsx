import { Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import { ExpenseListItem } from "@/services/dashboardService";
import { formatCurrency, getCurrencyFontSize } from "@/utils/currency";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface ExpenseItemProps {
  expense: ExpenseListItem;
  index: number;
  onClearCredit?: (e: ExpenseListItem) => void;
  onPress?: (e: ExpenseListItem) => void;
}

export const ExpenseItem = React.memo<ExpenseItemProps>(
  function ExpenseItem({ expense, index, onClearCredit, onPress }) {
    const outstanding = expense.creditOutstanding || 0;
    const total = expense.amount || 0;
    // Display paid should include immediate + cleared credit; derive as total - outstanding, clamped to [0,total]
    const paidDisplay = Math.max(0, Math.min(total, total - outstanding));
    const ratio = Math.max(0, Math.min(1, total > 0 ? paidDisplay / total : 0));
    const pct = ratio * 100;
    const pctDisplay = pct > 0 && pct < 2 ? 2 : pct; // ensure a thin sliver is visible for tiny paid amounts
    const isFullyPaid = (outstanding ?? 0) <= 0 || expense.status === "Paid";
    const dateStr = expense.expenseDate
      ? new Date(expense.expenseDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : new Date(expense.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

    const statusStyles =
      expense.status === "Paid"
        ? { bg: "#ECFDF5", fg: "#059669" }
        : expense.status === "Partial"
          ? { bg: "#FFF9DB", fg: "#B45309" }
          : { bg: "#FFEEF0", fg: "#BE123C" };

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress && onPress(expense)}
        style={{
          backgroundColor: "white",
          padding: 14,
          borderRadius: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "#F1F5F9",
        }}
      >
        {/* Row 1: Title on left, Amount on right */}
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Typography
              variant="body"
              weight="bold"
              style={{ fontSize: 16, color: "#0F172A" }}
              numberOfLines={1}
            >
              {expense.towards}
            </Typography>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Typography
              variant="h4"
              weight="bold"
              style={{
                color: "#EF4444",
                fontSize: getCurrencyFontSize(total, 18),
                lineHeight: 22,
              }}
            >
              -{formatCurrency(total)}
            </Typography>
          </View>
        </View>

        {/* Row 2: Meta info */}
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ fontSize: 11 }}
            numberOfLines={1}
          >
            #{expense.voucherNo} · {dateStr}
          </Typography>
        </View>

        {/* Row 3: Remarks (single line) */}
        {expense.remarks ? (
          <Typography
            variant="caption"
            style={{ color: "#475569", marginTop: 6, fontSize: 12 }}
            numberOfLines={1}
          >
            {expense.remarks}
          </Typography>
        ) : null}

        {/* Row 4: Chips and Clear action */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                backgroundColor: statusStyles.bg,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Typography
                variant="caption"
                style={{
                  fontSize: 11,
                  color: statusStyles.fg,
                  fontWeight: "700",
                }}
              >
                {expense.status}
              </Typography>
            </View>

            <View
              style={{
                backgroundColor: "#F1F5F9",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Typography
                variant="caption"
                style={{ color: "#475569", fontSize: 11 }}
              >
                {expense.mode}
              </Typography>
            </View>
          </View>

          {outstanding > 0 && (
            <TouchableOpacity
              onPress={() => onClearCredit && onClearCredit(expense)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: theme.colors.primary,
                borderRadius: 8,
                minWidth: 84,
                alignItems: "center",
              }}
              activeOpacity={0.85}
            >
              <Typography
                style={{ color: "white", fontWeight: "700", fontSize: 12 }}
              >
                Clear
              </Typography>
            </TouchableOpacity>
          )}
        </View>

        {/* Row 5: Progress + summary (hidden when fully paid) */}
        {!isFullyPaid && (
          <View style={{ marginTop: 8 }}>
            <View
              style={{
                width: "100%",
                height: 6,
                backgroundColor: "#F1F5F9",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${pctDisplay}%`,
                  backgroundColor: theme.colors.primary,
                }}
              />
            </View>
            <View style={{ marginTop: 6, flexDirection: "row" }}>
              <Typography
                variant="caption"
                style={{
                  color: paidDisplay > 0 ? "#16A34A" : "#64748B",
                  fontSize: 11,
                }}
              >
                {paidDisplay > 0
                  ? `Paid ${formatCurrency(paidDisplay)}`
                  : "No payments yet"}
              </Typography>
              {outstanding > 0 ? (
                <Typography
                  variant="caption"
                  style={{ color: "#B91C1C", fontSize: 11, marginLeft: 8 }}
                >
                  · Due {formatCurrency(outstanding)}
                </Typography>
              ) : null}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if expense data changes
    return (
      prevProps.expense.id === nextProps.expense.id &&
      prevProps.expense.amount === nextProps.expense.amount &&
      prevProps.expense.status === nextProps.expense.status &&
      prevProps.expense.creditOutstanding ===
        nextProps.expense.creditOutstanding &&
      prevProps.expense.towards === nextProps.expense.towards &&
      prevProps.expense.mode === nextProps.expense.mode
    );
  }
);
