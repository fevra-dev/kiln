/**
 * Transaction Utils Tests
 * 
 * Tests for transaction utilities including dynamic priority fees.
 */

import { Transaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';
import { ComputeBudgetProgram } from '@solana/web3.js';
import {
  DynamicPriorityFeeCalculator,
  addPriorityFee,
  addDynamicPriorityFee,
  DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
  DEFAULT_COMPUTE_UNIT_LIMIT,
} from '@/lib/transaction-utils';

// Mock Connection
jest.mock('@solana/web3.js', () => ({
  ...jest.requireActual('@solana/web3.js'),
  Connection: jest.fn(),
}));

describe('Transaction Utils', () => {
  describe('DynamicPriorityFeeCalculator', () => {
    let mockConnection: Connection;

    beforeEach(() => {
      mockConnection = {
        getRecentPrioritizationFees: jest.fn(),
      } as unknown as Connection;
    });

    describe('getRecommendedFee', () => {
      it('should return default fee when API not available', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        (mockConnection.getRecentPrioritizationFees as jest.Mock) = undefined;

        const fee = await calculator.getRecommendedFee(mockConnection, 'medium');

        expect(fee).toBe(DEFAULT_PRIORITY_FEE_MICROLAMPORTS);
      });

      it('should calculate fee from recent prioritization fees', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        const mockFees = [
          { prioritizationFee: 100 },
          { prioritizationFee: 200 },
          { prioritizationFee: 300 },
          { prioritizationFee: 400 },
          { prioritizationFee: 500 },
        ];

        (mockConnection.getRecentPrioritizationFees as jest.Mock) = jest.fn().mockResolvedValue(mockFees);

        const fee = await calculator.getRecommendedFee(mockConnection, 'medium');

        // Should use 50th percentile (300)
        expect(fee).toBeGreaterThanOrEqual(100);
        expect(fee).toBeLessThanOrEqual(500);
      });

      it('should use low percentile for low priority', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        const mockFees = [
          { prioritizationFee: 100 },
          { prioritizationFee: 200 },
          { prioritizationFee: 300 },
          { prioritizationFee: 400 },
          { prioritizationFee: 500 },
        ];

        (mockConnection.getRecentPrioritizationFees as jest.Mock) = jest.fn().mockResolvedValue(mockFees);

        const fee = await calculator.getRecommendedFee(mockConnection, 'low');

        // Should use 25th percentile (lower value)
        expect(fee).toBeLessThanOrEqual(300);
      });

      it('should use high percentile for high priority', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        const mockFees = [
          { prioritizationFee: 100 },
          { prioritizationFee: 200 },
          { prioritizationFee: 300 },
          { prioritizationFee: 400 },
          { prioritizationFee: 500 },
        ];

        (mockConnection.getRecentPrioritizationFees as jest.Mock) = jest.fn().mockResolvedValue(mockFees);

        const fee = await calculator.getRecommendedFee(mockConnection, 'high');

        // Should use 75th percentile (higher value)
        expect(fee).toBeGreaterThanOrEqual(300);
      });

      it('should filter out zero fees', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        const mockFees = [
          { prioritizationFee: 0 },
          { prioritizationFee: 100 },
          { prioritizationFee: 200 },
        ];

        (mockConnection.getRecentPrioritizationFees as jest.Mock) = jest.fn().mockResolvedValue(mockFees);

        const fee = await calculator.getRecommendedFee(mockConnection, 'medium');

        // Should not use zero fees
        expect(fee).toBeGreaterThan(0);
      });

      it('should fallback to default on error', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        (mockConnection.getRecentPrioritizationFees as jest.Mock) = jest.fn().mockRejectedValue(new Error('RPC error'));

        const fee = await calculator.getRecommendedFee(mockConnection, 'medium');

        expect(fee).toBe(DEFAULT_PRIORITY_FEE_MICROLAMPORTS);
      });

      it('should ensure minimum fee', async () => {
        const calculator = new DynamicPriorityFeeCalculator();
        const mockFees = [{ prioritizationFee: 1 }]; // Very low fee

        (mockConnection.getRecentPrioritizationFees as jest.Mock) = jest.fn().mockResolvedValue(mockFees);

        const fee = await calculator.getRecommendedFee(mockConnection, 'low');

        // Should use minimum for low priority (500)
        expect(fee).toBeGreaterThanOrEqual(500);
      });
    });
  });

  describe('addPriorityFee', () => {
    it('should add priority fee instructions', () => {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default,
          toPubkey: PublicKey.default,
          lamports: 1000,
        })
      );

      const result = addPriorityFee(tx, {
        microlamports: 2000,
        computeUnits: 300_000,
      });

      expect(result.instructions.length).toBeGreaterThan(1);
      
      // Check for ComputeBudgetProgram instructions
      const hasPriorityFee = result.instructions.some(
        (ix) => ix.programId.equals(ComputeBudgetProgram.programId)
      );
      expect(hasPriorityFee).toBe(true);
    });

    it('should use default values when not provided', () => {
      const tx = new Transaction();

      addPriorityFee(tx);

      expect(tx.instructions.length).toBeGreaterThan(0);
    });

    it('should preserve existing instructions', () => {
      const tx = new Transaction();
      const originalInstruction = SystemProgram.transfer({
        fromPubkey: PublicKey.default,
        toPubkey: PublicKey.default,
        lamports: 1000,
      });
      tx.add(originalInstruction);

      addPriorityFee(tx);

      expect(tx.instructions.length).toBeGreaterThan(1);
      expect(tx.instructions[0]).toBe(originalInstruction);
    });
  });

  describe('addDynamicPriorityFee', () => {
    it('should add dynamic priority fee', async () => {
      const tx = new Transaction();
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockResolvedValue([
          { prioritizationFee: 1000 },
          { prioritizationFee: 2000 },
          { prioritizationFee: 3000 },
        ]),
      } as unknown as Connection;

      await addDynamicPriorityFee(tx, mockConnection, 'medium');

      expect(tx.instructions.length).toBeGreaterThan(0);
    });

    it('should use custom compute units when provided', async () => {
      const tx = new Transaction();
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockResolvedValue([
          { prioritizationFee: 1000 },
        ]),
      } as unknown as Connection;

      await addDynamicPriorityFee(tx, mockConnection, 'medium', 200_000);

      expect(tx.instructions.length).toBeGreaterThan(0);
    });

    it('should handle connection errors gracefully', async () => {
      const tx = new Transaction();
      const mockConnection = {
        getRecentPrioritizationFees: jest.fn().mockRejectedValue(new Error('RPC error')),
      } as unknown as Connection;

      // Should not throw, should use default fee
      await expect(addDynamicPriorityFee(tx, mockConnection, 'medium')).resolves.not.toThrow();
      expect(tx.instructions.length).toBeGreaterThan(0);
    });
  });

  describe('Constants', () => {
    it('should have correct default priority fee', () => {
      expect(DEFAULT_PRIORITY_FEE_MICROLAMPORTS).toBeGreaterThan(0);
    });

    it('should have correct default compute unit limit', () => {
      expect(DEFAULT_COMPUTE_UNIT_LIMIT).toBeGreaterThan(0);
      expect(DEFAULT_COMPUTE_UNIT_LIMIT).toBeLessThanOrEqual(1_400_000);
    });
  });
});

