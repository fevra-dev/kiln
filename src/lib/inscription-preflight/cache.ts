/**
 * In-memory LRU cache with per-entry TTL.
 * Per-instance only (Vercel serverless); no cross-instance sharing.
 *
 * Use Infinity as TTL for permanent entries (e.g. confirmed-≥6 results).
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number; // epoch-ms or Infinity
}

export interface PreflightCacheOptions {
  maxEntries: number;
}

export class PreflightCache {
  private map: Map<string, CacheEntry<unknown>>;
  private readonly maxEntries: number;

  constructor(options: PreflightCacheOptions = { maxEntries: 10_000 }) {
    this.map = new Map();
    this.maxEntries = options.maxEntries;
  }

  get<V>(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== Infinity && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // LRU touch: re-insert to move to end of Map iteration order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value as V;
  }

  set<V>(key: string, value: V, ttlMs: number): void {
    const expiresAt = ttlMs === Infinity ? Infinity : Date.now() + ttlMs;
    this.map.delete(key); // ensure new position is end-of-order
    this.map.set(key, { value, expiresAt });
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  __resetCache(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

/** Singleton cache instance for use by the preflight module. */
export const preflightCache = new PreflightCache({ maxEntries: 10_000 });
