/**
 * Integration Tests: Inscription Verification with Resilience
 * 
 * Tests inscription verification with resilience features:
 * - Caching
 * - Failover
 * - Immutability tracking
 */

import {
  fetchInscriptionWithFailover,
  getCachedSha256,
} from '@/lib/inscription-resilience';
import {
  storeInscriptionSnapshot,
  verifyInscriptionImmutability,
} from '@/lib/inscription-immutability';
import { InscriptionVerifier } from '@/lib/inscription-verifier';

// Mock global fetch
global.fetch = jest.fn();

describe('Inscription Verification Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Verification with Caching', () => {
    it('should use cache on second verification', async () => {
      const inscriptionId = 'abc123i0';
      const mockContent = new ArrayBuffer(100);

      // First fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      // First verification
      const hashResult1 = await InscriptionVerifier.fetchAndHash(inscriptionId);
      expect(hashResult1.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second verification should use cache
      const hashResult2 = await InscriptionVerifier.fetchAndHash(inscriptionId);
      expect(hashResult2.success).toBe(true);
      // Should still only call fetch once (cache hit)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Verification with Immutability Tracking', () => {
    it('should store snapshot after seal verification', async () => {
      const inscriptionId = 'abc123i0';
      const sha256 = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      const mockContent = new ArrayBuffer(100);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      // Store snapshot (simulates seal operation)
      storeInscriptionSnapshot(inscriptionId, sha256, 'seal-operation');

      // Later, verify immutability
      const result = await verifyInscriptionImmutability(inscriptionId, sha256);

      expect(result).toBeDefined();
      expect(result.originalHash).toBe(sha256);
    });
  });

  describe('Verification with Failover', () => {
    it('should failover to backup on primary failure', async () => {
      const inscriptionId = 'abc123i0';
      const mockContent = new ArrayBuffer(100);

      // Primary fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Backup succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
        arrayBuffer: () => Promise.resolve(mockContent),
      });

      const result = await fetchInscriptionWithFailover(inscriptionId);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Primary + backup
    });
  });
});

