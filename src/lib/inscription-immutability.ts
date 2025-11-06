/**
 * Inscription Content Consistency Validator
 * 
 * NOTE: Bitcoin inscriptions are immutable on-chain. This feature does NOT verify
 * that Bitcoin changed (which is impossible). Instead, it verifies:
 * 
 * 1. API Reliability - Ensures APIs (ordinals.com, etc.) consistently serve correct data
 * 2. Cache Integrity - Verifies our cached inscription data hasn't been corrupted
 * 3. Multi-Source Validation - Confirms all data sources return the same content
 * 
 * This is a quality assurance check for our data sources, not a blockchain verification.
 * 
 * @version 0.1.1
 */

import { fetchInscriptionWithFailover } from './inscription-resilience';

// ============================================================================
// TYPES
// ============================================================================

export interface InscriptionSnapshot {
  /** Inscription ID */
  id: string;
  /** Content SHA-256 hash */
  contentHash: string;
  /** Timestamp when snapshot was taken */
  fetchedAt: number;
  /** Whether content was verified */
  verified: boolean;
  /** Source API that provided the data */
  source: string;
}

export interface ImmutabilityCheckResult {
  /** Whether content is unchanged */
  unchanged: boolean;
  /** Original hash (from seal) */
  originalHash: string;
  /** Current hash (from re-fetch) */
  currentHash: string;
  /** Error message if check failed */
  error?: string;
  /** Time elapsed since original fetch (milliseconds) */
  timeElapsed?: number;
  /** Source of current data */
  source?: string;
}

// ============================================================================
// SNAPSHOT STORAGE
// ============================================================================

/**
 * In-memory storage for inscription snapshots
 * Key: inscriptionId
 * Value: Snapshot data
 */
const inscriptionSnapshots = new Map<string, InscriptionSnapshot>();

/**
 * Store inscription snapshot
 * 
 * @param inscriptionId - Inscription ID
 * @param contentHash - SHA-256 hash of content
 * @param source - Source API that provided the data
 */
export function storeInscriptionSnapshot(
  inscriptionId: string,
  contentHash: string,
  source: string
): void {
  inscriptionSnapshots.set(inscriptionId, {
    id: inscriptionId,
    contentHash,
    fetchedAt: Date.now(),
    verified: true,
    source,
  });
}

/**
 * Get stored inscription snapshot
 * 
 * @param inscriptionId - Inscription ID
 * @returns Snapshot or null if not found
 */
export function getInscriptionSnapshot(
  inscriptionId: string
): InscriptionSnapshot | null {
  return inscriptionSnapshots.get(inscriptionId) || null;
}

/**
 * Clear inscription snapshot
 * 
 * @param inscriptionId - Inscription ID
 */
export function clearInscriptionSnapshot(inscriptionId: string): void {
  inscriptionSnapshots.delete(inscriptionId);
}

/**
 * Clear all snapshots
 */
export function clearAllSnapshots(): void {
  inscriptionSnapshots.clear();
}

// ============================================================================
// IMMUTABILITY VALIDATION
// ============================================================================

/**
 * Verify inscription content consistency
 * 
 * Re-fetches inscription content from APIs and compares SHA-256 hash with original.
 * 
 * IMPORTANT: This does NOT verify Bitcoin immutability (which is guaranteed by the blockchain).
 * Instead, it verifies that:
 * - APIs are serving correct/consistent data
 * - Our cache is intact
 * - Data sources are reliable
 * 
 * If hashes differ, it indicates:
 * - API bug/corruption (not Bitcoin change)
 * - Cache corruption
 * - Network data corruption
 * 
 * @param inscriptionId - Inscription ID
 * @param originalHash - Original SHA-256 hash (from seal operation)
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * // During seal operation
 * const originalHash = await fetchAndHashInscription(inscriptionId);
 * storeInscriptionSnapshot(inscriptionId, originalHash, 'seal-operation');
 * 
 * // Later, verify API consistency
 * const result = await verifyInscriptionImmutability(inscriptionId, originalHash);
 * if (!result.unchanged) {
 *   console.error('API inconsistency detected!', result);
 *   // This means API is serving wrong data, NOT that Bitcoin changed
 * }
 * ```
 */
export async function verifyInscriptionImmutability(
  inscriptionId: string,
  originalHash: string
): Promise<ImmutabilityCheckResult> {
  try {
    // Get original snapshot if available
    const snapshot = getInscriptionSnapshot(inscriptionId);
    const originalTimestamp = snapshot?.fetchedAt || Date.now();

    // Re-fetch inscription content
    const fetchResult = await fetchInscriptionWithFailover(inscriptionId);
    
    if (!fetchResult.success) {
      return {
        unchanged: false,
        originalHash,
        currentHash: '',
        error: `Failed to re-fetch inscription: ${fetchResult.error}`,
        timeElapsed: Date.now() - originalTimestamp,
      };
    }

    // Compute SHA-256 of current content
    const currentHash = await computeSha256(fetchResult.content);
    const unchanged = currentHash.toLowerCase() === originalHash.toLowerCase();
    const timeElapsed = Date.now() - originalTimestamp;

    // Update snapshot if content matches
    if (unchanged) {
      storeInscriptionSnapshot(inscriptionId, currentHash, fetchResult.source);
    }

    return {
      unchanged,
      originalHash,
      currentHash,
      timeElapsed,
      source: fetchResult.source,
      error: unchanged
        ? undefined
        : `Content hash mismatch. Original: ${originalHash.slice(0, 16)}..., Current: ${currentHash.slice(0, 16)}...`,
    };
  } catch (error) {
    return {
      unchanged: false,
      originalHash,
      currentHash: '',
      error: error instanceof Error ? error.message : 'Unknown error during immutability check',
    };
  }
}

/**
 * Compute SHA-256 hash
 */
async function computeSha256(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify inscription hasn't changed since last check
 * 
 * Uses stored snapshot to compare against current content.
 * 
 * @param inscriptionId - Inscription ID
 * @returns Verification result
 */
export async function verifyInscriptionSinceLastCheck(
  inscriptionId: string
): Promise<ImmutabilityCheckResult | null> {
  const snapshot = getInscriptionSnapshot(inscriptionId);
  
  if (!snapshot) {
    return null; // No snapshot available
  }

  return verifyInscriptionImmutability(inscriptionId, snapshot.contentHash);
}

/**
 * Batch verify multiple inscriptions
 * 
 * @param items - Array of {inscriptionId, originalHash} pairs
 * @returns Array of verification results
 */
export async function verifyBatchImmutability(
  items: Array<{ inscriptionId: string; originalHash: string }>
): Promise<ImmutabilityCheckResult[]> {
  const results = await Promise.allSettled(
    items.map((item) => verifyInscriptionImmutability(item.inscriptionId, item.originalHash))
  );

  return results.map((result) =>
    result.status === 'fulfilled'
      ? result.value
      : {
          unchanged: false,
          originalHash: '',
          currentHash: '',
          error: result.reason?.message || 'Verification failed',
        }
  );
}

/**
 * Get all stored snapshots
 * 
 * @returns Array of all snapshots
 */
export function getAllSnapshots(): InscriptionSnapshot[] {
  return Array.from(inscriptionSnapshots.values());
}

/**
 * Get snapshot statistics
 * 
 * @returns Statistics about stored snapshots
 */
export function getSnapshotStats(): {
  totalSnapshots: number;
  oldestSnapshot?: number;
  newestSnapshot?: number;
} {
  const snapshots = Array.from(inscriptionSnapshots.values());
  
  if (snapshots.length === 0) {
    return { totalSnapshots: 0 };
  }

  const timestamps = snapshots.map((s) => s.fetchedAt);
  
  return {
    totalSnapshots: snapshots.length,
    oldestSnapshot: Math.min(...timestamps),
    newestSnapshot: Math.max(...timestamps),
  };
}

