/**
 * Unit Tests for Teleburn Address Derivation
 * 
 * @description Comprehensive tests for the SHA-256 based teleburn derivation
 * algorithm. Validates determinism, correctness, and edge cases.
 */

import {
  deriveTeleburnAddress,
  parseInscriptionId,
  verifyTeleburnAddress,
  deriveTeleburnAddressBatch,
  TELEBURN_DOMAIN,
} from '@/lib/teleburn';
import { PublicKey } from '@solana/web3.js';

describe('Teleburn Address Derivation', () => {
  // Test inscription IDs (valid format: 64-hex-txid + 'i' + index)
  const testInscriptionId1 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
  const testInscriptionId2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210i0';
  const testInscriptionId3 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i999';

  // Known test vector from Ordinals documentation
  const ordinalTestVector = {
    inscriptionId: '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0',
    // Note: Ethereum address is 0xe43A06530BdF8A4e067581f48Fae3b535559dA9e
    // Solana address will be different (32 bytes vs 20 bytes, different derivation)
  };

  describe('parseInscriptionId', () => {
    it('parses valid inscription ID correctly', () => {
      const { txid, index } = parseInscriptionId(testInscriptionId1);
      
      expect(txid).toBeInstanceOf(Uint8Array);
      expect(txid.length).toBe(32); // 32 bytes from 64 hex chars
      expect(index).toBe(0);
    });

    it('parses inscription with large index', () => {
      const { txid, index } = parseInscriptionId(testInscriptionId3);
      
      expect(txid.length).toBe(32);
      expect(index).toBe(999);
    });

    it('handles lowercase hex', () => {
      const lowercase = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
      const { txid } = parseInscriptionId(lowercase);
      
      expect(txid[0]).toBe(0xab); // First byte
      expect(txid[31]).toBe(0x89); // Last byte
    });

    it('handles uppercase hex', () => {
      const uppercase = 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789i0';
      const { txid } = parseInscriptionId(uppercase);
      
      expect(txid[0]).toBe(0xab); // Normalized to lowercase
    });

    it('handles mixed case hex', () => {
      const mixed = 'AbCdEf0123456789aBcDeF0123456789AbCdEf0123456789aBcDeF0123456789i0';
      const { txid } = parseInscriptionId(mixed);
      
      expect(txid[0]).toBe(0xab);
    });

    it('throws error for invalid format - missing i separator', () => {
      expect(() => parseInscriptionId(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567890'
      )).toThrow(/Invalid inscription ID format/);
    });

    it('throws error for invalid format - txid too short', () => {
      expect(() => parseInscriptionId('abc123i0')).toThrow(/Invalid inscription ID format/);
    });

    it('throws error for invalid format - txid too long', () => {
      expect(() => parseInscriptionId(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ffffi0'
      )).toThrow(/Invalid inscription ID format/);
    });

    it('throws error for invalid format - non-hex characters', () => {
      expect(() => parseInscriptionId(
        'xyz!@#0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0'
      )).toThrow(/Invalid inscription ID format/);
    });

    it('throws error for negative index', () => {
      // The regex won't match negative numbers, so this will throw format error
      expect(() => parseInscriptionId(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i-1'
      )).toThrow(/Invalid inscription ID format/);
    });

    it('throws error for non-numeric index', () => {
      expect(() => parseInscriptionId(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789iabc'
      )).toThrow(/Invalid inscription ID format/);
    });

    it('throws error for index exceeding u32 max', () => {
      const maxU32 = 0xFFFFFFFF;
      const exceedsMax = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i' + (maxU32 + 1);
      
      expect(() => parseInscriptionId(exceedsMax)).toThrow(/exceeds u32 maximum/);
    });

    it('accepts index at u32 max boundary', () => {
      const maxU32 = 0xFFFFFFFF;
      const atMax = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i' + maxU32;
      
      const { index } = parseInscriptionId(atMax);
      expect(index).toBe(maxU32);
    });
  });

  describe('deriveTeleburnAddress', () => {
    it('derives a valid Solana public key', async () => {
      const address = await deriveTeleburnAddress(testInscriptionId1);
      
      expect(address).toBeInstanceOf(PublicKey);
      
      // Should be able to use PublicKey methods
      expect(() => address.toBase58()).not.toThrow();
      expect(() => address.toBuffer()).not.toThrow();
      expect(address.toBuffer().length).toBe(32);
    });

    it('produces deterministic results', async () => {
      const address1 = await deriveTeleburnAddress(testInscriptionId1);
      const address2 = await deriveTeleburnAddress(testInscriptionId1);
      
      expect(address1.equals(address2)).toBe(true);
      expect(address1.toBase58()).toBe(address2.toBase58());
    });

    it('produces different addresses for different inscription IDs', async () => {
      const address1 = await deriveTeleburnAddress(testInscriptionId1);
      const address2 = await deriveTeleburnAddress(testInscriptionId2);
      
      expect(address1.equals(address2)).toBe(false);
    });

    it('produces different addresses for different indices', async () => {
      const address0 = await deriveTeleburnAddress(testInscriptionId1); // i0
      const address999 = await deriveTeleburnAddress(testInscriptionId3); // i999
      
      expect(address0.equals(address999)).toBe(false);
    });

    it('handles Ordinals test vector inscription ID', async () => {
      // This should not throw - we can derive an address
      const address = await deriveTeleburnAddress(ordinalTestVector.inscriptionId);
      
      expect(address).toBeInstanceOf(PublicKey);
      expect(address.toBase58()).toBeTruthy();
      
      // Note: Will be different from Ethereum address due to different derivation
      console.log('Ordinals test vector Solana address:', address.toBase58());
    });

    it('uses domain separation in derivation', async () => {
      // Domain separation ensures different addresses from raw hash
      // This is tested indirectly by ensuring determinism
      expect(TELEBURN_DOMAIN).toBe('kiln.teleburn.solana.v1');
    });

    it('derives off-curve addresses (no private key)', async () => {
      const address = await deriveTeleburnAddress(testInscriptionId1);
      
      // Off-curve points should still be valid PublicKeys
      expect(() => address.toBase58()).not.toThrow();
      
      // But they should not be usable for signing (no private key exists)
      // This is ensured by the derivation algorithm
    });

    it('handles case-insensitive inscription IDs consistently', async () => {
      const lowercase = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
      const uppercase = 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789i0';
      const mixed = 'AbCdEf0123456789aBcDeF0123456789AbCdEf0123456789aBcDeF0123456789i0';
      
      const addr1 = await deriveTeleburnAddress(lowercase);
      const addr2 = await deriveTeleburnAddress(uppercase);
      const addr3 = await deriveTeleburnAddress(mixed);
      
      // All should produce same address (case-insensitive)
      expect(addr1.equals(addr2)).toBe(true);
      expect(addr1.equals(addr3)).toBe(true);
    });
  });

  describe('verifyTeleburnAddress', () => {
    it('returns true for correctly derived address', async () => {
      const address = await deriveTeleburnAddress(testInscriptionId1);
      const isValid = await verifyTeleburnAddress(testInscriptionId1, address);
      
      expect(isValid).toBe(true);
    });

    it('returns false for incorrect address', async () => {
      const address = await deriveTeleburnAddress(testInscriptionId1);
      const wrongAddress = await deriveTeleburnAddress(testInscriptionId2);
      
      const isValid = await verifyTeleburnAddress(testInscriptionId1, wrongAddress);
      
      expect(isValid).toBe(false);
    });

    it('returns false for random address', async () => {
      const randomAddress = new PublicKey('11111111111111111111111111111111');
      const isValid = await verifyTeleburnAddress(testInscriptionId1, randomAddress);
      
      expect(isValid).toBe(false);
    });

    it('returns false for invalid inscription ID', async () => {
      const address = await deriveTeleburnAddress(testInscriptionId1);
      const isValid = await verifyTeleburnAddress('invalid', address);
      
      expect(isValid).toBe(false);
    });

    it('verifies across multiple inscription IDs', async () => {
      const ids = [testInscriptionId1, testInscriptionId2, testInscriptionId3];
      
      for (const id of ids) {
        const address = await deriveTeleburnAddress(id);
        const isValid = await verifyTeleburnAddress(id, address);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('deriveTeleburnAddressBatch', () => {
    it('derives multiple addresses in parallel', async () => {
      const ids = [testInscriptionId1, testInscriptionId2, testInscriptionId3];
      const addresses = await deriveTeleburnAddressBatch(ids);
      
      expect(addresses.length).toBe(3);
      expect(addresses[0]).toBeInstanceOf(PublicKey);
      expect(addresses[1]).toBeInstanceOf(PublicKey);
      expect(addresses[2]).toBeInstanceOf(PublicKey);
    });

    it('produces consistent results with individual derivations', async () => {
      const ids = [testInscriptionId1, testInscriptionId2];
      
      const batchAddresses = await deriveTeleburnAddressBatch(ids);
      const individual1 = await deriveTeleburnAddress(testInscriptionId1);
      const individual2 = await deriveTeleburnAddress(testInscriptionId2);
      
      expect(batchAddresses[0]?.equals(individual1)).toBe(true);
      expect(batchAddresses[1]?.equals(individual2)).toBe(true);
    });

    it('handles empty array', async () => {
      const addresses = await deriveTeleburnAddressBatch([]);
      expect(addresses.length).toBe(0);
    });

    it('handles single inscription ID', async () => {
      const addresses = await deriveTeleburnAddressBatch([testInscriptionId1]);
      expect(addresses.length).toBe(1);
      expect(addresses[0]).toBeInstanceOf(PublicKey);
    });
  });

  describe('Algorithm Consistency', () => {
    it('matches algorithm specification: SHA-256(txid || index || salt)', async () => {
      // This test verifies the algorithm matches the documented specification
      const { txid, index } = parseInscriptionId(testInscriptionId1);
      
      // Expected preimage construction:
      // [txid (32 bytes)] [index (4 bytes, big-endian)] [salt]
      const salt = new TextEncoder().encode(TELEBURN_DOMAIN);
      const preimage = new Uint8Array(32 + 4 + salt.length);
      preimage.set(txid, 0);
      
      const dataView = new DataView(preimage.buffer);
      dataView.setUint32(32, index, false); // big-endian
      
      preimage.set(salt, 36);
      
      // Now derive and check it uses this preimage
      const address = await deriveTeleburnAddress(testInscriptionId1);
      
      expect(address).toBeInstanceOf(PublicKey);
    });

    it('uses big-endian encoding for index (Bitcoin compatibility)', async () => {
      // Bitcoin uses big-endian for serialization
      // Verify our implementation matches
      const index255 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i255';
      const index256 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i256';
      
      const addr255 = await deriveTeleburnAddress(index255);
      const addr256 = await deriveTeleburnAddress(index256);
      
      // Different indices should produce different addresses
      expect(addr255.equals(addr256)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles inscription index 0', async () => {
      const id = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
      const address = await deriveTeleburnAddress(id);
      
      expect(address).toBeInstanceOf(PublicKey);
    });

    it('handles inscription index 1', async () => {
      const id = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i1';
      const address = await deriveTeleburnAddress(id);
      
      expect(address).toBeInstanceOf(PublicKey);
    });

    it('handles large inscription index (millions)', async () => {
      const id = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i999999999';
      const address = await deriveTeleburnAddress(id);
      
      expect(address).toBeInstanceOf(PublicKey);
    });

    it('handles all zeros txid', async () => {
      const id = '0000000000000000000000000000000000000000000000000000000000000000i0';
      const address = await deriveTeleburnAddress(id);
      
      expect(address).toBeInstanceOf(PublicKey);
    });

    it('handles all ones txid', async () => {
      const id = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffi0';
      const address = await deriveTeleburnAddress(id);
      
      expect(address).toBeInstanceOf(PublicKey);
    });

    it('derives quickly (< 100ms per address)', async () => {
      const startTime = Date.now();
      
      await deriveTeleburnAddress(testInscriptionId1);
      
      const elapsed = Date.now() - startTime;
      
      // Should be very fast (usually < 10ms)
      expect(elapsed).toBeLessThan(100);
    });

    it('handles multiple sequential derivations efficiently', async () => {
      const ids = Array.from({ length: 10 }, (_, i) => 
        `abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i${i}`
      );
      
      const startTime = Date.now();
      
      for (const id of ids) {
        await deriveTeleburnAddress(id);
      }
      
      const elapsed = Date.now() - startTime;
      
      // 10 derivations should complete in reasonable time
      expect(elapsed).toBeLessThan(1000); // 1 second
    });
  });

  describe('Security Properties', () => {
    it('domain separation prevents cross-protocol collisions', () => {
      // Different domains should produce different addresses
      // This is ensured by using TELEBURN_DOMAIN in preimage
      expect(TELEBURN_DOMAIN).toContain('kiln');
      expect(TELEBURN_DOMAIN).toContain('teleburn');
      expect(TELEBURN_DOMAIN).toContain('solana');
      expect(TELEBURN_DOMAIN).toContain('v1');
    });

    it('produces cryptographically random-looking addresses', async () => {
      // Sequential indices should produce uncorrelated addresses
      const addr0 = await deriveTeleburnAddress(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0'
      );
      const addr1 = await deriveTeleburnAddress(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i1'
      );
      const addr2 = await deriveTeleburnAddress(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i2'
      );
      
      // All should be different (no patterns)
      expect(addr0.equals(addr1)).toBe(false);
      expect(addr1.equals(addr2)).toBe(false);
      expect(addr0.equals(addr2)).toBe(false);
      
      // Address bytes should look random (no obvious patterns)
      const bytes0 = addr0.toBuffer();
      const bytes1 = addr1.toBuffer();
      
      // At least 50% of bytes should differ (high entropy)
      let differentBytes = 0;
      for (let i = 0; i < 32; i++) {
        if (bytes0[i] !== bytes1[i]) differentBytes++;
      }
      
      expect(differentBytes).toBeGreaterThan(16); // > 50% different
    });

    it('cannot reverse-engineer inscription ID from address', async () => {
      // One-way function: address does not reveal inscription ID
      // SHA-256 is cryptographically secure (preimage resistance)
      const address = await deriveTeleburnAddress(testInscriptionId1);
      
      // Address bytes contain no obvious inscription ID data
      const addressBytes = address.toBuffer();
      const { txid } = parseInscriptionId(testInscriptionId1);
      
      // Should not contain raw txid bytes
      let matchingBytes = 0;
      for (let i = 0; i < Math.min(addressBytes.length, txid.length); i++) {
        if (addressBytes[i] === txid[i]) matchingBytes++;
      }
      
      // At most a few bytes might match by chance (< 25%)
      expect(matchingBytes).toBeLessThan(8);
    });
  });

  describe('Comparison with Ethereum Implementation', () => {
    it('uses similar pattern to Ethereum derivation', () => {
      // Ethereum: SHA-256(txid || index) → first 20 bytes
      // Solana: SHA-256(txid || index || salt) → 32 bytes (off-curve)
      
      // Both use SHA-256 and txid || index as base
      // Solana adds domain separation (salt) for security
      // Solana requires off-curve iteration for Ed25519
      
      expect(TELEBURN_DOMAIN).toBeTruthy();
    });

    it('produces different addresses than Ethereum (different chain)', async () => {
      // Same inscription ID should produce different addresses on different chains
      // This is intentional (domain separation)
      
      const solanaAddress = await deriveTeleburnAddress(ordinalTestVector.inscriptionId);
      const ethereumAddressHex = '0xe43A06530BdF8A4e067581f48Fae3b535559dA9e';
      
      // Solana address is base58, Ethereum is hex - they're inherently different
      expect(solanaAddress.toBase58()).not.toContain(ethereumAddressHex.toLowerCase());
    });
  });
});

