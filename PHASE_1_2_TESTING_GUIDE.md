# Phase 1.2 - Performance Baseline Testing Guide

## Overview

This guide walks you through generating test data at different scales and measuring query performance degradation. This is critical for understanding how your application's performance changes as data volume increases.

**Objective**: Measure query times at 100, 500, and 1000+ customer scales to establish baseline performance curves before applying Phase 2 optimizations (database indexes).

## Quick Start

### 1. Open Admin Settings

- Launch the app
- Navigate to **Admin Settings** (from any screen's menu)
- Scroll to the bottom to find **Performance Monitoring** and **Test Data Generation** sections

### 2. Generate Test Data

You'll see four buttons under "Test Data Generation (Phase 1.2)":

- **Gen Small (100)** - 100 customers, ~500 orders, ~1600 items, ~400 bills
- **Gen Medium (500)** - 500 customers, ~2500 orders, ~7500 items, ~2000 bills
- **Gen Large (1000)** - 1000 customers, ~5000 orders, ~15000 items, ~4000 bills
- **Clear All Test Data** - Wipes all test data

### 3. Measure Performance for Each Scale

For each scale (small → medium → large):

1. **Clear logs** (important!)
   - Go to Admin Settings > **Clear Performance Logs**

2. **Generate test data**
   - Tap the corresponding "Gen" button
   - Accept the confirmation dialog
   - Wait for generation to complete (watch console logs)

3. **Navigate the app**
   - Go to **Dashboard** and view metrics (this triggers queries)
   - Navigate to **Orders**, **Customers**, **Billing** tabs
   - Scroll and interact naturally for 30-60 seconds
   - This ensures queries are executed and timed

4. **Print performance report**
   - Return to Admin Settings
   - Tap **Print Performance Report**
   - Check the browser console for output

5. **Document results**
   - Copy the performance report to a spreadsheet or notes
   - Record:
     - Scale (small/medium/large)
     - Slow queries detected (names and duration)
     - Average query time
     - Max query time
     - Memory usage

6. **Clear and repeat**
   - Tap **Clear All Test Data**
   - Repeat steps 1-5 for next scale

## What to Look For

The performance report will show:

```
📊 Performance Report
Total queries: 16
Average: 100.88ms
Max: 273.69ms
Total time: 1614.01ms

🐌 SLOW QUERIES (>100ms):
- getOrdersByDate: 235-273ms
- getOrderItems batch: 205-243ms
```

### Key Metrics

- **Average query time** - Should stay relatively flat or grow slowly
- **Max query time** - Watch for exponential growth (bad sign, needs indexing)
- **Slow queries** - Which queries degrade most with data volume?
- **Memory usage** - Track if memory bloats significantly

## Example Baseline Results

**Expected behavior** (with no indexes):

- Small (100 customers): Avg 100ms, Max 250ms
- Medium (500 customers): Avg 150-200ms, Max 400-500ms
- Large (1000 customers): Avg 300-400ms, Max 800-1000ms+

If you see exponential growth (e.g., Max time goes from 250ms → 500ms → 2000ms), this indicates missing indexes on frequently queried fields.

## After Collecting Baseline Data

Once you have baseline metrics for all three scales:

1. **Document the performance curves**
   - Plot query times vs. data volume
   - Identify which queries degrade most

2. **Proceed to Phase 2: Database Indexing**
   - Add indexes on identified problem queries
   - Re-run the same baseline test
   - Measure % improvement

3. **Track improvements**
   - Compare before/after metrics
   - Validate that optimization had expected impact

## Troubleshooting

### Generation is slow

- This is normal! Generation involves inserting thousands of records with related data
- Small should take 10-30 seconds
- Medium can take 60-120 seconds
- Large can take 180-300+ seconds

### No slow queries detected

- This might be because you haven't navigated enough
- Spend 1-2 minutes using the Dashboard and switching tabs
- Try scrolling through all lists

### Performance report shows all 0s

- Make sure you generated data first
- Navigation triggers queries; make sure you did that
- Try clearing and re-running

### App crashes during generation

- Large scale (1000) on older devices might cause memory pressure
- Try Medium first, then Large only if Medium completes successfully
- Restart app before re-attempting

## Advanced: Manual Query Testing

If you want to test specific queries:

1. In **Admin Settings**, add this to the dev section:

   ```tsx
   const testQuery = async () => {
     const start = performance.now();
     const result = await orderService.getOrdersByDate(
       new Date("2024-01-01"),
       new Date("2024-02-01")
     );
     const duration = performance.now() - start;
     console.log(
       `Query took ${duration.toFixed(2)}ms, returned ${result.length} orders`
     );
   };
   ```

2. Call this function with different date ranges/filters
3. Record times for each variation

## Next Steps After Baseline

- **Phase 2**: Add database indexes on slow queries
- **Phase 3**: Implement pagination/lazy loading
- **Phase 4**: Add caching layer for dashboard stats
- **Phase 5+**: Further optimizations per performance curves

---

**Questions?** Check the performance monitor implementation in `utils/performanceMonitor.ts` or refer to the main optimization plan document.
