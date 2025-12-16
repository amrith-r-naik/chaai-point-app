import { perfMonitor } from "@/utils/performanceMonitor";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";

/**
 * Hook to track screen performance metrics
 * Monitors mount, unmount, focus, blur events and time-to-interactive
 */
export function useScreenPerformance(screenName: string) {
  const mountTimeRef = useRef<number>(0);
  const isFirstRenderRef = useRef(true);
  const focusStartRef = useRef<number>(0);
  const navigation = useNavigation();

  // Track mount/unmount
  useEffect(() => {
    if (!__DEV__) return;

    mountTimeRef.current = performance.now();
    perfMonitor.logScreenMount(screenName);
    perfMonitor.captureMemorySnapshot(screenName);

    // Measure time to interactive (after first render)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      const startTime = mountTimeRef.current;

      requestAnimationFrame(() => {
        const duration = performance.now() - startTime;
        console.log(
          `⚡ Time to interactive [${screenName}]: ${duration.toFixed(2)}ms`
        );

        if (duration > 500) {
          console.warn(
            `⚠️  SLOW SCREEN LOAD [${screenName}]: ${duration.toFixed(2)}ms (target: <500ms)`
          );
        }
      });
    }

    return () => {
      perfMonitor.logScreenUnmount(screenName);
      perfMonitor.captureMemorySnapshot(screenName);
    };
  }, [screenName]);

  // Track navigation focus timing (helps diagnose back navigation issues)
  useEffect(() => {
    if (!__DEV__) return;

    const unsubscribe = navigation.addListener("focus", () => {
      focusStartRef.current = performance.now();

      // Measure time until screen is ready (next animation frame)
      requestAnimationFrame(() => {
        const focusDuration = performance.now() - focusStartRef.current;
        if (focusDuration > 100) {
          console.log(
            `🔄 Focus ready [${screenName}]: ${focusDuration.toFixed(2)}ms`
          );
        }
        if (focusDuration > 300) {
          console.warn(
            `⚠️  SLOW FOCUS [${screenName}]: ${focusDuration.toFixed(2)}ms (target: <300ms)`
          );
        }
      });
    });

    return unsubscribe;
  }, [navigation, screenName]);

  // Track focus/blur
  useFocusEffect(
    useCallback(() => {
      if (!__DEV__) return;

      perfMonitor.logScreenFocus(screenName);

      return () => {
        perfMonitor.logScreenBlur(screenName);
      };
    }, [screenName])
  );
}

/**
 * Hook to measure a specific operation's performance
 */
export function useMeasureRender(componentName: string) {
  const renderCount = useRef(0);
  const renderTime = useRef(performance.now());

  if (__DEV__) {
    renderCount.current++;
    const now = performance.now();
    const timeSinceLastRender = now - renderTime.current;
    renderTime.current = now;

    console.log(
      `🔄 Render [${componentName}] #${renderCount.current} (${timeSinceLastRender.toFixed(2)}ms since last)`
    );
  }
}
