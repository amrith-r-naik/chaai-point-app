// utils/cache.ts
/**
 * Simple in-memory cache with TTL (Time To Live) for reducing redundant data fetches.
 * This is especially useful for dashboard stats and frequently accessed data.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Default cache TTL values (in milliseconds)
export const CACHE_TTL = {
  /** Short TTL for frequently changing data (10 seconds) */
  SHORT: 10_000,
  /** Medium TTL for dashboard stats (30 seconds) */
  MEDIUM: 30_000,
  /** Long TTL for relatively static data like menu items (2 minutes) */
  LONG: 120_000,
  /** Very long TTL for rarely changing data (5 minutes) */
  STATIC: 300_000,
} as const;

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = CACHE_TTL.MEDIUM) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get data from cache or fetch it if not available/expired.
   * @param key - Unique cache key
   * @param fetcher - Async function to fetch data if cache miss
   * @param ttl - Optional custom TTL for this specific entry
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if still valid
    if (cached && now - cached.timestamp < ttl) {
      return cached.data as T;
    }

    // Fetch fresh data
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  /**
   * Get data from cache without fetching (returns undefined if miss/expired).
   */
  get<T>(key: string, ttl: number = this.defaultTTL): T | undefined {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < ttl) {
      return cached.data as T;
    }

    return undefined;
  }

  /**
   * Manually set data in cache.
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix.
   * Useful for invalidating all related cache entries.
   * @example cache.invalidatePrefix('dashboard:') - clears all dashboard cache
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all entries matching any of the given prefixes.
   */
  invalidatePrefixes(prefixes: string[]): void {
    for (const prefix of prefixes) {
      this.invalidatePrefix(prefix);
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries (call periodically to prevent memory bloat).
   */
  cleanup(ttl: number = this.defaultTTL): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton instance for app-wide caching
export const appCache = new MemoryCache(CACHE_TTL.MEDIUM);

// Cache key generators for consistent key naming
export const cacheKeys = {
  dashboard: (startDate: string, endDate: string) =>
    `dashboard:${startDate}:${endDate}`,
  dashboardExpenses: (startDate: string, endDate: string) =>
    `dashboard:expenses:${startDate}:${endDate}`,
  customers: () => `customers:all`,
  customersSummary: () => `customers:summary`,
  customerDetails: (id: string) => `customer:${id}`,
  orders: (date: string) => `orders:${date}`,
  ordersGrouped: () => `orders:grouped`,
  menuItems: () => `menu:items`,
  dues: () => `dues:all`,
  duesTotal: () => `dues:total`,
};

// Helper to invalidate related caches after mutations
export const invalidateRelatedCaches = {
  /** Call after order creation/update */
  afterOrderChange: () => {
    appCache.invalidatePrefixes(["orders:", "dashboard:", "customers:"]);
  },
  /** Call after payment processing */
  afterPayment: () => {
    appCache.invalidatePrefixes(["dashboard:", "customers:", "dues:"]);
  },
  /** Call after customer creation/update */
  afterCustomerChange: () => {
    appCache.invalidatePrefix("customers:");
  },
  /** Call after expense creation/update */
  afterExpenseChange: () => {
    appCache.invalidatePrefix("dashboard:");
  },
  /** Call after menu item change */
  afterMenuChange: () => {
    appCache.invalidatePrefix("menu:");
  },
  /** Clear all caches (e.g., after sync) */
  afterSync: () => {
    appCache.clear();
  },
};

// Periodic cleanup (run every 5 minutes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export const startCacheCleanup = () => {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(
    () => {
      const cleaned = appCache.cleanup(CACHE_TTL.STATIC);
      if (cleaned > 0) {
        console.log(`[cache] Cleaned up ${cleaned} expired entries`);
      }
    },
    5 * 60 * 1000
  ); // Every 5 minutes
};

export const stopCacheCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};
