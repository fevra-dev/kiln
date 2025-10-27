/**
 * Unit Tests for Zod Schemas
 * 
 * @description Tests validation logic for all input schemas
 */

import {
  InscriptionIdSchema,
  PublicKeySchema,
  Sha256Schema,
  TimestampSchema,
  BlockHeightSchema,
  BumpSchema,
  SealTransactionRequestSchema,
  RetireTransactionRequestSchema,
  isValidInscriptionId,
  isValidPublicKey,
  isValidSha256,
  isTimestampValid,
  formatValidationErrors,
} from '@/lib/schemas';
import { z } from 'zod';

describe('Base Validators', () => {
  describe('InscriptionIdSchema', () => {
    it('validates correct inscription ID format', () => {
      const valid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0';
      expect(() => InscriptionIdSchema.parse(valid)).not.toThrow();
    });

    it('accepts inscription IDs with any index number', () => {
      const id1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0';
      const id2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai999';
      expect(() => InscriptionIdSchema.parse(id1)).not.toThrow();
      expect(() => InscriptionIdSchema.parse(id2)).not.toThrow();
    });

    it('rejects inscription ID with wrong txid length', () => {
      const invalid = 'abc123i0'; // Too short
      expect(() => InscriptionIdSchema.parse(invalid)).toThrow();
    });

    it('rejects inscription ID without separator', () => {
      const invalid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      expect(() => InscriptionIdSchema.parse(invalid)).toThrow();
    });

    it('rejects inscription ID with non-hex characters', () => {
      const invalid = 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'+ 'i0';
      expect(() => InscriptionIdSchema.parse(invalid)).toThrow();
    });
  });

  describe('PublicKeySchema', () => {
    it('validates correct Solana public key', () => {
      const valid = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
      expect(() => PublicKeySchema.parse(valid)).not.toThrow();
    });

    it('rejects public key with invalid characters', () => {
      const invalid = '0000000000000000000000000000000000000000000'; // Has 0, O, I, l
      expect(() => PublicKeySchema.parse(invalid)).toThrow();
    });

    it('rejects public key that is too short', () => {
      const invalid = 'Gh9ZwEmdLJ8DscKNTk';
      expect(() => PublicKeySchema.parse(invalid)).toThrow();
    });
  });

  describe('Sha256Schema', () => {
    it('validates correct SHA-256 hash', () => {
      const valid = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      expect(() => Sha256Schema.parse(valid)).not.toThrow();
    });

    it('rejects hash that is too short', () => {
      const invalid = 'a1b2c3d4e5f6';
      expect(() => Sha256Schema.parse(invalid)).toThrow();
    });

    it('rejects hash with non-hex characters', () => {
      const invalid = 'g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f6g7h8i9j0k1l2';
      expect(() => Sha256Schema.parse(invalid)).toThrow();
    });
  });

  describe('TimestampSchema', () => {
    it('validates reasonable timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(() => TimestampSchema.parse(now)).not.toThrow();
    });

    it('rejects timestamp before 2020', () => {
      const tooOld = 1000000000; // Year 2001
      expect(() => TimestampSchema.parse(tooOld)).toThrow();
    });

    it('rejects timestamp after 2100', () => {
      const tooNew = 5000000000; // Year 2128
      expect(() => TimestampSchema.parse(tooNew)).toThrow();
    });
  });

  describe('BlockHeightSchema', () => {
    it('validates positive block height', () => {
      expect(() => BlockHeightSchema.parse(268123456)).not.toThrow();
    });

    it('rejects negative block height', () => {
      expect(() => BlockHeightSchema.parse(-1)).toThrow();
    });

    it('rejects zero block height', () => {
      expect(() => BlockHeightSchema.parse(0)).toThrow();
    });
  });

  describe('BumpSchema', () => {
    it('validates bump in range 0-255', () => {
      expect(() => BumpSchema.parse(0)).not.toThrow();
      expect(() => BumpSchema.parse(128)).not.toThrow();
      expect(() => BumpSchema.parse(255)).not.toThrow();
    });

    it('rejects bump less than 0', () => {
      expect(() => BumpSchema.parse(-1)).toThrow();
    });

    it('rejects bump greater than 255', () => {
      expect(() => BumpSchema.parse(256)).toThrow();
    });
  });
});

describe('Request Schemas', () => {
  describe('SealTransactionRequestSchema', () => {
    const validRequest = {
      feePayer: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
      mint: '7xKXy9H8P3VTeQ6cVszLuGzFWBYWxJ6VL5K3dqC9PMH9',
      inscriptionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0',
      sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
    };

    it('validates complete valid request', () => {
      expect(() => SealTransactionRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('validates with optional network parameter', () => {
      const withNetwork = { ...validRequest, network: 'mainnet' as const };
      expect(() => SealTransactionRequestSchema.parse(withNetwork)).not.toThrow();
    });

    it('validates with optional signers array', () => {
      const withSigners = {
        ...validRequest,
        signers: ['Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr']
      };
      expect(() => SealTransactionRequestSchema.parse(withSigners)).not.toThrow();
    });

    it('rejects request with invalid feePayer', () => {
      const invalid = { ...validRequest, feePayer: 'invalid' };
      expect(() => SealTransactionRequestSchema.parse(invalid)).toThrow();
    });

    it('rejects request with invalid inscriptionId', () => {
      const invalid = { ...validRequest, inscriptionId: 'invalid' };
      expect(() => SealTransactionRequestSchema.parse(invalid)).toThrow();
    });
  });

  describe('RetireTransactionRequestSchema', () => {
    const validRequest = {
      feePayer: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
      mint: '7xKXy9H8P3VTeQ6cVszLuGzFWBYWxJ6VL5K3dqC9PMH9',
      inscriptionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0',
      sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
      method: 'burn' as const,
    };

    it('validates burn method without bump', () => {
      expect(() => RetireTransactionRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('validates incinerate method without bump', () => {
      const incinerate = { ...validRequest, method: 'incinerate' as const };
      expect(() => RetireTransactionRequestSchema.parse(incinerate)).not.toThrow();
    });

    it('validates teleburn-derived method with bump', () => {
      const derived = {
        ...validRequest,
        method: 'teleburn-derived' as const,
        bump: 42
      };
      expect(() => RetireTransactionRequestSchema.parse(derived)).not.toThrow();
    });

    it('rejects teleburn-derived method without bump', () => {
      const invalid = { ...validRequest, method: 'teleburn-derived' as const };
      expect(() => RetireTransactionRequestSchema.parse(invalid)).toThrow(/bump is required/);
    });
  });
});

describe('Helper Functions', () => {
  describe('isValidInscriptionId', () => {
    it('returns true for valid inscription ID', () => {
      const valid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0';
      expect(isValidInscriptionId(valid)).toBe(true);
    });

    it('returns false for invalid inscription ID', () => {
      expect(isValidInscriptionId('invalid')).toBe(false);
      expect(isValidInscriptionId('abc123i0')).toBe(false);
    });
  });

  describe('isValidPublicKey', () => {
    it('returns true for valid public key', () => {
      expect(isValidPublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')).toBe(true);
    });

    it('returns false for invalid public key', () => {
      expect(isValidPublicKey('invalid')).toBe(false);
      expect(isValidPublicKey('0000000000')).toBe(false);
    });
  });

  describe('isValidSha256', () => {
    it('returns true for valid SHA-256', () => {
      const valid = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      expect(isValidSha256(valid)).toBe(true);
    });

    it('returns false for invalid SHA-256', () => {
      expect(isValidSha256('invalid')).toBe(false);
      expect(isValidSha256('a1b2c3')).toBe(false);
    });
  });

  describe('isTimestampValid', () => {
    it('returns true for current timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(isTimestampValid(now)).toBe(true);
    });

    it('returns true for timestamp within 5 minutes', () => {
      const now = Math.floor(Date.now() / 1000);
      const recent = now - 299; // 4 minutes 59 seconds ago
      expect(isTimestampValid(recent)).toBe(true);
    });

    it('returns false for timestamp more than 5 minutes old', () => {
      const now = Math.floor(Date.now() / 1000);
      const old = now - 301; // 5 minutes 1 second ago
      expect(isTimestampValid(old)).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('formats zod errors into readable messages', () => {
      try {
        InscriptionIdSchema.parse('invalid');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = formatValidationErrors(error);
          expect(messages.length).toBeGreaterThan(0);
          expect(messages[0]).toContain('Invalid inscription ID');
        }
      }
    });
  });
});

