/**
 * Frozen Account Detector
 * 
 * Detects if token accounts are frozen before allowing burn operations.
 * Handles both regular NFTs and pNFTs (which can also be frozen).
 * 
 * @version 0.1.1
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// ============================================================================
// TYPES
// ============================================================================

export interface FrozenAccountCheckResult {
  /** Whether the account is frozen */
  frozen: boolean;
  /** Token account public key */
  tokenAccount: PublicKey;
  /** Freeze authority (if frozen) */
  freezeAuthority?: PublicKey;
  /** Error message if check failed */
  error?: string;
  /** Account balance */
  balance?: string;
}

// ============================================================================
// FROZEN ACCOUNT DETECTION
// ============================================================================

/**
 * Check if token account is frozen
 * 
 * Works for both regular NFTs and pNFTs. Regular NFTs can be manually
 * frozen by the freeze authority (often used for scam prevention).
 * 
 * @param connection - Solana connection
 * @param tokenAccount - Token account to check
 * @param tokenProgram - Token program ID (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
 * @returns Check result with frozen status and details
 * 
 * @example
 * ```typescript
 * const result = await checkIfFrozenBeforeBurn(
 *   connection,
 *   tokenAccount,
 *   TOKEN_PROGRAM_ID
 * );
 * 
 * if (result.frozen) {
 *   throw new Error(`Account is frozen by authority: ${result.freezeAuthority}`);
 * }
 * ```
 */
export async function checkIfFrozenBeforeBurn(
  connection: Connection,
  tokenAccount: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): Promise<FrozenAccountCheckResult> {
  try {
    // Get token account info
    const accountInfo = await getAccount(connection, tokenAccount, 'confirmed', tokenProgram);

    // Check if account is frozen
    if (accountInfo.isFrozen) {
      return {
        frozen: true,
        tokenAccount,
        freezeAuthority: accountInfo.mint, // Mint is the freeze authority
        balance: accountInfo.amount.toString(),
      };
    }

    // Get balance for additional info (from account info)
    const balance = accountInfo.amount.toString();

    return {
      frozen: false,
      tokenAccount,
      balance,
    };
  } catch (error) {
    // Account might not exist or other error
    return {
      frozen: false,
      tokenAccount,
      error: error instanceof Error ? error.message : 'Unknown error checking frozen status',
    };
  }
}

/**
 * Check if NFT token account is frozen (helper for NFT-specific checks)
 * 
 * This function finds the associated token account for an NFT and checks
 * if it's frozen. Useful as a pre-flight check before burn operations.
 * 
 * @param connection - Solana connection
 * @param mint - Mint address
 * @param owner - Token owner
 * @param tokenProgram - Token program ID
 * @returns Check result with frozen status
 */
export async function checkNFTFrozenStatus(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): Promise<FrozenAccountCheckResult> {
  try {
    // Get associated token account
    const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram);

    // Check if frozen
    return await checkIfFrozenBeforeBurn(connection, tokenAccount, tokenProgram);
  } catch (error) {
    return {
      frozen: false,
      tokenAccount: PublicKey.default, // Placeholder
      error: error instanceof Error ? error.message : 'Failed to check frozen status',
    };
  }
}

/**
 * Validate that token account is not frozen before burn
 * 
 * Throws an error if account is frozen, otherwise returns silently.
 * Useful as a guard before building burn transactions.
 * 
 * @param connection - Solana connection
 * @param tokenAccount - Token account to validate
 * @param tokenProgram - Token program ID
 * @throws Error if account is frozen
 */
export async function assertNotFrozen(
  connection: Connection,
  tokenAccount: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): Promise<void> {
  const result = await checkIfFrozenBeforeBurn(connection, tokenAccount, tokenProgram);

  if (result.frozen) {
    throw new Error(
      `Token account ${tokenAccount.toBase58()} is frozen. ` +
      `Cannot burn frozen tokens. Freeze authority: ${result.freezeAuthority?.toBase58() || 'Unknown'}. ` +
      `Contact the freeze authority to unfreeze the account before burning.`
    );
  }

  if (result.error) {
    console.warn(`⚠️ Frozen status check warning: ${result.error}`);
    // Don't throw - account might not exist yet, which is fine
  }
}

/**
 * Check multiple token accounts for frozen status
 * 
 * Useful for batch operations or checking multiple NFTs at once.
 * 
 * @param connection - Solana connection
 * @param tokenAccounts - Array of token accounts to check
 * @param tokenProgram - Token program ID
 * @returns Array of check results
 */
export async function checkMultipleAccountsFrozen(
  connection: Connection,
  tokenAccounts: PublicKey[],
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): Promise<FrozenAccountCheckResult[]> {
  const checks = tokenAccounts.map((account) =>
    checkIfFrozenBeforeBurn(connection, account, tokenProgram)
  );

  return Promise.all(checks);
}

