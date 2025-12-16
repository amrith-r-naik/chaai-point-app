import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

interface UseFocusRefreshOptions {
  /** Minimum time (ms) between refreshes. Default: 5000 (5 seconds) */
  minInterval?: number;
  /** Force refresh on every focus, ignoring the interval. Default: false */
  forceRefresh?: boolean;
  /** Dependencies that should trigger a refresh even within the interval */
  dependencies?: any[];
  /** Stale threshold (ms) - data older than this is considered stale. Default: 60000 (1 minute) */
  staleThreshold?: number;
  /** Custom function to check if data should be refreshed */
  shouldRefresh?: () => boolean;
}

/**
 * Custom hook to prevent unnecessary data re-fetches on screen focus.
 * Only triggers loadData if:
 * 1. It's the first load, OR
 * 2. More than minInterval ms have passed since last load, OR
 * 3. forceRefresh is true, OR
 * 4. Any dependency has changed, OR
 * 5. Custom shouldRefresh function returns true
 *
 * Usage:
 * ```tsx
 * useFocusRefresh(loadData, { minInterval: 5000 });
 * ```
 */
export function useFocusRefresh(
  loadData: () => void | Promise<void>,
  options: UseFocusRefreshOptions = {}
) {
  const {
    minInterval = 5000,
    forceRefresh = false,
    dependencies = [],
    staleThreshold = 60000, // 1 minute default
    shouldRefresh: customShouldRefresh,
  } = options;

  const hasLoadedRef = useRef(false);
  const lastLoadRef = useRef<number>(0);
  const lastDepsRef = useRef<string>("");

  // Serialize dependencies for comparison
  const depsKey = JSON.stringify(dependencies);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const depsChanged = depsKey !== lastDepsRef.current;
      const isStale = now - lastLoadRef.current > staleThreshold;
      const intervalPassed = now - lastLoadRef.current > minInterval;

      // Determine if we should refresh
      const shouldRefreshNow =
        forceRefresh ||
        !hasLoadedRef.current ||
        intervalPassed ||
        depsChanged ||
        (customShouldRefresh ? customShouldRefresh() : false) ||
        (isStale && !hasLoadedRef.current);

      if (shouldRefreshNow) {
        loadData();
        hasLoadedRef.current = true;
        lastLoadRef.current = now;
        lastDepsRef.current = depsKey;
      }
    }, [
      loadData,
      minInterval,
      forceRefresh,
      depsKey,
      staleThreshold,
      customShouldRefresh,
    ])
  );

  // Return utility function to manually mark data as fresh
  return {
    markFresh: useCallback(() => {
      lastLoadRef.current = Date.now();
      hasLoadedRef.current = true;
    }, []),
    getLastLoadTime: useCallback(() => lastLoadRef.current, []),
    isStale: useCallback(
      () => Date.now() - lastLoadRef.current > staleThreshold,
      [staleThreshold]
    ),
  };
}

/**
 * Smart focus refresh hook that only refreshes if data is stale.
 * Useful for back navigation optimization.
 *
 * Usage:
 * ```tsx
 * useSmartFocusRefresh(loadData, {
 *   staleThreshold: 60000, // 1 minute
 *   dependencies: [someValue],
 * });
 * ```
 */
export function useSmartFocusRefresh(
  loadData: () => void | Promise<void>,
  options: { staleThreshold?: number; dependencies?: any[] } = {}
) {
  const { staleThreshold = 60000, dependencies = [] } = options;

  const lastLoadRef = useRef<number>(0);
  const lastDepsRef = useRef<string>("");
  const isLoadingRef = useRef(false);

  const depsKey = JSON.stringify(dependencies);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const isStale = now - lastLoadRef.current > staleThreshold;
      const depsChanged = depsKey !== lastDepsRef.current;
      const isFirstLoad = lastLoadRef.current === 0;

      // Only refresh if stale, first load, or dependencies changed
      if ((isStale || isFirstLoad || depsChanged) && !isLoadingRef.current) {
        isLoadingRef.current = true;
        Promise.resolve(loadData()).finally(() => {
          isLoadingRef.current = false;
          lastLoadRef.current = Date.now();
          lastDepsRef.current = depsKey;
        });
      }
    }, [loadData, staleThreshold, depsKey])
  );
}

/**
 * Track if screen has been mounted before to skip unnecessary initial loads.
 * Useful for tabs that don't need to reload on every mount.
 */
export function useScreenMountTracker(_screenName: string) {
  const mountCountRef = useRef(0);
  const isFirstMount = useRef(true);

  useFocusEffect(
    useCallback(() => {
      mountCountRef.current++;
      isFirstMount.current = false;

      return () => {
        // Optional: track unmounts if needed
      };
    }, [])
  );

  return {
    isFirstMount: isFirstMount.current,
    mountCount: mountCountRef.current,
  };
}
