/**
 * Transaction Utilities
 * 
 * Enhanced transaction handling with:
 * - Priority fees and compute unit budgets
 * - Blockhash refresh and expiry handling
 * - Transaction retry with exponential backoff
 * - Confirmation timeout with polling
 * - Compute unit limit validation
 * - Account state validation
 * 
 * @version 0.1.1
 */

import {
  Connection,
  Transaction,
  PublicKey,
  ComputeBudgetProgram,
  Commitment,
  TransactionSignature,
} from '@solana/web3.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default priority fee in microlamports (0.001 SOL per 1M CU) */
export const DEFAULT_PRIORITY_FEE_MICROLAMPORTS = 1000;

/** Default compute unit limit (200K CU should be enough for most burns) */
export const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000;

/** Maximum compute unit limit (Solana's hard limit) */
export const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;

/** Blockhash expiry time in milliseconds (~60 slots * 400ms per slot) */
export const BLOCKHASH_EXPIRY_MS = 60 * 400; // ~24 seconds, but use 20s for safety

/** Default confirmation timeout in milliseconds */
export const DEFAULT_CONFIRMATION_TIMEOUT_MS = 30_000; // 30 seconds

/** Default retry attempts */
export const DEFAULT_MAX_RETRIES = 3;

/** Base delay for exponential backoff (milliseconds) */
export const DEFAULT_BASE_RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface PriorityFeeConfig {
  /** Priority fee in microlamports */
  microlamports?: number;
  /** Requested compute units */
  computeUnits?: number;
}

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  retryableErrors?: string[];
}

export interface ConfirmationConfig {
  timeoutMs?: number;
  commitment?: Commitment;
  pollingIntervalMs?: number;
}

export interface TransactionUtilsConfig {
  priorityFee?: PriorityFeeConfig;
  retry?: RetryConfig;
  confirmation?: ConfirmationConfig;
}

// ============================================================================
// PRIORITY FEES
// ============================================================================

/**
 * Dynamic Priority Fee Calculator
 * 
 * Calculates optimal priority fees based on recent network conditions.
 * Uses percentile-based pricing to balance cost vs. speed.
 */
export class DynamicPriorityFeeCalculator {
  /**
   * Get recommended priority fee based on network conditions
   * 
   * @param connection - Solana connection
   * @param priority - Priority level: 'low' | 'medium' | 'high'
   * @returns Recommended priority fee in microlamports
   * 
   * @example
   * ```typescript
   * const calculator = new DynamicPriorityFeeCalculator();
   * const fee = await calculator.getRecommendedFee(connection, 'medium');
   * addPriorityFee(tx, { microlamports: fee });
   * ```
   */
  async getRecommendedFee(
    connection: Connection,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<number> {
    try {
      // Sample recent prioritization fees from network
      // Note: getRecentPrioritizationFees is available in @solana/web3.js v1.87.0+
      // Check if method exists and call it
      if (!connection.getRecentPrioritizationFees) {
        // Method not available, use default
        return this.getDefaultFee(priority);
      }

      const recentFees = await connection.getRecentPrioritizationFees();

      if (!recentFees || recentFees.length === 0) {
        // Fallback to default if API not available
        return this.getDefaultFee(priority);
      }

      // Extract fee values and sort
      const fees = recentFees
        .map((f) => f.prioritizationFee)
        .filter((f) => f > 0) // Filter out zero fees
        .sort((a, b) => a - b);

      if (fees.length === 0) {
        return this.getDefaultFee(priority);
      }

      // Calculate percentile based on priority
      const percentile = {
        low: 0.25, // 25th percentile (cheaper, slower)
        medium: 0.50, // 50th percentile (balanced)
        high: 0.75, // 75th percentile (faster, more expensive)
      }[priority];

      const index = Math.floor(fees.length * percentile);
      const recommendedFee = fees[index] || fees[0] || this.getDefaultFee(priority);

      // Ensure minimum fee
      return Math.max(recommendedFee, this.getDefaultFee('low'));
    } catch (error) {
      // Log fee calculation failure (development only)
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Failed to calculate dynamic priority fee, using default:', error);
      }
      return this.getDefaultFee(priority);
    }
  }

  /**
   * Get default fee for priority level
   */
  private getDefaultFee(priority: 'low' | 'medium' | 'high'): number {
    const defaults = {
      low: 500, // 0.0005 SOL per 1M CU
      medium: DEFAULT_PRIORITY_FEE_MICROLAMPORTS, // 0.001 SOL per 1M CU
      high: 2000, // 0.002 SOL per 1M CU
    };
    return defaults[priority];
  }
}

/**
 * Add priority fee and compute unit budget instructions to transaction
 * 
 * @param transaction - Transaction to enhance
 * @param config - Priority fee configuration
 * @returns Transaction with priority fee instructions added
 * 
 * @example
 * ```typescript
 * const tx = new Transaction();
 * // ... add instructions ...
 * addPriorityFee(tx, { microlamports: 2000, computeUnits: 300_000 });
 * ```
 */
export function addPriorityFee(
  transaction: Transaction,
  config: PriorityFeeConfig = {}
): Transaction {
  const microlamports = config.microlamports ?? DEFAULT_PRIORITY_FEE_MICROLAMPORTS;
  const computeUnits = config.computeUnits ?? DEFAULT_COMPUTE_UNIT_LIMIT;

  // Add compute unit price (priority fee) instruction
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: microlamports,
    })
  );

  // Add compute unit limit instruction
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnits,
    })
  );

  return transaction;
}

/**
 * Add dynamic priority fee based on network conditions
 * 
 * @param transaction - Transaction to enhance
 * @param connection - Solana connection
 * @param priority - Priority level (default: 'medium')
 * @param computeUnits - Optional compute unit limit
 * @returns Transaction with dynamic priority fee instructions added
 * 
 * @example
 * ```typescript
 * const tx = new Transaction();
 * // ... add instructions ...
 * await addDynamicPriorityFee(tx, connection, 'high');
 * ```
 */
export async function addDynamicPriorityFee(
  transaction: Transaction,
  connection: Connection,
  priority: 'low' | 'medium' | 'high' = 'medium',
  computeUnits?: number
): Promise<Transaction> {
  const calculator = new DynamicPriorityFeeCalculator();
  const microlamports = await calculator.getRecommendedFee(connection, priority);

  return addPriorityFee(transaction, {
    microlamports,
    computeUnits: computeUnits ?? DEFAULT_COMPUTE_UNIT_LIMIT,
  });
}

// ============================================================================
// BLOCKHASH REFRESH
// ============================================================================

/**
 * Refresh blockhash if transaction is stale or missing
 * 
 * @param transaction - Transaction to refresh
 * @param connection - Solana connection
 * @param maxAgeMs - Maximum age in milliseconds before refresh (default: 20s)
 * @returns Transaction with fresh blockhash
 * 
 * @example
 * ```typescript
 * const freshTx = await refreshBlockhashIfNeeded(tx, connection);
 * ```
 */
export async function refreshBlockhashIfNeeded(
  transaction: Transaction,
  connection: Connection,
  maxAgeMs: number = BLOCKHASH_EXPIRY_MS
): Promise<Transaction> {
  // If transaction doesn't have blockhash, always refresh
  if (!transaction.recentBlockhash) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    if (lastValidBlockHeight) {
      transaction.lastValidBlockHeight = lastValidBlockHeight;
    }
    return transaction;
  }

  // Check if blockhash is stale
  // Estimate age based on slot (rough approximation: ~400ms per slot)
  if (transaction.lastValidBlockHeight) {
    const currentSlot = await connection.getSlot();
    const slotsRemaining = transaction.lastValidBlockHeight - currentSlot;
    const estimatedAgeMs = slotsRemaining * 400; // ~400ms per slot
    
    // If less than maxAgeMs remaining, refresh
    if (estimatedAgeMs < maxAgeMs) {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      if (lastValidBlockHeight) {
        transaction.lastValidBlockHeight = lastValidBlockHeight;
      }
    }
  } else {
    // No lastValidBlockHeight, always refresh to be safe
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    if (lastValidBlockHeight) {
      transaction.lastValidBlockHeight = lastValidBlockHeight;
    }
  }

  return transaction;
}

/**
 * Check if blockhash is expired or about to expire
 * 
 * @param transaction - Transaction to check
 * @param connection - Solana connection
 * @param bufferMs - Buffer time in milliseconds before considering expired
 * @returns true if blockhash is expired or about to expire
 */
export async function isBlockhashExpired(
  transaction: Transaction,
  connection: Connection,
  bufferMs: number = 5000
): Promise<boolean> {
  if (!transaction.recentBlockhash || !transaction.lastValidBlockHeight) {
    return true; // No blockhash = expired
  }

  const currentSlot = await connection.getSlot();
  const slotsRemaining = transaction.lastValidBlockHeight - currentSlot;
  const msRemaining = slotsRemaining * 400; // ~400ms per slot

  return msRemaining < bufferMs;
}

// ============================================================================
// COMPUTE UNIT VALIDATION
// ============================================================================

/**
 * Validate compute unit usage and check if transaction will exceed limits
 * 
 * @param transaction - Transaction to validate
 * @param connection - Solana connection
 * @returns Validation result with CU usage and recommendations
 */
export async function validateComputeUnits(
  transaction: Transaction,
  connection: Connection
): Promise<{
  valid: boolean;
  unitsUsed?: number;
  limit: number;
  recommendation?: string;
}> {
  try {
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });

    const unitsUsed = simulation.value.unitsConsumed || 0;
    const limit = MAX_COMPUTE_UNIT_LIMIT;

    if (unitsUsed > limit) {
      return {
        valid: false,
        unitsUsed,
        limit,
        recommendation: `Transaction uses ${unitsUsed} CU, exceeding limit of ${limit}. Consider splitting into multiple transactions.`,
      };
    }

    // Check if we're close to the limit (warn if >80% of limit)
    if (unitsUsed > limit * 0.8) {
      return {
        valid: true,
        unitsUsed,
        limit,
        recommendation: `Transaction uses ${unitsUsed} CU (${Math.round((unitsUsed / limit) * 100)}% of limit). Consider optimizing.`,
      };
    }

    return {
      valid: true,
      unitsUsed,
      limit,
    };
  } catch (error) {
    // Simulation failed, but don't block transaction
    return {
      valid: true,
      limit: MAX_COMPUTE_UNIT_LIMIT,
      recommendation: 'Could not simulate transaction to validate compute units',
    };
  }
}

// ============================================================================
// TRANSACTION RETRY
// ============================================================================

/**
 * Check if an error is retryable
 * 
 * @param error - Error to check
 * @param retryableErrors - List of error patterns to consider retryable
 * @returns true if error is retryable
 */
function isRetryableError(
  error: unknown,
  retryableErrors: string[] = [
    'blockhash',
    'timeout',
    'network',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'Transaction was not confirmed',
    'Transaction expired',
  ]
): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return retryableErrors.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
}

/**
 * Send transaction with automatic retry and blockhash refresh
 * 
 * @param connection - Solana connection
 * @param transaction - Transaction to send
 * @param signer - Signer function (called before each retry)
 * @param config - Retry configuration
 * @returns Transaction signature
 * 
 * @example
 * ```typescript
 * const signature = await sendTransactionWithRetry(
 *   connection,
 *   transaction,
 *   async (tx) => await wallet.signTransaction(tx),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function sendTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  signer: (tx: Transaction) => Promise<Transaction>,
  config: RetryConfig = {}
): Promise<TransactionSignature> {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS;
  const retryableErrors = config.retryableErrors;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Refresh blockhash before each attempt
      await refreshBlockhashIfNeeded(transaction, connection);

      // Sign transaction
      const signedTx = await signer(transaction);

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 0, // We handle retries ourselves
      });

      return signature;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const shouldRetry = isRetryableError(error, retryableErrors);

      if (!shouldRetry || attempt === maxRetries - 1) {
        // Not retryable or out of retries
        throw lastError;
      }

      // Exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      // Log retry attempt (development only)
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(
          `⚠️ Transaction send failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms...`,
          error
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Transaction send failed after retries');
}

// ============================================================================
// CONFIRMATION WITH TIMEOUT
// ============================================================================

/**
 * Confirm transaction with timeout and polling
 * 
 * @param connection - Solana connection
 * @param signature - Transaction signature
 * @param config - Confirmation configuration
 * @returns Confirmation result
 * 
 * @example
 * ```typescript
 * const result = await confirmTransactionWithTimeout(
 *   connection,
 *   signature,
 *   { timeoutMs: 30000, commitment: 'confirmed' }
 * );
 * if (result.confirmed) {
 *   console.log('Transaction confirmed!');
 * }
 * ```
 */
export async function confirmTransactionWithTimeout(
  connection: Connection,
  signature: TransactionSignature,
  config: ConfirmationConfig = {}
): Promise<{
  confirmed: boolean;
  error?: string;
  slot?: number;
  blockTime?: number | null;
}> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
  const pollingIntervalMs = config.pollingIntervalMs ?? 1000;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      if (status.value) {
        // Check if transaction failed
        if (status.value.err) {
          return {
            confirmed: false,
            error: JSON.stringify(status.value.err),
            slot: status.value.slot || undefined,
            blockTime: status.value.blockTime || undefined,
          };
        }

        // Check if transaction is confirmed
        if (
          status.value.confirmationStatus === 'confirmed' ||
          status.value.confirmationStatus === 'finalized'
        ) {
          return {
            confirmed: true,
            slot: status.value.slot || undefined,
            blockTime: status.value.blockTime || undefined,
          };
        }
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
    } catch (error) {
      // If we're close to timeout, return error
      if (Date.now() - startTime > timeoutMs * 0.9) {
        return {
          confirmed: false,
          error: error instanceof Error ? error.message : 'Confirmation timeout',
        };
      }

      // Otherwise, continue polling
      await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
    }
  }

  // Timeout reached
  return {
    confirmed: false,
    error: `Confirmation timeout after ${timeoutMs}ms - transaction may still be processing`,
  };
}

// ============================================================================
// ACCOUNT STATE VALIDATION
// ============================================================================

/**
 * Validate account state before sending transaction
 * 
 * @param connection - Solana connection
 * @param mint - Mint address
 * @param owner - Token owner address
 * @param expectedSlot - Optional slot from dry-run (for staleness check)
 * @returns Validation result
 */
export async function validateAccountStateBeforeSend(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  _expectedSlot?: number
): Promise<{
  valid: boolean;
  reason?: string;
  tokenAccountExists?: boolean;
  balance?: string;
  isFrozen?: boolean;
}> {
  try {
    // Get token accounts for owner
    const tokenAccounts = await connection.getTokenAccountsByOwner(owner, {
      mint,
    });

    if (tokenAccounts.value.length === 0) {
      return {
        valid: false,
        reason: 'Token account does not exist for this NFT',
        tokenAccountExists: false,
      };
    }

    const tokenAccount = tokenAccounts.value[0];
    const accountInfo = await connection.getAccountInfo(tokenAccount.pubkey);

    if (!accountInfo) {
      return {
        valid: false,
        reason: 'Token account info not found',
        tokenAccountExists: false,
      };
    }

    // Check balance
    const balance = await connection.getTokenAccountBalance(tokenAccount.pubkey);
    if (balance.value.uiAmount === 0) {
      return {
        valid: false,
        reason: 'Token account has zero balance - NFT may have been transferred',
        tokenAccountExists: true,
        balance: '0',
      };
    }

    // Note: Frozen status check would require parsing token account data
    // For now, we'll rely on simulation to catch frozen account errors

    return {
      valid: true,
      tokenAccountExists: true,
      balance: balance.value.uiAmountString,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Account validation failed',
    };
  }
}

// ============================================================================
// COMPREHENSIVE TRANSACTION HELPER
// ============================================================================

/**
 * Send transaction with all enhancements (priority fees, retry, timeout, validation)
 * 
 * @param connection - Solana connection
 * @param transaction - Transaction to send
 * @param signer - Signer function
 * @param config - Configuration for all enhancements
 * @returns Transaction signature and confirmation result
 */
export async function sendTransactionEnhanced(
  connection: Connection,
  transaction: Transaction,
  signer: (tx: Transaction) => Promise<Transaction>,
  config: TransactionUtilsConfig = {}
): Promise<{
  signature: TransactionSignature;
  confirmed: boolean;
  error?: string;
  slot?: number;
  blockTime?: number | null;
}> {
  // 1. Add priority fees
  if (config.priorityFee) {
    addPriorityFee(transaction, config.priorityFee);
  }

  // 2. Refresh blockhash
  await refreshBlockhashIfNeeded(transaction, connection);

  // 3. Validate compute units (optional, but recommended)
  const cuValidation = await validateComputeUnits(transaction, connection);
  if (!cuValidation.valid && cuValidation.recommendation) {
    // Log compute unit validation warning (development only)
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(`⚠️ Compute unit validation: ${cuValidation.recommendation}`);
    }
  }

  // 4. Send with retry
  const signature = await sendTransactionWithRetry(connection, transaction, signer, config.retry);

  // 5. Confirm with timeout
  const confirmation = await confirmTransactionWithTimeout(
    connection,
    signature,
    config.confirmation
  );

  return {
    signature,
    ...confirmation,
  };
}

