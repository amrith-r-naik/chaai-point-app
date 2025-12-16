/**
 * Hook to track screen performance metrics (dev-only, no-op in production)
 * Removed performance monitoring to reduce bundle size and complexity
 */
export function useScreenPerformance(screenName: string) {
  // No-op: Performance monitoring removed for production
}

/**
 * Hook to measure a specific operation's performance (dev-only, no-op)
 */
export function useMeasureRender(componentName: string) {
  // No-op: Performance monitoring removed for production
}
