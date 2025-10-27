/**
 * Solana Timestamp Service
 * 
 * @description Provides temporal anchoring for KILN.1 memos by fetching
 * current slot/block height and estimated timestamp from Solana blockchain.
 * 
 * @version 0.1.1
 */

import { Connection, Commitment } from '@solana/web3.js';
import type { SolanaTimestamp } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Primary Solana RPC endpoint */
const PRIMARY_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

/** Fallback RPC endpoints (used if primary fails) */
const FALLBACK_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-api.projectserum.com',
];

/** RPC request timeout (30 seconds) */
const RPC_TIMEOUT_MS = 30000;

/** Clock drift tolerance for validation (5 minutes) */
const CLOCK_DRIFT_TOLERANCE_SEC = 300;

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

/**
 * Service for fetching Solana blockchain timestamps
 * 
 * Provides both slot numbers (deterministic, consensus-based) and
 * estimated timestamps (derived from block time).
 * 
 * @example
 * ```typescript
 * const service = new SolanaTimestampService();
 * const timestamp = await service.getCurrentTimestamp();
 * console.log('Slot:', timestamp.slot);
 * console.log('Time:', new Date(timestamp.timestamp * 1000));
 * ```
 */
export class SolanaTimestampService {
  private connection: Connection;
  private fallbackConnections: Connection[];

  /**
   * Create new timestamp service
   * 
   * @param rpcUrl - Optional custom RPC endpoint
   * @param commitment - Commitment level (default: 'finalized')
   */
  constructor(
    rpcUrl?: string,
    private commitment: Commitment = 'finalized'
  ) {
    this.connection = new Connection(
      rpcUrl || PRIMARY_RPC,
      {
        commitment: this.commitment,
        confirmTransactionInitialTimeout: RPC_TIMEOUT_MS
      }
    );

    // Initialize fallback connections
    this.fallbackConnections = FALLBACK_RPCS.map(
      url => new Connection(url, { commitment: this.commitment })
    );
  }

  /**
   * Get current Solana timestamp (slot + estimated time)
   * 
   * This method:
   * 1. Fetches current slot from blockchain
   * 2. Gets estimated timestamp from block time
   * 3. Validates timestamp is reasonable
   * 4. Falls back to secondary RPCs if primary fails
   * 
   * @returns Current Solana timestamp info
   * @throws Error if all RPCs fail or timestamp is invalid
   */
  async getCurrentTimestamp(): Promise<SolanaTimestamp> {
    // Try primary RPC first
    try {
      return await this.fetchTimestamp(this.connection);
    } catch (primaryError) {
      console.warn('Primary RPC failed for timestamp:', primaryError);

      // Try fallback RPCs
      for (let i = 0; i < this.fallbackConnections.length; i++) {
        try {
          const result = await this.fetchTimestamp(this.fallbackConnections[i]!);
          console.warn(`Used fallback RPC ${i + 1} for timestamp`);
          return result;
        } catch (fallbackError) {
          console.warn(`Fallback RPC ${i + 1} failed:`, fallbackError);
          continue;
        }
      }

      // All RPCs failed
      throw new Error(
        'Failed to fetch timestamp from all RPC endpoints. ' +
        'Solana RPC may be unavailable or experiencing issues.'
      );
    }
  }

  /**
   * Get timestamp at specific slot (historical query)
   * 
   * @param slot - Slot number to query
   * @returns Timestamp info for that slot
   * @throws Error if slot not found or RPC fails
   */
  async getTimestampAtSlot(slot: number): Promise<SolanaTimestamp> {
    try {
      const blockTime = await this.connection.getBlockTime(slot);
      
      if (blockTime === null) {
        throw new Error(`Block time not available for slot ${slot}`);
      }

      return {
        slot,
        timestamp: blockTime,
        finalized: true // Historical slots are always finalized
      };

    } catch (error) {
      throw new Error(
        `Failed to fetch timestamp for slot ${slot}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Validate that a timestamp is within acceptable range
   * 
   * Checks if timestamp is within ±5 minutes of current time.
   * This detects clock drift issues.
   * 
   * @param timestamp - Unix epoch timestamp (seconds)
   * @returns true if timestamp is valid
   */
  validateTimestamp(timestamp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.abs(now - timestamp);
    return diff <= CLOCK_DRIFT_TOLERANCE_SEC;
  }

  /**
   * Estimate timestamp from slot using average slot time
   * 
   * Fallback method if block time is unavailable.
   * Uses ~400ms average slot time.
   * 
   * @param slot - Slot number
   * @param genesisTimestamp - Optional genesis timestamp for accuracy
   * @returns Estimated Unix timestamp
   */
  estimateTimestampFromSlot(
    slot: number,
    genesisTimestamp = 1609459200 // Mainnet genesis: 2021-01-01
  ): number {
    // Average Solana slot time is ~400ms
    const SLOT_TIME_MS = 400;
    const slotTimeSeconds = (slot * SLOT_TIME_MS) / 1000;
    return Math.floor(genesisTimestamp + slotTimeSeconds);
  }

  /**
   * Get multiple timestamps in parallel (batch query)
   * 
   * @param slots - Array of slot numbers
   * @returns Array of timestamp results
   */
  async getTimestampsBatch(slots: number[]): Promise<(SolanaTimestamp | null)[]> {
    const promises = slots.map(async (slot) => {
      try {
        return await this.getTimestampAtSlot(slot);
      } catch {
        return null;
      }
    });

    return Promise.all(promises);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Fetch timestamp from specific connection
   * 
   * @param connection - Solana connection to use
   * @returns Timestamp info
   * @throws Error if fetch fails or validation fails
   */
  private async fetchTimestamp(connection: Connection): Promise<SolanaTimestamp> {
    // Fetch current slot
    const slot = await connection.getSlot(this.commitment);

    // Fetch block time for this slot
    let timestamp: number;
    let finalized = false;

    try {
      // Try to get actual block time
      const blockTime = await connection.getBlockTime(slot);
      
      if (blockTime !== null) {
        timestamp = blockTime;
        finalized = this.commitment === 'finalized';
      } else {
        // Block time not available yet - estimate it
        timestamp = this.estimateTimestampFromSlot(slot);
        finalized = false;
      }

    } catch {
      // Fallback to estimation if getBlockTime fails
      timestamp = this.estimateTimestampFromSlot(slot);
      finalized = false;
    }

    // Validate timestamp is reasonable
    if (!this.validateTimestamp(timestamp)) {
      throw new Error(
        `Invalid timestamp ${timestamp}: differs from current time by more than ` +
        `${CLOCK_DRIFT_TOLERANCE_SEC} seconds. Possible clock drift or RPC issue.`
      );
    }

    return {
      slot,
      timestamp,
      finalized
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current Solana timestamp (convenience function)
 * 
 * Creates a new service instance and fetches timestamp.
 * For repeated calls, create a service instance and reuse it.
 * 
 * @param rpcUrl - Optional custom RPC endpoint
 * @returns Current timestamp info
 */
export async function getCurrentTimestamp(rpcUrl?: string): Promise<SolanaTimestamp> {
  const service = new SolanaTimestampService(rpcUrl);
  return service.getCurrentTimestamp();
}

/**
 * Format timestamp for display
 * 
 * @param timestamp - SolanaTimestamp to format
 * @returns Human-readable string
 */
export function formatTimestamp(timestamp: SolanaTimestamp): string {
  const date = new Date(timestamp.timestamp * 1000);
  const iso = date.toISOString();
  const finalized = timestamp.finalized ? '✓' : '⏳';
  
  return `Slot ${timestamp.slot} ${finalized} (${iso})`;
}

/**
 * Calculate time difference between two timestamps
 * 
 * @param timestamp1 - First timestamp (seconds)
 * @param timestamp2 - Second timestamp (seconds)
 * @returns Difference in seconds (positive if timestamp2 is later)
 */
export function getTimestampDiff(timestamp1: number, timestamp2: number): number {
  return timestamp2 - timestamp1;
}

/**
 * Check if timestamp is finalized (reasonable wait time passed)
 * 
 * A slot is considered finalized after ~32 confirmations (~13 seconds).
 * This checks if enough time has passed.
 * 
 * @param slot - Slot number to check
 * @param currentSlot - Current slot number
 * @returns true if slot should be finalized
 */
export function isSlotFinalized(slot: number, currentSlot: number): boolean {
  const FINALIZATION_SLOTS = 32;
  return currentSlot >= slot + FINALIZATION_SLOTS;
}

/**
 * Parse ISO 8601 date string to Unix timestamp
 * 
 * @param isoString - ISO date string
 * @returns Unix timestamp in seconds
 */
export function parseIsoToTimestamp(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

/**
 * Format Unix timestamp to ISO 8601 string
 * 
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO 8601 formatted string
 */
export function formatTimestampToIso(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Get slot duration in milliseconds (average)
 * 
 * @returns Average slot duration (400ms)
 */
export function getAverageSlotDuration(): number {
  return 400;
}

/**
 * Estimate slot from timestamp (reverse calculation)
 * 
 * @param timestamp - Unix timestamp in seconds
 * @param genesisTimestamp - Genesis timestamp (default: mainnet genesis)
 * @returns Estimated slot number
 */
export function estimateSlotFromTimestamp(
  timestamp: number,
  genesisTimestamp = 1609459200
): number {
  const elapsedSeconds = timestamp - genesisTimestamp;
  const elapsedMs = elapsedSeconds * 1000;
  const SLOT_TIME_MS = 400;
  return Math.floor(elapsedMs / SLOT_TIME_MS);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SolanaTimestampService;

