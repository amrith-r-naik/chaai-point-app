# Performance Monitoring - Phase 1.1

## Overview

Added comprehensive performance monitoring system to track and debug speed issues, especially those that appear after data grows.

## What's Been Added

### 1. Performance Monitor (`utils/performanceMonitor.ts`)

Core monitoring utility that tracks:

- **Database Query Performance**: Logs all queries with duration, highlights slow queries (>100ms)
- **Navigation Events**: Tracks screen mount/unmount, focus/blur events
- **Memory Usage**: Captures heap size at key moments
- **Time-to-Interactive**: Measures how long screens take to become interactive

### 2. Screen Performance Hook (`hooks/useScreenPerformance.ts`)

React hook that automatically tracks screen lifecycle:

```typescript
export default function MyScreen() {
  useScreenPerformance("MyScreen");
  // ... rest of component
}
```

### 3. Query Performance Wrapper

Wraps database queries to measure performance:

```typescript
import { withQueryPerf } from "@/utils/performanceMonitor";

const result = await withQueryPerf(
  () => db.getAllAsync("SELECT * FROM table"),
  "Query description",
  [params]
);
```

## Integrated Screens

Performance tracking is now active on:

- ✅ Dashboard (`index.tsx`)
- ✅ Orders (`orders.tsx`)
- ✅ Customers (`customers.tsx`)
- ✅ Billing (`billing.tsx`)

## How to Use

### During Development

1. **Automatic Logging**
   - All tracked screens will log mount/unmount/focus/blur events
   - Slow queries (>100ms) are automatically logged with ⚠️ warning
   - Time-to-interactive is measured for each screen

2. **View Performance Report**
   - Open Admin Settings (dev mode only)
   - Scroll to "Performance Monitoring" section
   - Click "Print Performance Report"
   - Check console for detailed metrics:
     - Total queries and average duration
     - Slow queries list
     - Recent navigation events
     - Memory snapshots

3. **Clear Logs**
   - Use "Clear Performance Logs" button in Admin Settings
   - Or in console: `perfMonitor.clearLogs()`

### Console Output Examples

```
📱 Screen mounted: Dashboard
⚡ Time to interactive [Dashboard]: 245.50ms
🐌 SLOW QUERY (152.30ms): getOrdersByDate [2025-11-08]
💾 Memory: 45.23MB / 2048.00MB [Dashboard]
```

### Performance Report

```
==========================================
📊 PERFORMANCE REPORT
==========================================

🔍 DATABASE QUERIES:
  Total: 24
  Avg Duration: 45.67ms
  Max Duration: 152.30ms
  Total Time: 1096.08ms

🐌 SLOW QUERIES (>100ms):
  152.30ms - getOrdersByDate [2025-11-08]

🧭 NAVIGATION EVENTS:
  MOUNT: Dashboard
  FOCUS: Dashboard
  BLUR: Dashboard
  MOUNT: Orders

💾 MEMORY USAGE:
  45.23MB [Dashboard]
  46.78MB [Orders]
==========================================
```

## Finding Performance Bottlenecks

### 1. Slow Queries

- Look for queries >100ms in console warnings
- Check "SLOW QUERIES" section in report
- Queries with DATE() functions or missing indexes will be slowest

### 2. Slow Screen Loads

- Time-to-interactive >500ms indicates problems
- Check if data is being loaded unnecessarily
- Look for N+1 query patterns

### 3. Memory Leaks

- Monitor memory growth over time
- Compare memory before/after screen navigation
- Increasing memory on same screen = potential leak

### 4. Navigation Issues

- Check NAVIGATION EVENTS section
- Multiple rapid mount/unmount = navigation thrashing
- Long time between blur/focus = slow transitions

## API Reference

### perfMonitor

```typescript
// Measure a query
perfMonitor.measureQuery(queryFn, description, params)

// Log navigation
perfMonitor.logScreenMount(screenName)
perfMonitor.logScreenUnmount(screenName)
perfMonitor.logScreenFocus(screenName)
perfMonitor.logScreenBlur(screenName)

// Memory tracking
perfMonitor.captureMemorySnapshot(screenName?)

// Reports
perfMonitor.getSlowQueries(thresholdMs)
perfMonitor.getQueryStats()
perfMonitor.printReport()
perfMonitor.clearLogs()

// Control
perfMonitor.enable()
perfMonitor.disable()
```

### useScreenPerformance Hook

```typescript
function MyScreen() {
  useScreenPerformance("MyScreenName");
  // Automatically tracks:
  // - Mount/unmount
  // - Focus/blur
  // - Time to interactive
  // - Memory snapshots
}
```

### withQueryPerf Wrapper

```typescript
import { withQueryPerf } from "@/utils/performanceMonitor";

// Wrap any async DB operation
const data = await withQueryPerf(
  () => db.getAllAsync(sql, params),
  "Human readable description",
  params // optional
);
```

## Next Steps (Phase 1.2 - Data Growth Testing)

1. Create test data generator to seed 1000+ records
2. Profile queries at different data volumes
3. Identify which queries scale poorly
4. Add targeted indexes based on slow query patterns

## Debugging Tips

### To see what's slowing down navigation back:

1. Navigate through app normally
2. When you feel lag on back button, check console
3. Look for timing between BLUR and FOCUS events
4. Check if queries are running on focus
5. Look for "SLOW QUERY" warnings

### To identify data-growth issues:

1. Print report with small dataset (note query times)
2. Add more test data
3. Print report again
4. Compare average duration and slow queries
5. Queries that scale poorly need indexes or optimization

### To find memory leaks:

1. Note memory usage on screen mount
2. Navigate away and back multiple times
3. Check if memory grows each time
4. Growing memory = potential leak (check useEffect cleanup)

## Configuration

All monitoring is automatically **disabled in production** and **enabled in development** (`__DEV__` flag).

To manually control:

```typescript
perfMonitor.enable(); // Force enable
perfMonitor.disable(); // Force disable
```

---

**Status**: ✅ Phase 1.1 Complete
**Next Phase**: 1.2 - Data Growth Impact Analysis
