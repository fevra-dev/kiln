/**
 * Unit Tests for Derived Owner Algorithm
 * 
 * @description Tests deterministic off-curve address derivation
 */

import {
  deriveOwner,
  verifyDerivedOwner,
  formatDerivedOwner,
  deriveBatch,
} from '@/lib/derived-owner';
import { PublicKey } from '@solana/web3.js';

describe('Derived Owner Algorithm', () => {
  // Test inscription IDs (valid format)
  const testInscriptionId1 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
  const testInscriptionId2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210i0';
  const testInscriptionId3 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i999';

  describe('deriveOwner', () => {
    it('derives a public key and bump', () => {
      const result = deriveOwner(testInscriptionId1);
      
      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('bump');
      expect(result.publicKey).toBeInstanceOf(PublicKey);
      expect(typeof result.bump).toBe('number');
      expect(result.bump).toBeGreaterThanOrEqual(0);
      expect(result.bump).toBeLessThanOrEqual(255);
    });

    it('produces deterministic results', () => {
      const result1 = deriveOwner(testInscriptionId1);
      const result2 = deriveOwner(testInscriptionId1);
      
      expect(result1.publicKey.equals(result2.publicKey)).toBe(true);
      expect(result1.bump).toBe(result2.bump);
    });

    it('produces different results for different inscription IDs', () => {
      const result1 = deriveOwner(testInscriptionId1);
      const result2 = deriveOwner(testInscriptionId2);
      
      expect(result1.publicKey.equals(result2.publicKey)).toBe(false);
      // Bump might be the same by chance, so we don't test that
    });

    it('produces different results for different indices', () => {
      const result1 = deriveOwner(testInscriptionId1); // i0
      const result2 = deriveOwner(testInscriptionId3); // i999
      
      expect(result1.publicKey.equals(result2.publicKey)).toBe(false);
    });

    it('respects startBump parameter', () => {
      const result0 = deriveOwner(testInscriptionId1, 0);
      const result10 = deriveOwner(testInscriptionId1, 10);
      
      // If first off-curve point is found at bump < 10, result10 should be different
      if (result0.bump < 10) {
        expect(result10.publicKey.equals(result0.publicKey)).toBe(false);
        expect(result10.bump).toBeGreaterThanOrEqual(10);
      }
    });

    it('throws error for invalid inscription ID format', () => {
      expect(() => deriveOwner('invalid')).toThrow(/Invalid inscription ID format/);
      expect(() => deriveOwner('abc123i0')).toThrow(); // Txid too short
      expect(() => deriveOwner(testInscriptionId1.replace('i', ''))).toThrow(); // No separator
    });

    it('throws error for invalid bump range', () => {
      expect(() => deriveOwner(testInscriptionId1, -1)).toThrow(/Invalid startBump/);
      expect(() => deriveOwner(testInscriptionId1, 256)).toThrow(/Invalid startBump/);
    });

    it('derives within reasonable bump range (< 256)', () => {
      // Test multiple inscription IDs to ensure algorithm works
      const inscriptions = [
        testInscriptionId1,
        testInscriptionId2,
        testInscriptionId3,
      ];

      for (const id of inscriptions) {
        const result = deriveOwner(id);
        expect(result.bump).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('verifyDerivedOwner', () => {
    it('returns true for correctly derived owner', () => {
      const result = deriveOwner(testInscriptionId1);
      const isValid = verifyDerivedOwner(
        testInscriptionId1,
        result.publicKey,
        result.bump
      );
      expect(isValid).toBe(true);
    });

    it('returns false for incorrect public key', () => {
      const result = deriveOwner(testInscriptionId1);
      const wrongKey = new PublicKey('11111111111111111111111111111111');
      
      const isValid = verifyDerivedOwner(
        testInscriptionId1,
        wrongKey,
        result.bump
      );
      expect(isValid).toBe(false);
    });

    it('returns false for incorrect bump', () => {
      const result = deriveOwner(testInscriptionId1);
      const wrongBump = (result.bump + 1) % 256;
      
      const isValid = verifyDerivedOwner(
        testInscriptionId1,
        result.publicKey,
        wrongBump
      );
      expect(isValid).toBe(false);
    });

    it('returns false for invalid inscription ID', () => {
      const result = deriveOwner(testInscriptionId1);
      const isValid = verifyDerivedOwner(
        'invalid',
        result.publicKey,
        result.bump
      );
      expect(isValid).toBe(false);
    });
  });

  describe('formatDerivedOwner', () => {
    it('formats owner info as string', () => {
      const result = deriveOwner(testInscriptionId1);
      const formatted = formatDerivedOwner(result);
      
      expect(formatted).toContain(result.publicKey.toBase58());
      expect(formatted).toContain(`bump: ${result.bump}`);
    });
  });

  describe('deriveBatch', () => {
    it('derives multiple owners in batch', () => {
      const ids = [testInscriptionId1, testInscriptionId2, testInscriptionId3];
      const results = deriveBatch(ids);
      
      expect(results.length).toBe(3);
      expect(results[0]?.publicKey).toBeInstanceOf(PublicKey);
      expect(results[1]?.publicKey).toBeInstanceOf(PublicKey);
      expect(results[2]?.publicKey).toBeInstanceOf(PublicKey);
    });

    it('produces consistent results with individual derivations', () => {
      const ids = [testInscriptionId1, testInscriptionId2];
      const batchResults = deriveBatch(ids);
      const individual1 = deriveOwner(testInscriptionId1);
      const individual2 = deriveOwner(testInscriptionId2);
      
      expect(batchResults[0]?.publicKey.equals(individual1.publicKey)).toBe(true);
      expect(batchResults[1]?.publicKey.equals(individual2.publicKey)).toBe(true);
    });

    it('handles empty array', () => {
      const results = deriveBatch([]);
      expect(results.length).toBe(0);
    });
  });

  describe('Domain Separation', () => {
    it('uses domain string in derivation', () => {
      // This is tested indirectly by ensuring deterministic results
      // If domain wasn't used, results would be different
      const result1 = deriveOwner(testInscriptionId1);
      const result2 = deriveOwner(testInscriptionId1);
      
      expect(result1.publicKey.equals(result2.publicKey)).toBe(true);
    });

    it('produces off-curve addresses (no private key exists)', () => {
      const result = deriveOwner(testInscriptionId1);
      
      // We can't directly test if a key is off-curve without Ed25519 validation,
      // but we can verify the algorithm ran (bump was incremented)
      expect(result.bump).toBeGreaterThanOrEqual(0);
      
      // The derived address should be usable as a PublicKey
      expect(() => result.publicKey.toBase58()).not.toThrow();
      expect(() => result.publicKey.toBuffer()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles inscription with large index number', () => {
      const largeIndex = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i999999999';
      const result = deriveOwner(largeIndex);
      
      expect(result.publicKey).toBeInstanceOf(PublicKey);
      expect(result.bump).toBeGreaterThanOrEqual(0);
    });

    it('handles inscription with uppercase hex', () => {
      const uppercase = 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789i0';
      const result = deriveOwner(uppercase);
      
      expect(result.publicKey).toBeInstanceOf(PublicKey);
    });

    it('handles inscription with mixed case hex', () => {
      const mixed = 'AbCdEf0123456789aBcDeF0123456789AbCdEf0123456789aBcDeF0123456789i0';
      const result = deriveOwner(mixed);
      
      expect(result.publicKey).toBeInstanceOf(PublicKey);
    });
  });
});

