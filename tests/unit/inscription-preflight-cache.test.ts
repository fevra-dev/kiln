/**
 * Tests for src/lib/inscription-preflight/cache.ts
 */

import { PreflightCache } from '@/lib/inscription-preflight/cache';

describe('PreflightCache', () => {
  let cache: PreflightCache;

  beforeEach(() => {
    cache = new PreflightCache({ maxEntries: 3 });
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves a value within TTL', () => {
    cache.set('a', { v: 1 }, 1000);
    expect(cache.get('a')).toEqual({ v: 1 });
  });

  it('expires entries past TTL', () => {
    jest.useFakeTimers();
    cache.set('a', { v: 1 }, 100);
    jest.advanceTimersByTime(101);
    expect(cache.get('a')).toBeUndefined();
    jest.useRealTimers();
  });

  it('treats TTL of Infinity as never-expiring', () => {
    jest.useFakeTimers();
    cache.set('a', { v: 1 }, Infinity);
    jest.advanceTimersByTime(1_000_000_000);
    expect(cache.get('a')).toEqual({ v: 1 });
    jest.useRealTimers();
  });

  it('evicts oldest when exceeding maxEntries', () => {
    cache.set('a', 1, Infinity);
    cache.set('b', 2, Infinity);
    cache.set('c', 3, Infinity);
    cache.set('d', 4, Infinity); // forces eviction of 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('updates LRU order on get (touching keeps the entry alive)', () => {
    cache.set('a', 1, Infinity);
    cache.set('b', 2, Infinity);
    cache.set('c', 3, Infinity);
    cache.get('a'); // touches 'a'
    cache.set('d', 4, Infinity); // should evict 'b' (now the oldest)
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('__resetCache wipes all entries', () => {
    cache.set('a', 1, Infinity);
    cache.__resetCache();
    expect(cache.get('a')).toBeUndefined();
  });
});
