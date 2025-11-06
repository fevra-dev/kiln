/**
 * Frozen Account Detector Tests
 * 
 * Tests for frozen account detection before burn operations.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  checkIfFrozenBeforeBurn,
  checkNFTFrozenStatus,
  assertNotFrozen,
  checkMultipleAccountsFrozen,
} from '@/lib/frozen-account-detector';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Mock @solana/spl-token
jest.mock('@solana/spl-token', () => ({
  ...jest.requireActual('@solana/spl-token'),
  getAccount: jest.fn(),
}));

import { getAccount } from '@solana/spl-token';

describe('Frozen Account Detector', () => {
  let mockConnection: Connection;
  let mockTokenAccount: PublicKey;
  let mockMint: PublicKey;
  let mockOwner: PublicKey;

  beforeEach(() => {
    mockConnection = {} as Connection;
    mockTokenAccount = PublicKey.default;
    mockMint = PublicKey.default;
    mockOwner = PublicKey.default;
  });

  describe('checkIfFrozenBeforeBurn', () => {
    it('should detect frozen account', async () => {
      (getAccount as jest.Mock).mockResolvedValue({
        isFrozen: true,
        mint: mockMint,
        amount: BigInt(1),
      });

      const result = await checkIfFrozenBeforeBurn(
        mockConnection,
        mockTokenAccount,
        TOKEN_PROGRAM_ID
      );

      expect(result.frozen).toBe(true);
      expect(result.freezeAuthority).toBeDefined();
    });

    it('should detect non-frozen account', async () => {
      (getAccount as jest.Mock).mockResolvedValue({
        isFrozen: false,
        amount: BigInt(1),
      });

      const result = await checkIfFrozenBeforeBurn(
        mockConnection,
        mockTokenAccount,
        TOKEN_PROGRAM_ID
      );

      expect(result.frozen).toBe(false);
      expect(result.balance).toBeDefined();
    });

    it('should handle account not found gracefully', async () => {
      (getAccount as jest.Mock).mockRejectedValue(new Error('Account not found'));

      const result = await checkIfFrozenBeforeBurn(
        mockConnection,
        mockTokenAccount,
        TOKEN_PROGRAM_ID
      );

      expect(result.frozen).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('checkNFTFrozenStatus', () => {
    it('should check frozen status for NFT', async () => {
      // Mock getAssociatedTokenAddressSync
      const mockGetATA = jest.fn().mockReturnValue(mockTokenAccount);
      jest.mock('@solana/spl-token', () => ({
        ...jest.requireActual('@solana/spl-token'),
        getAssociatedTokenAddressSync: mockGetATA,
      }));

      (getAccount as jest.Mock).mockResolvedValue({
        isFrozen: false,
        amount: BigInt(1),
      });

      const result = await checkNFTFrozenStatus(
        mockConnection,
        mockMint,
        mockOwner,
        TOKEN_PROGRAM_ID
      );

      expect(result.frozen).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (getAccount as jest.Mock).mockRejectedValue(new Error('RPC error'));

      const result = await checkNFTFrozenStatus(
        mockConnection,
        mockMint,
        mockOwner,
        TOKEN_PROGRAM_ID
      );

      expect(result.error).toBeDefined();
    });
  });

  describe('assertNotFrozen', () => {
    it('should not throw for non-frozen account', async () => {
      (getAccount as jest.Mock).mockResolvedValue({
        isFrozen: false,
        amount: BigInt(1),
      });

      await expect(
        assertNotFrozen(mockConnection, mockTokenAccount, TOKEN_PROGRAM_ID)
      ).resolves.not.toThrow();
    });

    it('should throw for frozen account', async () => {
      (getAccount as jest.Mock).mockResolvedValue({
        isFrozen: true,
        mint: mockMint,
        amount: BigInt(1),
      });

      await expect(
        assertNotFrozen(mockConnection, mockTokenAccount, TOKEN_PROGRAM_ID)
      ).rejects.toThrow('frozen');
    });
  });

  describe('checkMultipleAccountsFrozen', () => {
    it('should check multiple accounts', async () => {
      const accounts = [mockTokenAccount, PublicKey.unique()];

      (getAccount as jest.Mock)
        .mockResolvedValueOnce({
          isFrozen: false,
          amount: BigInt(1),
        })
        .mockResolvedValueOnce({
          isFrozen: true,
          mint: mockMint,
          amount: BigInt(1),
        });

      const results = await checkMultipleAccountsFrozen(
        mockConnection,
        accounts,
        TOKEN_PROGRAM_ID
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.frozen).toBe(false);
      expect(results[1]?.frozen).toBe(true);
    });
  });
});

