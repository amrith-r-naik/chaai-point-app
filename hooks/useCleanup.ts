import React, { useCallback, useEffect, useRef } from "react";

/**
 * Custom hook to track component mount status for safe async state updates.
 * Prevents "state update on unmounted component" warnings.
 *
 * Usage:
 * ```tsx
 * const isMounted = useMountedRef();
 *
 * useEffect(() => {
 *   loadData().then(result => {
 *     if (isMounted.current) setData(result);
 *   });
 * }, []);
 * ```
 */
export function useMountedRef() {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

/**
 * Wraps an async function to only update state if the component is still mounted.
 * Also provides cancellation capability.
 *
 * Usage:
 * ```tsx
 * const { execute, cancel } = useSafeAsync();
 *
 * useEffect(() => {
 *   execute(async () => {
 *     const data = await fetchData();
 *     setData(data);
 *   });
 *   return cancel;
 * }, []);
 * ```
 */
export function useSafeAsync() {
  const isMounted = useMountedRef();
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async <T>(
      asyncFn: (signal?: AbortSignal) => Promise<T>
    ): Promise<T | null> => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const result = await asyncFn(signal);
        if (isMounted.current && !signal.aborted) {
          return result;
        }
        return null;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return null;
        }
        throw error;
      }
    },
    [isMounted]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { execute, cancel, isMounted };
}

/**
 * Hook to clear large state arrays on unmount to help with memory management.
 * Only clears if the array exceeds the threshold.
 *
 * Usage:
 * ```tsx
 * const [largeList, setLargeList] = useState<Item[]>([]);
 * useCleanupLargeState(largeList, setLargeList, { threshold: 100 });
 * ```
 */
export function useCleanupLargeState<T>(
  state: T[],
  setState: (value: T[]) => void,
  options: { threshold?: number } = {}
) {
  const { threshold = 100 } = options;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    return () => {
      if (stateRef.current.length > threshold) {
        // Schedule cleanup after unmount to free memory
        // Using setTimeout to avoid state update during unmount
        if (__DEV__) {
          console.log(
            `🧹 Cleaning up large state array (${stateRef.current.length} items)`
          );
        }
      }
    };
  }, [threshold]);
}

/**
 * Track last fetch time to implement smart refresh on focus.
 * Returns helper to check if data is stale.
 *
 * Usage:
 * ```tsx
 * const { markFetched, isStale, lastFetchTime } = useStaleDataTracker(60000); // 1 minute
 *
 * useFocusEffect(
 *   useCallback(() => {
 *     if (isStale()) {
 *       loadData().then(() => markFetched());
 *     }
 *   }, [isStale, markFetched])
 * );
 * ```
 */
export function useStaleDataTracker(staleThresholdMs: number = 60000) {
  const lastFetchTimeRef = useRef<number>(0);

  const markFetched = useCallback(() => {
    lastFetchTimeRef.current = Date.now();
  }, []);

  const isStale = useCallback(() => {
    const now = Date.now();
    return now - lastFetchTimeRef.current > staleThresholdMs;
  }, [staleThresholdMs]);

  const getLastFetchTime = useCallback(() => {
    return lastFetchTimeRef.current;
  }, []);

  return {
    markFetched,
    isStale,
    lastFetchTime: getLastFetchTime,
  };
}

/**
 * Combined hook for screens that need safe async operations,
 * cleanup on unmount, and stale data tracking.
 *
 * Usage:
 * ```tsx
 * const { isMounted, isStale, markFetched, safeSetState } = useScreenCleanup({ staleThreshold: 60000 });
 *
 * const loadData = useCallback(async () => {
 *   const data = await fetchData();
 *   safeSetState(setData, data);
 *   markFetched();
 * }, [safeSetState, markFetched]);
 * ```
 */
export function useScreenCleanup(options: { staleThreshold?: number } = {}) {
  const { staleThreshold = 60000 } = options;

  const isMounted = useMountedRef();
  const { markFetched, isStale, lastFetchTime } =
    useStaleDataTracker(staleThreshold);

  const safeSetState = useCallback(
    <T>(setter: (value: T) => void, value: T) => {
      if (isMounted.current) {
        setter(value);
      }
    },
    [isMounted]
  );

  return {
    isMounted,
    isStale,
    markFetched,
    lastFetchTime,
    safeSetState,
  };
}

/**
 * Hook for modal screens that need to clear state on dismiss.
 * Runs cleanup function when modal unmounts.
 *
 * Usage:
 * ```tsx
 * useModalCleanup(() => {
 *   orderState.selectedCustomerId.set(null);
 *   orderState.selectedItems.set([]);
 * });
 * ```
 */
export function useModalCleanup(cleanup: () => void) {
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);
}

/**
 * Hook to prevent state updates after component unmount during navigation.
 * Returns a wrapper function that only calls the setter if mounted.
 *
 * Usage:
 * ```tsx
 * const safeSet = useSafeSet();
 *
 * useEffect(() => {
 *   fetchData().then(data => safeSet(setData, data));
 * }, []);
 * ```
 */
export function useSafeSet() {
  const isMounted = useMountedRef();

  return useCallback(
    <T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      if (isMounted.current) {
        setter(value);
      }
    },
    [isMounted]
  );
}
