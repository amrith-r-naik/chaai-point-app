import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

interface UseFocusRefreshOptions {
  /** Minimum time (ms) between refreshes. Default: 5000 (5 seconds) */
  minInterval?: number;
  /** Force refresh on every focus, ignoring the interval. Default: false */
  forceRefresh?: boolean;
  /** Dependencies that should trigger a refresh even within the interval */
  dependencies?: any[];
}

/**
 * Custom hook to prevent unnecessary data re-fetches on screen focus.
 * Only triggers loadData if:
 * 1. It's the first load, OR
 * 2. More than minInterval ms have passed since last load, OR
 * 3. forceRefresh is true, OR
 * 4. Any dependency has changed
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

      // Determine if we should refresh
      const shouldRefresh =
        forceRefresh ||
        !hasLoadedRef.current ||
        now - lastLoadRef.current > minInterval ||
        depsChanged;

      if (shouldRefresh) {
        loadData();
        hasLoadedRef.current = true;
        lastLoadRef.current = now;
        lastDepsRef.current = depsKey;
      }
    }, [loadData, minInterval, forceRefresh, depsKey])
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
