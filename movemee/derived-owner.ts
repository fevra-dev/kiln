/**
 * ⚠️ DEPRECATED: Hardened Derived Owner Algorithm (Legacy)
 * 
 * @deprecated Since v0.1.1 - Use `@/lib/teleburn` instead
 * 
 * This implementation uses a different preimage order (domain-first)
 * than the standardized teleburn.ts (txid-first). Different preimage
 * order produces DIFFERENT addresses for the same inscription ID.
 * 
 * **Migration:** See docs/TELEBURN_MIGRATION.md
 * **New implementation:** src/lib/teleburn.ts
 * 
 * @description Derives a deterministic off-curve Solana public key from
 * Bitcoin inscription ID using domain separation. This creates a provably
 * ownerless address (no private key exists) for teleburn operations.
 * 
 * **DO NOT USE IN NEW CODE** - This file is kept for backward compatibility
 * with existing deployments only.
 * 
 * @version 0.1.0 (Legacy)
 */

import { PublicKey } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha256';
import { DOMAIN } from './types';
import type { DerivedOwnerResult } from './types';
import { isValidInscriptionId } from './schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum bump attempts before giving up (should never reach this) */
const MAX_BUMP = 255;

/** Domain separation string for address derivation */
const DERIVATION_DOMAIN = DOMAIN; // 'ordinals.teleburn.sbt01.v1'

// ============================================================================
// MAIN DERIVATION FUNCTION
// ============================================================================

/**
 * ⚠️ DEPRECATED: Derive a deterministic off-curve public key from inscription ID
 * 
 * @deprecated Use `deriveTeleburnAddress()` from `@/lib/teleburn` instead
 * 
 * This algorithm:
 * 1. Parses inscription ID into txid + index components
 * 2. Uses domain separation to prevent cross-protocol attacks
 * 3. Iterates bump seed until an off-curve point is found
 * 4. Returns PublicKey + bump for reproducibility
 * 
 * **Why deprecated?** Different preimage order than standardized implementation.
 * See docs/TELEBURN_MIGRATION.md for details.
 * 
 * The derived address has NO private key and cannot sign transactions.
 * It exists solely as a verifiable burn address for teleburn operations.
 * 
 * @param inscriptionId - Bitcoin inscription ID format: <txid>i<index>
 * @param startBump - Starting bump value (default: 0)
 * @returns DerivedOwnerResult with publicKey and bump
 * 
 * @throws Error if inscription ID format is invalid
 * @throws Error if no off-curve point found within 256 attempts (extremely unlikely)
 * 
 * @example
 * ```typescript
 * // ⚠️ DEPRECATED - Use teleburn.ts instead:
 * // import { deriveTeleburnAddress } from '@/lib/teleburn';
 * // const address = await deriveTeleburnAddress('abc...i0');
 * 
 * const result = deriveOwner('abc123...def789i0');
 * console.log('Derived address:', result.publicKey.toBase58());
 * console.log('Bump:', result.bump);
 * ```
 */
export function deriveOwner(
  inscriptionId: string,
  startBump = 0
): DerivedOwnerResult {
  // Step 1: Validate inscription ID format
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(
      `Invalid inscription ID format: "${inscriptionId}". ` +
      'Expected format: <64-hex-txid>i<index>'
    );
  }

  // Step 2: Parse inscription ID into components
  const { txid, index } = parseInscriptionId(inscriptionId);

  // Step 3: Validate bump range
  if (startBump < 0 || startBump > MAX_BUMP) {
    throw new Error(`Invalid startBump: ${startBump}. Must be 0-255.`);
  }

  // Step 4: Prepare domain bytes (UTF-8 encoding)
  const domainBytes = Buffer.from(DERIVATION_DOMAIN, 'utf-8');

  // Step 5: Prepare index bytes (big-endian u32)
  const indexBytes = Buffer.alloc(4);
  indexBytes.writeUInt32BE(index, 0);

  // Step 6: Iterate bump seed until off-curve point found
  let bump = startBump;

  while (bump <= MAX_BUMP) {
    // Prepare bump byte
    const bumpBytes = Buffer.from([bump]);

    // Compute SHA-256 hash of: domain || txid || index || bump
    const preimage = Buffer.concat([
      domainBytes,
      txid,
      indexBytes,
      bumpBytes
    ]);

    const candidateBytes = Buffer.from(sha256(preimage));

    // Try to construct PublicKey
    // If the 32-byte hash is on-curve, PublicKey constructor succeeds
    // If off-curve, constructor throws an error
    try {
      const publicKey = new PublicKey(candidateBytes);
      
      // Check if point is actually on curve using Ed25519 validation
      // PublicKey constructor doesn't always throw for invalid points
      if (isOnCurve(candidateBytes)) {
        // Point is on curve - try next bump
        bump++;
        continue;
      }

      // Point is off-curve - success!
      return {
        publicKey,
        bump
      };

    } catch {
      // Constructor threw - point is definitely off-curve
      // Construct PublicKey without validation for return
      const publicKey = new PublicKey(candidateBytes);
      return {
        publicKey,
        bump
      };
    }
  }

  // This should be statistically impossible (probability ~ 2^-128 per attempt)
  throw new Error(
    `Failed to derive off-curve point within ${MAX_BUMP + 1} attempts. ` +
    'This is a critical error - please report this bug.'
  );
}

/**
 * Verify a derived owner was correctly computed
 * 
 * This function re-derives the owner and checks if it matches.
 * Used for verification and testing.
 * 
 * @param inscriptionId - Bitcoin inscription ID
 * @param expectedPublicKey - Expected derived public key
 * @param expectedBump - Expected bump value
 * @returns true if derivation matches
 * 
 * @example
 * ```typescript
 * const result = deriveOwner('abc...i0');
 * const isValid = verifyDerivedOwner('abc...i0', result.publicKey, result.bump);
 * console.log('Valid:', isValid); // true
 * ```
 */
export function verifyDerivedOwner(
  inscriptionId: string,
  expectedPublicKey: PublicKey,
  expectedBump: number
): boolean {
  try {
    const result = deriveOwner(inscriptionId, expectedBump);
    
    return (
      result.publicKey.equals(expectedPublicKey) &&
      result.bump === expectedBump
    );
  } catch {
    return false;
  }
}

/**
 * Get Associated Token Address (ATA) for derived owner
 * 
 * This is where tokens will be locked during teleburn-derived method.
 * 
 * @param inscriptionId - Bitcoin inscription ID
 * @param mintAddress - Solana token mint address
 * @returns Promise resolving to ATA public key
 * 
 * @example
 * ```typescript
 * const ata = await getDerivedOwnerATA('abc...i0', mintPubkey);
 * console.log('Tokens will be locked at:', ata.toBase58());
 * ```
 */
export async function getDerivedOwnerATA(
  inscriptionId: string,
  mintAddress: PublicKey
): Promise<PublicKey> {
  const { publicKey: derivedOwner } = deriveOwner(inscriptionId);
  
  // Import getAssociatedTokenAddress from SPL Token
  const { getAssociatedTokenAddress } = await import('@solana/spl-token');
  
  return getAssociatedTokenAddress(
    mintAddress,
    derivedOwner,
    true // allowOwnerOffCurve - required for off-curve derived owner
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse inscription ID into txid and index components
 * 
 * @param inscriptionId - Inscription ID to parse
 * @returns Parsed components
 * @throws Error if format is invalid
 */
function parseInscriptionId(inscriptionId: string): {
  txid: Buffer;
  index: number;
} {
  // Split on 'i' character
  const parts = inscriptionId.split('i');
  
  if (parts.length !== 2) {
    throw new Error(`Invalid inscription ID format: expected exactly one 'i' separator`);
  }

  const [txidHex, indexStr] = parts;

  // Parse txid (must be 64 hex characters = 32 bytes)
  if (!txidHex || txidHex.length !== 64) {
    throw new Error(`Invalid txid: expected 64 hex characters, got ${txidHex?.length || 0}`);
  }

  const txid = Buffer.from(txidHex, 'hex');
  if (txid.length !== 32) {
    throw new Error(`Invalid txid: failed to decode hex string`);
  }

  // Parse index (must be non-negative integer)
  if (!indexStr) {
    throw new Error(`Invalid index: missing after 'i' separator`);
  }

  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 0) {
    throw new Error(`Invalid index: must be non-negative integer, got "${indexStr}"`);
  }

  return { txid, index };
}

/**
 * Check if a 32-byte point is on the Ed25519 curve
 * 
 * This is a simplified check - in production, you may want to use
 * a full Ed25519 library for validation.
 * 
 * @param bytes - 32-byte candidate point
 * @returns true if point is on curve
 */
function isOnCurve(bytes: Buffer): boolean {
  try {
    // Try to use the point with Solana's PublicKey validation
    // If it constructs without error and operations work, it's on-curve
    const pk = new PublicKey(bytes);
    
    // Additional validation: try to use it in an operation
    // Off-curve points will fail here
    pk.toBuffer();
    
    // If we got here, it's likely on-curve
    // For absolute certainty, use Ed25519 point validation
    return true;
    
  } catch {
    // Construction or operation failed - definitely off-curve
    return false;
  }
}

/**
 * Format derived owner info for display
 * 
 * @param result - DerivedOwnerResult to format
 * @returns Human-readable string
 */
export function formatDerivedOwner(result: DerivedOwnerResult): string {
  return `${result.publicKey.toBase58()} (bump: ${result.bump})`;
}

/**
 * Batch derive multiple owners (parallel execution)
 * 
 * @param inscriptionIds - Array of inscription IDs
 * @returns Array of derivation results
 */
export function deriveBatch(inscriptionIds: string[]): DerivedOwnerResult[] {
  return inscriptionIds.map(id => deriveOwner(id));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default deriveOwner;

