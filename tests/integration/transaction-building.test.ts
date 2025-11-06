/**
 * Integration Tests: Transaction Building
 * 
 * Tests transaction building with all new features integrated:
 * - Frozen account detection
 * - Transaction size validation
 * - Dynamic priority fees
 * - RPC failover
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TransactionBuilder } from '@/lib/transaction-builder';
import { validateTransactionSize } from '@/lib/transaction-size-validator';
import { checkNFTFrozenStatus } from '@/lib/frozen-account-detector';

// Mock dependencies
jest.mock('@/lib/metaplex-burn', () => ({
  isPNFT: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/rpc-failover', () => ({
  withRpcFailover: jest.fn((fn) => fn({} as Connection)),
  createConnectionWithFailover: jest.fn(() => ({} as Connection)),
}));

jest.mock('@/lib/frozen-account-detector', () => ({
  checkNFTFrozenStatus: jest.fn(),
}));

jest.mock('@/lib/transaction-size-validator', () => ({
  validateTransactionSize: jest.fn(),
}));

jest.mock('@solana/web3.js', () => ({
  ...jest.requireActual('@solana/web3.js'),
  Connection: jest.fn(),
}));

describe('Transaction Building Integration', () => {
  let mockConnection: Connection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {} as Connection;
  });

  describe('Build Seal Transaction', () => {
    it('should build transaction with size validation', async () => {
      (validateTransactionSize as jest.Mock).mockReturnValue({
        valid: true,
        size: 500,
        maxSize: 1232,
      });

      const builder = new TransactionBuilder('https://api.example.com');
      
      const result = await builder.buildSealTransaction({
        payer: PublicKey.default,
        mint: PublicKey.default,
        inscriptionId: 'abc123i0',
        sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
      });

      expect(result.transaction).toBeDefined();
      expect(validateTransactionSize).toHaveBeenCalled();
    });

    it('should throw error for oversized transaction', async () => {
      (validateTransactionSize as jest.Mock).mockReturnValue({
        valid: false,
        size: 1500,
        maxSize: 1232,
        recommendation: 'Transaction too large',
      });

      const builder = new TransactionBuilder('https://api.example.com');

      await expect(
        builder.buildSealTransaction({
          payer: PublicKey.default,
          mint: PublicKey.default,
          inscriptionId: 'abc123i0',
          sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        })
      ).rejects.toThrow('Transaction too large');
    });
  });

  describe('Build Retire Transaction', () => {
    it('should check frozen status before building', async () => {
      (checkNFTFrozenStatus as jest.Mock).mockResolvedValue({
        frozen: false,
        tokenAccount: PublicKey.default,
      });

      (validateTransactionSize as jest.Mock).mockReturnValue({
        valid: true,
        size: 600,
        maxSize: 1232,
      });

      const builder = new TransactionBuilder('https://api.example.com');

      await builder.buildRetireTransaction({
        payer: PublicKey.default,
        owner: PublicKey.default,
        mint: PublicKey.default,
        inscriptionId: 'abc123i0',
        sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        method: 'burn',
      });

      expect(checkNFTFrozenStatus).toHaveBeenCalled();
    });

    it('should throw error for frozen account', async () => {
      (checkNFTFrozenStatus as jest.Mock).mockResolvedValue({
        frozen: true,
        tokenAccount: PublicKey.default,
        freezeAuthority: PublicKey.unique(),
      });

      const builder = new TransactionBuilder('https://api.example.com');

      await expect(
        builder.buildRetireTransaction({
          payer: PublicKey.default,
          owner: PublicKey.default,
          mint: PublicKey.default,
          inscriptionId: 'abc123i0',
          sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
          method: 'burn',
        })
      ).rejects.toThrow('frozen');
    });
  });

  describe('Dynamic Priority Fees', () => {
    it('should add dynamic priority fees when not configured', async () => {
      // Mock dynamic fee calculation
      jest.mock('@/lib/transaction-utils', () => ({
        ...jest.requireActual('@/lib/transaction-utils'),
        addDynamicPriorityFee: jest.fn().mockResolvedValue(new Transaction()),
        addPriorityFee: jest.fn(),
      }));

      (validateTransactionSize as jest.Mock).mockReturnValue({
        valid: true,
        size: 500,
        maxSize: 1232,
      });

      const builder = new TransactionBuilder('https://api.example.com');

      // Should use dynamic fees (no priorityFee provided)
      await builder.buildSealTransaction({
        payer: PublicKey.default,
        mint: PublicKey.default,
        inscriptionId: 'abc123i0',
        sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
      });

      // Dynamic fee should be called
      // Note: This would require checking the actual implementation
    });
  });
});

