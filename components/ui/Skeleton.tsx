// components/ui/Skeleton.tsx
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

interface SkeletonProps {
  width?: number | `${number}%` | "auto";
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Animated skeleton placeholder for loading states.
 * Shows a pulsing animation to indicate content is loading.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton for metric cards on the dashboard
 */
export const MetricCardSkeleton: React.FC<{ featured?: boolean }> = ({
  featured = false,
}) => {
  return (
    <View
      style={[styles.metricCard, featured && styles.featuredCard, { flex: 1 }]}
    >
      <View style={styles.metricHeader}>
        <Skeleton width={80} height={14} />
        <Skeleton width={40} height={40} borderRadius={12} />
      </View>
      <Skeleton width="60%" height={28} style={{ marginTop: 12 }} />
      <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
    </View>
  );
};

/**
 * Skeleton for stat cards on the billing screen
 */
export const StatCardSkeleton: React.FC = () => {
  return (
    <View style={styles.statCard}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Skeleton width={56} height={56} borderRadius={16} />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Skeleton width={60} height={12} />
          <Skeleton width="50%" height={22} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>
  );
};

/**
 * Skeleton for list items (customers, orders, etc.)
 */
export const ListItemSkeleton: React.FC = () => {
  return (
    <View style={styles.listItem}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={60} height={20} borderRadius={4} />
    </View>
  );
};

/**
 * Dashboard skeleton - shows full dashboard layout while loading
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.dashboardContainer}>
      {/* Metrics Grid Skeleton */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricsRow}>
          <MetricCardSkeleton featured />
          <MetricCardSkeleton />
        </View>
        <View style={styles.metricsRow}>
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </View>
        <View style={styles.metricsRow}>
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#E2E8F0",
  },
  metricCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  featuredCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statCard: {
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
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dashboardContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  metricsGrid: {
    gap: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 14,
  },
});
