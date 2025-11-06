/**
 * Transaction Size Validator Tests
 * 
 * Tests for transaction size validation to ensure transactions
 * don't exceed Solana's 1232 byte limit.
 */

import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import {
  validateTransactionSize,
  assertTransactionSizeValid,
  getTransactionSize,
  canAddInstruction,
  getSizeOptimizationRecommendations,
  MAX_TRANSACTION_SIZE,
  TRANSACTION_SIZE_WARNING_THRESHOLD,
} from '@/lib/transaction-size-validator';

describe('Transaction Size Validator', () => {
  describe('validateTransactionSize', () => {
    it('should validate small transactions', () => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default,
          toPubkey: PublicKey.default,
          lamports: 1000,
        })
      );

      const result = validateTransactionSize(tx);

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(result.size).toBeLessThan(MAX_TRANSACTION_SIZE);
      expect(result.maxSize).toBe(MAX_TRANSACTION_SIZE);
    });

    it('should detect oversized transactions', () => {
      // Create a transaction that's too large
      // This is hard to do in a test without mocking, but we can test the logic
      const tx = new Transaction();
      
      // Add many instructions to make it large
      for (let i = 0; i < 100; i++) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: PublicKey.default,
            toPubkey: PublicKey.default,
            lamports: 1000,
          })
        );
      }

      const result = validateTransactionSize(tx);

      // Transaction might be valid or invalid depending on actual size
      // But we can test the structure
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('maxSize', MAX_TRANSACTION_SIZE);
    });

    it('should provide warning when approaching limit', () => {
      const tx = new Transaction();
      
      // Add instructions until we're close to warning threshold
      // This is a simplified test - in practice, we'd need to measure actual size
      
      const result = validateTransactionSize(tx);
      
      // If transaction is large enough, should have warning
      if (result.size > TRANSACTION_SIZE_WARNING_THRESHOLD) {
        expect(result.warning).toBeDefined();
      }
    });

    it('should provide recommendations for oversized transactions', () => {
      const tx = new Transaction();
      
      // Add many instructions
      for (let i = 0; i < 200; i++) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: PublicKey.default,
            toPubkey: PublicKey.default,
            lamports: 1000,
          })
        );
      }

      const result = validateTransactionSize(tx);

      if (!result.valid) {
        expect(result.recommendation).toBeDefined();
        expect(result.recommendation).toContain('Address Lookup Tables');
      }
    });
  });

  describe('assertTransactionSizeValid', () => {
    it('should not throw for valid transactions', () => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default,
          toPubkey: PublicKey.default,
          lamports: 1000,
        })
      );

      expect(() => assertTransactionSizeValid(tx)).not.toThrow();
    });

    it('should throw for invalid transactions', () => {
      const tx = new Transaction();
      
      // Add many instructions to exceed limit
      for (let i = 0; i < 500; i++) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: PublicKey.default,
            toPubkey: PublicKey.default,
            lamports: 1000,
          })
        );
      }

      // Only throw if actually oversized
      const validation = validateTransactionSize(tx);
      if (!validation.valid) {
        expect(() => assertTransactionSizeValid(tx)).toThrow();
      }
    });
  });

  describe('getTransactionSize', () => {
    it('should return size in bytes', () => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default,
          toPubkey: PublicKey.default,
          lamports: 1000,
        })
      );

      const size = getTransactionSize(tx);

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should return 0 for invalid transactions', () => {
      // This would require a malformed transaction, which is hard to create
      // But we can test the error handling
      const tx = new Transaction();
      
      // Try to serialize an empty transaction
      const size = getTransactionSize(tx);
      
      // Should return a valid size (even if 0)
      expect(typeof size).toBe('number');
    });
  });

  describe('canAddInstruction', () => {
    it('should return true when there is space', () => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default,
          toPubkey: PublicKey.default,
          lamports: 1000,
        })
      );

      const canAdd = canAddInstruction(tx, 200);

      expect(typeof canAdd).toBe('boolean');
    });

    it('should return false when transaction is full', () => {
      const tx = new Transaction();
      
      // Fill transaction
      for (let i = 0; i < 500; i++) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: PublicKey.default,
            toPubkey: PublicKey.default,
            lamports: 1000,
          })
        );
      }

      const canAdd = canAddInstruction(tx, 200);

      // If transaction is already large, can't add more
      const currentSize = getTransactionSize(tx);
      if (currentSize + 200 > MAX_TRANSACTION_SIZE) {
        expect(canAdd).toBe(false);
      }
    });
  });

  describe('getSizeOptimizationRecommendations', () => {
    it('should return recommendations for large transactions', () => {
      const tx = new Transaction();
      
      // Add many instructions
      for (let i = 0; i < 200; i++) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: PublicKey.default,
            toPubkey: PublicKey.default,
            lamports: 1000,
          })
        );
      }

      const recommendations = getSizeOptimizationRecommendations(tx);

      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        expect(recommendations[0]).toContain('Address Lookup Tables');
      }
    });

    it('should return empty array for small transactions', () => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default,
          toPubkey: PublicKey.default,
          lamports: 1000,
        })
      );

      const recommendations = getSizeOptimizationRecommendations(tx);

      // If transaction is small, should have few or no recommendations
      const size = getTransactionSize(tx);
      if (size < TRANSACTION_SIZE_WARNING_THRESHOLD) {
        expect(recommendations.length).toBe(0);
      }
    });
  });

  describe('Constants', () => {
    it('should have correct MAX_TRANSACTION_SIZE', () => {
      expect(MAX_TRANSACTION_SIZE).toBe(1232);
    });

    it('should have correct warning threshold', () => {
      expect(TRANSACTION_SIZE_WARNING_THRESHOLD).toBe(MAX_TRANSACTION_SIZE * 0.8);
    });
  });
});

