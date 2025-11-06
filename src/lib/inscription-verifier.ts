/**
 * Inscription Content Verification Service
 * 
 * @description CRITICAL SAFETY GATE - Verifies Bitcoin Ordinals inscription
 * content matches expected SHA-256 hash before allowing seal operation.
 * This prevents sealing to wrong/corrupted inscriptions.
 * 
 * @version 0.1.1
 */

import { InscriptionVerificationResult } from './types';
import { isValidInscriptionId, isValidSha256 } from './schemas';
import { fetchInscriptionWithFailover, getCachedSha256 } from './inscription-resilience';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Ordinals API base URL */
const ORDINALS_API_BASE = process.env['ORDINALS_API_URL'] || 'https://ordinals.com';

/** Timeout for inscription content fetch (30 seconds) */
const FETCH_TIMEOUT_MS = 30000;

/** Maximum content size to fetch (100MB - safety limit) */
const MAX_CONTENT_SIZE = 100 * 1024 * 1024;

// ============================================================================
// MAIN VERIFIER CLASS
// ============================================================================

/**
 * Service for verifying Bitcoin Ordinals inscription content
 * 
 * @example
 * ```typescript
 * const result = await InscriptionVerifier.verify('abc...i0', 'a1b2c3...');
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 * ```
 */
export class InscriptionVerifier {
  /**
   * Fetch inscription content and compute its SHA-256 hash
   * 
   * Used for auto-filling the hash field when user enters inscription ID.
   * 
   * @param inscriptionId - Inscription ID format: <txid>i<index>
   * @returns Object with success status, hash, content type, and size
   */
  static async fetchAndHash(
    inscriptionId: string
  ): Promise<{
    success: boolean;
    actualSha256?: string;
    contentType?: string;
    byteLength?: number;
    error?: string;
  }> {
    try {
      // Validate inscription ID format
      if (!isValidInscriptionId(inscriptionId)) {
        return {
          success: false,
          error: 'Invalid inscription ID format'
        };
      }

      // Check cache first
      const cachedHash = getCachedSha256(inscriptionId);
      if (cachedHash) {
        // Fetch content to get metadata (type, size)
        const fetchResult = await this.fetchInscriptionContent(inscriptionId);
        if (fetchResult.success) {
          return {
            success: true,
            actualSha256: cachedHash,
            contentType: fetchResult.contentType,
            byteLength: fetchResult.content.byteLength,
          };
        }
      }

      // Fetch inscription content with failover
      const fetchResult = await fetchInscriptionWithFailover(inscriptionId);
      if (!fetchResult.success) {
        return {
          success: false,
          error: fetchResult.error,
        };
      }

      // Compute SHA-256
      const hash = await this.computeSha256(fetchResult.content);

      return {
        success: true,
        actualSha256: hash,
        contentType: fetchResult.contentType,
        byteLength: fetchResult.content.byteLength
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify inscription exists and content matches expected SHA-256 hash
   * 
   * This is a HARD GATE - sealing MUST NOT proceed if this fails.
   * 
   * @param inscriptionId - Inscription ID format: <txid>i<index>
   * @param expectedSha256 - Expected SHA-256 hash (hex string)
   * @returns Verification result with detailed information
   * 
   * @throws Never throws - always returns result object with error field
   */
  static async verify(
    inscriptionId: string,
    expectedSha256: string
  ): Promise<InscriptionVerificationResult> {
    try {
      // Step 1: Validate input formats
      const formatValidation = this.validateFormats(inscriptionId, expectedSha256);
      if (!formatValidation.valid) {
        return formatValidation;
      }

      // Step 2: Fetch inscription content with failover and caching
      const fetchResult = await fetchInscriptionWithFailover(inscriptionId);
      if (!fetchResult.success) {
        return {
          valid: false,
          inscriptionId,
          fetchedHash: '',
          expectedHash: expectedSha256,
          error: fetchResult.error,
        };
      }

      // Step 3: Compute SHA-256 of fetched content
      const fetchedHash = await this.computeSha256(fetchResult.content);

      // Step 4: Compare hashes (case-insensitive)
      const valid = fetchedHash.toLowerCase() === expectedSha256.toLowerCase();

      return {
        valid,
        inscriptionId,
        fetchedHash,
        expectedHash: expectedSha256,
        contentType: fetchResult.contentType,
        byteLength: fetchResult.content.byteLength,
        error: valid ? undefined : 'SHA-256 hash mismatch - content does not match expected hash'
      };

    } catch (error) {
      // Catch-all for unexpected errors (network issues, etc.)
      return {
        valid: false,
        inscriptionId,
        fetchedHash: '',
        expectedHash: expectedSha256,
        error: error instanceof Error ? error.message : 'Unknown verification error'
      };
    }
  }

  /**
   * Validate inscription ID and SHA-256 formats before fetching
   * 
   * @param inscriptionId - Inscription ID to validate
   * @param expectedSha256 - SHA-256 hash to validate
   * @returns Partial verification result or success indicator
   */
  private static validateFormats(
    inscriptionId: string,
    expectedSha256: string
  ): InscriptionVerificationResult | { valid: true } {
    // Validate inscription ID format
    if (!isValidInscriptionId(inscriptionId)) {
      return {
        valid: false,
        inscriptionId,
        fetchedHash: '',
        expectedHash: expectedSha256,
        error: 'Invalid inscription ID format. Expected: <64-char-hex-txid>i<index>'
      };
    }

    // Validate SHA-256 format
    if (!isValidSha256(expectedSha256)) {
      return {
        valid: false,
        inscriptionId,
        fetchedHash: '',
        expectedHash: expectedSha256,
        error: 'Invalid SHA-256 format. Expected: 64-character hex string'
      };
    }

    return { valid: true };
  }

  /**
   * Fetch inscription content from ordinals.com
   * 
   * @deprecated Use fetchInscriptionWithFailover from inscription-resilience instead
   * Kept for backward compatibility
   * 
   * @param inscriptionId - Inscription ID to fetch
   * @returns Fetch result with content or error
   */
  private static async fetchInscriptionContent(
    inscriptionId: string
  ): Promise<
    | { success: true; content: ArrayBuffer; contentType: string }
    | { success: false; error: string }
  > {
    // Use resilient fetch with failover and caching
    const result = await fetchInscriptionWithFailover(inscriptionId);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      content: result.content,
      contentType: result.contentType,
    };
  }

  /**
   * Compute SHA-256 hash of content using Web Crypto API
   * 
   * @param content - Content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private static async computeSha256(content: ArrayBuffer): Promise<string> {
    // Use Web Crypto API for SHA-256 (available in browser and Node.js 15+)
    const hashBuffer = await crypto.subtle.digest('SHA-256', content);
    
    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    
    return hexHash;
  }

  /**
   * Fetch inscription metadata from ordinals.com (optional)
   * 
   * This provides additional information but is not required for verification.
   * 
   * @param inscriptionId - Inscription ID to fetch metadata for
   * @returns Metadata object or null if unavailable
   */
  static async fetchMetadata(inscriptionId: string): Promise<unknown | null> {
    try {
      const url = `${ORDINALS_API_BASE}/inscription/${inscriptionId}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'KILN.1-Verifier/0.1.1'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        return await response.json();
      }

      return null;

    } catch (error) {
      // Metadata fetch is optional, don't throw
      console.warn('Failed to fetch inscription metadata:', error);
      return null;
    }
  }

  /**
   * Get direct content URL for inscription (for iframe/preview)
   * 
   * @param inscriptionId - Inscription ID
   * @returns Full URL to inscription content
   */
  static getContentUrl(inscriptionId: string): string {
    return `${ORDINALS_API_BASE}/content/${inscriptionId}`;
  }

  /**
   * Get inscription explorer URL (for user to view on ordinals.com)
   * 
   * @param inscriptionId - Inscription ID
   * @returns Full URL to inscription page
   */
  static getExplorerUrl(inscriptionId: string): string {
    return `${ORDINALS_API_BASE}/inscription/${inscriptionId}`;
  }

  /**
   * Batch verify multiple inscriptions (parallel execution)
   * 
   * @param items - Array of {inscriptionId, expectedSha256} pairs
   * @param maxConcurrent - Maximum parallel verifications (default: 3)
   * @returns Array of verification results
   */
  static async verifyBatch(
    items: Array<{ inscriptionId: string; expectedSha256: string }>,
    maxConcurrent = 3
  ): Promise<InscriptionVerificationResult[]> {
    const results: InscriptionVerificationResult[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      // Wait if we've hit the concurrency limit
      while (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }

      // Start verification
      const promise = this.verify(item.inscriptionId, item.expectedSha256)
        .then(result => {
          results.push(result);
          // Remove from executing when done
          const index = executing.indexOf(promise);
          if (index !== -1) executing.splice(index, 1);
        });

      executing.push(promise);
    }

    // Wait for all remaining verifications
    await Promise.all(executing);

    return results;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if ordinals.com API is reachable
 * 
 * @returns true if API is responding
 */
export async function checkOrdinalsApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ORDINALS_API_BASE}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Format byte size for human-readable display
 * 
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatByteSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Get MIME type category for display
 * 
 * @param contentType - MIME type string
 * @returns Category: 'image' | 'video' | 'audio' | 'text' | 'other'
 */
export function getContentCategory(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('text/')) return 'text';
  return 'other';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default InscriptionVerifier;

