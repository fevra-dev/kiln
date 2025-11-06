/**
 * Transaction Size Validator
 * 
 * Validates that transactions don't exceed Solana's size limits.
 * Legacy and versioned transactions both have a 1232 byte limit.
 * 
 * For complex pNFT burns with many accounts, provides recommendations
 * for using Address Lookup Tables (ALTs) or splitting transactions.
 * 
 * @version 0.1.1
 */

import { Transaction, VersionedTransaction } from '@solana/web3.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum transaction size in bytes (Solana limit) */
export const MAX_TRANSACTION_SIZE = 1232;

/** Warning threshold (80% of max size) */
export const TRANSACTION_SIZE_WARNING_THRESHOLD = MAX_TRANSACTION_SIZE * 0.8;

// ============================================================================
// TYPES
// ============================================================================

export interface TransactionSizeValidationResult {
  /** Whether transaction size is valid */
  valid: boolean;
  /** Actual transaction size in bytes */
  size: number;
  /** Maximum allowed size */
  maxSize: number;
  /** Warning message if close to limit */
  warning?: string;
  /** Recommendation for optimization */
  recommendation?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate transaction size
 * 
 * Checks if transaction exceeds Solana's 1232 byte limit.
 * Provides warnings and recommendations if transaction is large.
 * 
 * @param transaction - Transaction to validate
 * @returns Validation result with size information
 * 
 * @example
 * ```typescript
 * const validation = validateTransactionSize(transaction);
 * if (!validation.valid) {
 *   throw new Error(`Transaction too large: ${validation.recommendation}`);
 * }
 * 
 * if (validation.warning) {
 *   console.warn(validation.warning);
 * }
 * ```
 */
export function validateTransactionSize(
  transaction: Transaction | VersionedTransaction
): TransactionSizeValidationResult {
  try {
    // Serialize transaction to get size
    let serialized: Uint8Array;
    
    if (transaction instanceof VersionedTransaction) {
      serialized = transaction.serialize();
    } else {
      serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    }

    const size = serialized.length;
    const valid = size <= MAX_TRANSACTION_SIZE;

    // Generate recommendations if needed
    let warning: string | undefined;
    let recommendation: string | undefined;

    if (!valid) {
      recommendation =
        `Transaction size (${size} bytes) exceeds limit (${MAX_TRANSACTION_SIZE} bytes). ` +
        `Consider: 1) Using Address Lookup Tables (ALTs) to compress account keys, ` +
        `2) Splitting into multiple transactions, 3) Compressing memo data, ` +
        `4) Reducing number of instructions.`;
    } else if (size > TRANSACTION_SIZE_WARNING_THRESHOLD) {
      warning =
        `Transaction is large (${size} bytes, ${Math.round((size / MAX_TRANSACTION_SIZE) * 100)}% of limit). ` +
        `Consider optimization if transaction might grow.`;
    }

    return {
      valid,
      size,
      maxSize: MAX_TRANSACTION_SIZE,
      warning,
      recommendation,
    };
  } catch (error) {
    // If serialization fails, return invalid result
    return {
      valid: false,
      size: 0,
      maxSize: MAX_TRANSACTION_SIZE,
      recommendation: `Failed to serialize transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Assert transaction size is valid
 * 
 * Throws an error if transaction exceeds size limit, otherwise returns silently.
 * 
 * @param transaction - Transaction to validate
 * @throws Error if transaction is too large
 */
export function assertTransactionSizeValid(
  transaction: Transaction | VersionedTransaction
): void {
  const validation = validateTransactionSize(transaction);

  if (!validation.valid) {
    throw new Error(
      `Transaction size validation failed: ${validation.recommendation || 'Transaction too large'}`
    );
  }

  if (validation.warning) {
    console.warn(`⚠️ Transaction size warning: ${validation.warning}`);
  }
}

/**
 * Get transaction size in bytes
 * 
 * @param transaction - Transaction to measure
 * @returns Size in bytes
 */
export function getTransactionSize(
  transaction: Transaction | VersionedTransaction
): number {
  try {
    if (transaction instanceof VersionedTransaction) {
      return transaction.serialize().length;
    } else {
      return transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).length;
    }
  } catch {
    return 0;
  }
}

/**
 * Check if transaction can accommodate additional instructions
 * 
 * Estimates remaining space in transaction for additional instructions.
 * 
 * @param transaction - Current transaction
 * @param estimatedInstructionSize - Estimated size of additional instruction
 * @returns Whether there's enough space
 */
export function canAddInstruction(
  transaction: Transaction | VersionedTransaction,
  estimatedInstructionSize: number = 200 // Typical instruction size
): boolean {
  const currentSize = getTransactionSize(transaction);
  const projectedSize = currentSize + estimatedInstructionSize;
  
  return projectedSize <= MAX_TRANSACTION_SIZE;
}

/**
 * Get recommendations for reducing transaction size
 * 
 * Provides actionable recommendations based on transaction size.
 * 
 * @param transaction - Transaction to analyze
 * @returns Array of recommendations
 */
export function getSizeOptimizationRecommendations(
  transaction: Transaction | VersionedTransaction
): string[] {
  const validation = validateTransactionSize(transaction);
  const recommendations: string[] = [];

  if (!validation.valid || validation.size > TRANSACTION_SIZE_WARNING_THRESHOLD) {
    recommendations.push('Use Address Lookup Tables (ALTs) to compress account keys');
    recommendations.push('Split complex operations into multiple transactions');
    recommendations.push('Compress memo data (use shorter field names, remove optional fields)');
    recommendations.push('Reduce number of instructions if possible');
    recommendations.push('Consider using versioned transactions with ALTs');
  }

  return recommendations;
}

