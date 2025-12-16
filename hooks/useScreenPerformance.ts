import { perfMonitor } from "@/utils/performanceMonitor";
import { useFocusEffect } from "@react-navigation/native";
import { useEffect, useRef } from "react";

/**
 * Hook to track screen performance metrics
 * Monitors mount, unmount, focus, blur events and time-to-interactive
 */
export function useScreenPerformance(screenName: string) {
  const mountTimeRef = useRef<number>(0);
  const isFirstRenderRef = useRef(true);

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

  // Track focus/blur
  useFocusEffect(
    useRef(() => {
      if (!__DEV__) return;

      perfMonitor.logScreenFocus(screenName);

      return () => {
        perfMonitor.logScreenBlur(screenName);
      };
    }).current
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
