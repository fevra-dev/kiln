/**
 * Inscription Resilience Tests
 * 
 * Tests for inscription fetching with failover and caching.
 */

import {
  fetchInscriptionWithFailover,
  getCachedSha256,
  clearInscriptionCache,
  clearAllInscriptionCache,
  getCacheStats,
  healthCheckSources,
} from '@/lib/inscription-resilience';

// Mock global fetch
global.fetch = jest.fn();

describe('Inscription Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllInscriptionCache();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchInscriptionWithFailover', () => {
    it('should fetch inscription successfully', async () => {
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': '100',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      const result = await fetchInscriptionWithFailover('abc123i0');

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.contentType).toBe('image/png');
      expect(result.source).toBeDefined();
    });

    it('should use cache on second fetch', async () => {
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': '100',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      // First fetch
      await fetchInscriptionWithFailover('abc123i0');

      // Second fetch should use cache
      const result = await fetchInscriptionWithFailover('abc123i0');

      expect(result.success).toBe(true);
      expect(result.source).toContain('cache');
      // Should only call fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should failover on primary failure', async () => {
      // Primary fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Backup succeeds
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      const result = await fetchInscriptionWithFailover('abc123i0');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Primary + backup
    });

    it('should handle timeout errors', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const result = await fetchInscriptionWithFailover('abc123i0');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle content too large', async () => {
      const largeSize = 101 * 1024 * 1024; // 101 MB
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': largeSize.toString(),
        }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(largeSize)),
      });

      const result = await fetchInscriptionWithFailover('abc123i0');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should return error when all sources fail', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('All sources failed'));

      const result = await fetchInscriptionWithFailover('abc123i0');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('All inscription data sources failed');
    });
  });

  describe('getCachedSha256', () => {
    it('should return cached hash', async () => {
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      // Fetch to populate cache
      await fetchInscriptionWithFailover('abc123i0');

      const cachedHash = getCachedSha256('abc123i0');
      expect(cachedHash).toBeDefined();
      expect(typeof cachedHash).toBe('string');
      expect(cachedHash.length).toBe(64); // SHA-256 hex length
    });

    it('should return null for uncached inscription', () => {
      const hash = getCachedSha256('nonexistent');
      expect(hash).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific inscription', async () => {
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      await fetchInscriptionWithFailover('abc123i0');
      expect(getCachedSha256('abc123i0')).toBeDefined();

      clearInscriptionCache('abc123i0');
      expect(getCachedSha256('abc123i0')).toBeNull();
    });

    it('should clear all cache', async () => {
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      await fetchInscriptionWithFailover('abc123i0');
      await fetchInscriptionWithFailover('def456i1');

      clearAllInscriptionCache();

      expect(getCachedSha256('abc123i0')).toBeNull();
      expect(getCachedSha256('def456i1')).toBeNull();
    });

    it('should provide cache statistics', async () => {
      const mockContent = new ArrayBuffer(100);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      await fetchInscriptionWithFailover('abc123i0');

      const stats = getCacheStats();
      expect(stats.entries).toBeGreaterThan(0);
      expect(stats.sources).toBeDefined();
    });
  });

  describe('healthCheckSources', () => {
    it('should check source health', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const results = await healthCheckSources();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('healthy');
      });
    });

    it('should detect unhealthy sources', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const results = await healthCheckSources();

      expect(results.some((r) => !r.healthy)).toBe(true);
    });
  });
});

