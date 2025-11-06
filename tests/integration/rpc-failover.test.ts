/**
 * Integration Tests: RPC Failover
 * 
 * Tests RPC failover in transaction building scenarios.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { TransactionBuilder } from '@/lib/transaction-builder';
import { withRpcFailover, getRpcManager, initializeRpcFailover } from '@/lib/rpc-failover';

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => ({
  ...jest.requireActual('@solana/web3.js'),
  Connection: jest.fn(),
}));

describe('RPC Failover Integration', () => {
  let mockConnection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clean up global manager
    const manager = getRpcManager();
    if (manager) {
      manager.stop();
    }

    mockConnection = jest.fn();
    (Connection as unknown as jest.Mock) = mockConnection;
  });

  afterEach(() => {
    const manager = getRpcManager();
    if (manager) {
      manager.stop();
    }
  });

  describe('Transaction Builder Integration', () => {
    it('should use failover in buildSealTransaction', async () => {
      initializeRpcFailover({
        primary: 'https://primary.example.com',
        backups: ['https://backup.example.com'],
      });

      // Mock connection methods
      let callCount = 0;
      mockConnection.mockImplementation(() => {
        callCount++;
        return {
          getLatestBlockhash: jest.fn().mockImplementation(() => {
            if (callCount === 1) {
              throw new Error('Primary failed');
            }
            return Promise.resolve({ blockhash: 'test-hash', lastValidBlockHeight: 100 });
          }),
          getSlot: jest.fn().mockResolvedValue(1000),
        };
      });

      const builder = new TransactionBuilder('https://primary.example.com');
      
      // Should succeed via failover
      await expect(
        builder.buildSealTransaction({
          payer: PublicKey.default,
          mint: PublicKey.default,
          inscriptionId: 'abc123i0',
          sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        })
      ).resolves.toBeDefined();
    });

    it('should use failover in buildRetireTransaction', async () => {
      initializeRpcFailover({
        primary: 'https://primary.example.com',
        backups: ['https://backup.example.com'],
      });

      let callCount = 0;
      mockConnection.mockImplementation(() => {
        callCount++;
        return {
          getLatestBlockhash: jest.fn().mockImplementation(() => {
            if (callCount === 1) throw new Error('Primary failed');
            return Promise.resolve({ blockhash: 'test-hash', lastValidBlockHeight: 100 });
          }),
          getSlot: jest.fn().mockResolvedValue(1000),
          getAccountInfo: jest.fn().mockResolvedValue({ owner: PublicKey.default }),
        };
      });

      const builder = new TransactionBuilder('https://primary.example.com');
      
      // Mock isPNFT to return false
      jest.mock('@/lib/metaplex-burn', () => ({
        isPNFT: jest.fn().mockResolvedValue(false),
      }));

      await expect(
        builder.buildRetireTransaction({
          payer: PublicKey.default,
          owner: PublicKey.default,
          mint: PublicKey.default,
          inscriptionId: 'abc123i0',
          sha256: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
          method: 'burn',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('withRpcFailover Integration', () => {
    it('should automatically failover on RPC errors', async () => {
      initializeRpcFailover({
        primary: 'https://primary.example.com',
        backups: ['https://backup.example.com'],
      });

      let callCount = 0;
      const result = await withRpcFailover(async (conn) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Primary RPC failed');
        }
        return { success: true, data: 'backup-success' };
      });

      expect(result).toEqual({ success: true, data: 'backup-success' });
      expect(callCount).toBe(2); // Tried primary, then backup
    });
  });
});

