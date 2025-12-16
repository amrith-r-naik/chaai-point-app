/**
 * Performance monitoring utilities for debugging speed issues
 * Enable/disable via __DEV__ flag
 */

interface QueryLog {
  query: string;
  duration: number;
  timestamp: number;
  params?: any[];
}

interface NavigationLog {
  screen: string;
  action: "mount" | "unmount" | "focus" | "blur";
  duration?: number;
  timestamp: number;
}

interface MemorySnapshot {
  jsHeapSize?: number;
  timestamp: number;
  screen?: string;
}

class PerformanceMonitor {
  private queryLogs: QueryLog[] = [];
  private navigationLogs: NavigationLog[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private screenMountTimes: Map<string, number> = new Map();
  private enabled: boolean = __DEV__;

  // Query Performance Tracking
  async measureQuery<T>(
    queryFn: () => Promise<T>,
    queryDescription: string,
    params?: any[]
  ): Promise<T> {
    if (!this.enabled) return queryFn();

    const start = performance.now();
    try {
      const result = await queryFn();
      const duration = performance.now() - start;

      this.queryLogs.push({
        query: queryDescription,
        duration,
        timestamp: Date.now(),
        params,
      });

      // Log slow queries (>100ms)
      if (duration > 100) {
        console.warn(
          `🐌 SLOW QUERY (${duration.toFixed(2)}ms): ${queryDescription}`,
          params
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(
        `❌ QUERY ERROR (${duration.toFixed(2)}ms): ${queryDescription}`,
        error
      );
      throw error;
    }
  }

  // Navigation Performance Tracking
  logScreenMount(screenName: string) {
    if (!this.enabled) return;

    const now = Date.now();
    this.screenMountTimes.set(screenName, now);
    this.navigationLogs.push({
      screen: screenName,
      action: "mount",
      timestamp: now,
    });
    console.log(`📱 Screen mounted: ${screenName}`);
  }

  logScreenUnmount(screenName: string) {
    if (!this.enabled) return;

    const mountTime = this.screenMountTimes.get(screenName);
    const now = Date.now();
    const duration = mountTime ? now - mountTime : undefined;

    this.navigationLogs.push({
      screen: screenName,
      action: "unmount",
      timestamp: now,
      duration,
    });

    if (duration) {
      console.log(`📱 Screen unmounted: ${screenName} (lived ${duration}ms)`);
    }
    this.screenMountTimes.delete(screenName);
  }

  logScreenFocus(screenName: string) {
    if (!this.enabled) return;

    const now = Date.now();
    this.navigationLogs.push({
      screen: screenName,
      action: "focus",
      timestamp: now,
    });
    console.log(`👁️  Screen focused: ${screenName}`);
  }

  logScreenBlur(screenName: string) {
    if (!this.enabled) return;

    const now = Date.now();
    this.navigationLogs.push({
      screen: screenName,
      action: "blur",
      timestamp: now,
    });
    console.log(`👁️  Screen blurred: ${screenName}`);
  }

  measureTimeToInteractive(screenName: string, callback: () => void) {
    if (!this.enabled) {
      callback();
      return;
    }

    const start = performance.now();
    requestAnimationFrame(() => {
      callback();
      const duration = performance.now() - start;
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

  // Memory Tracking
  captureMemorySnapshot(screen?: string) {
    if (!this.enabled) return;

    const memory = (performance as any).memory;
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      screen,
      jsHeapSize: memory?.usedJSHeapSize,
    };

    this.memorySnapshots.push(snapshot);

    if (memory) {
      const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      console.log(
        `💾 Memory: ${usedMB}MB / ${limitMB}MB${screen ? ` [${screen}]` : ""}`
      );
    }
  }

  // Reporting
  getSlowQueries(thresholdMs: number = 100): QueryLog[] {
    return this.queryLogs.filter((log) => log.duration > thresholdMs);
  }

  getQueryStats() {
    if (this.queryLogs.length === 0) {
      return { count: 0, avgDuration: 0, maxDuration: 0, totalDuration: 0 };
    }

    const durations = this.queryLogs.map((log) => log.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / durations.length;
    const maxDuration = Math.max(...durations);

    return {
      count: this.queryLogs.length,
      avgDuration: parseFloat(avgDuration.toFixed(2)),
      maxDuration: parseFloat(maxDuration.toFixed(2)),
      totalDuration: parseFloat(totalDuration.toFixed(2)),
    };
  }

  printReport() {
    if (!this.enabled) return;

    console.log("\n==========================================");
    console.log("📊 PERFORMANCE REPORT");
    console.log("==========================================\n");

    // Query Stats
    const stats = this.getQueryStats();
    console.log("🔍 DATABASE QUERIES:");
    console.log(`  Total: ${stats.count}`);
    console.log(`  Avg Duration: ${stats.avgDuration}ms`);
    console.log(`  Max Duration: ${stats.maxDuration}ms`);
    console.log(`  Total Time: ${stats.totalDuration}ms\n`);

    // Slow Queries
    const slowQueries = this.getSlowQueries();
    if (slowQueries.length > 0) {
      console.log("🐌 SLOW QUERIES (>100ms):");
      slowQueries.forEach((log) => {
        console.log(`  ${log.duration.toFixed(2)}ms - ${log.query}`);
      });
      console.log("");
    }

    // Navigation Events
    console.log("🧭 NAVIGATION EVENTS:");
    const recentNav = this.navigationLogs.slice(-10);
    recentNav.forEach((log) => {
      const durationStr = log.duration ? ` (${log.duration}ms)` : "";
      console.log(`  ${log.action.toUpperCase()}: ${log.screen}${durationStr}`);
    });
    console.log("");

    // Memory Snapshots
    if (this.memorySnapshots.length > 0) {
      console.log("💾 MEMORY USAGE:");
      const recent = this.memorySnapshots.slice(-5);
      recent.forEach((snap) => {
        if (snap.jsHeapSize) {
          const mb = (snap.jsHeapSize / 1024 / 1024).toFixed(2);
          const screenStr = snap.screen ? ` [${snap.screen}]` : "";
          console.log(`  ${mb}MB${screenStr}`);
        }
      });
      console.log("");
    }

    console.log("==========================================\n");
  }

  clearLogs() {
    this.queryLogs = [];
    this.navigationLogs = [];
    this.memorySnapshots = [];
    console.log("🧹 Performance logs cleared");
  }

  enable() {
    this.enabled = true;
    console.log("✅ Performance monitoring enabled");
  }

  disable() {
    this.enabled = false;
    console.log("❌ Performance monitoring disabled");
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Helper to wrap async DB operations
export function withQueryPerf<T>(
  queryFn: () => Promise<T>,
  description: string,
  params?: any[]
): Promise<T> {
  return perfMonitor.measureQuery(queryFn, description, params);
}
