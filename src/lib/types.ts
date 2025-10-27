/**
 * Core TypeScript types for KILN.1 Teleburn Standard
 * 
 * @description Type definitions for Solana → Bitcoin Ordinals teleburn protocol
 * @version 0.1.1
 */

import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** KILN standard version */
export const STANDARD_VERSION = '0.1.1' as const;

/** Standard identifier */
export const STANDARD = 'KILN' as const;

/** Domain separation string for derived owner algorithm */
export const DOMAIN = 'ordinals.teleburn.sbt01.v1' as const;

/** Solana incinerator address (no private key exists) */
export const INCINERATOR_ADDRESS = '1nc1nerator11111111111111111111111111111111' as const;

// ============================================================================
// ENUMS AND UNION TYPES
// ============================================================================

/** Teleburn method for retiring Solana tokens */
export type TeleburnMethod = 'burn' | 'incinerate' | 'teleburn-derived';

/** Memo action type */
export type MemoAction = 'seal' | TeleburnMethod;

/** Blockchain network identifier */
export type ChainNetwork = 'solana-mainnet' | 'solana-devnet' | 'bitcoin-mainnet' | 'bitcoin-testnet';

/** Verification confidence level */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Teleburn status */
export type TeleburnStatus = 'burned' | 'incinerated' | 'derived-teleburned' | 'active' | 'unknown';

// ============================================================================
// MEMO PAYLOAD TYPES (On-chain JSON in SPL Memo)
// ============================================================================

/**
 * Seal memo payload - written when inscription is linked to Solana NFT
 * This creates an immutable on-chain record of the teleburn intent
 */
export interface Sbt01Seal {
  /** Standard identifier */
  standard: typeof STANDARD;
  
  /** Standard version */
  version: typeof STANDARD_VERSION;
  
  /** Source blockchain */
  source_chain: ChainNetwork;
  
  /** Target blockchain */
  target_chain: ChainNetwork;
  
  /** Action type */
  action: 'seal';
  
  /** Unix epoch timestamp (seconds) - when seal was created */
  timestamp: number;
  
  /** Solana slot/block height at time of sealing */
  block_height: number;
  
  /** Bitcoin Ordinals inscription reference */
  inscription: {
    /** Inscription ID format: <txid>i<index> */
    id: string;
    /** Bitcoin network */
    network: 'bitcoin-mainnet' | 'bitcoin-testnet';
  };
  
  /** Solana token reference */
  solana: {
    /** Token mint address (Base58) */
    mint: string;
    /** Optional: collection mint if part of a collection */
    collection?: string;
  };
  
  /** Media integrity proof */
  media: {
    /** SHA-256 hash of inscription content (hex) */
    sha256: string;
  };
  
  /** Optional additional data */
  extra?: {
    /** Multi-sig signers if applicable */
    signers?: string[];
    /** User note */
    note?: string;
  };
}

/**
 * Retire memo payload - written when Solana token is permanently destroyed/locked
 * This finalizes the teleburn and proves the token can never be used on Solana again
 */
export interface Sbt01Retire {
  /** Standard identifier */
  standard: typeof STANDARD;
  
  /** Standard version */
  version: typeof STANDARD_VERSION;
  
  /** Retirement action type */
  action: TeleburnMethod;
  
  /** Unix epoch timestamp (seconds) - when retire was executed */
  timestamp: number;
  
  /** Solana slot/block height at time of retirement */
  block_height: number;
  
  /** Bitcoin Ordinals inscription reference (same as seal) */
  inscription: {
    /** Inscription ID format: <txid>i<index> */
    id: string;
  };
  
  /** Solana token reference (same as seal) */
  solana: {
    /** Token mint address (Base58) */
    mint: string;
  };
  
  /** Media integrity proof (same as seal) */
  media: {
    /** SHA-256 hash of inscription content (hex) */
    sha256: string;
  };
  
  /** Derived owner data - REQUIRED for teleburn-derived method */
  derived?: {
    /** Bump seed used to find off-curve point */
    bump: number;
  };
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

/**
 * Decoded Solana instruction for human-readable display
 */
export interface DecodedInstruction {
  /** Program public key */
  programId: string;
  
  /** Human-readable program name */
  programName: string;
  
  /** Accounts involved in instruction */
  accounts: Array<{
    /** Account public key */
    pubkey: string;
    /** Human-readable role description */
    role: string;
    /** Whether account must sign */
    isSigner: boolean;
    /** Whether account is writable */
    isWritable: boolean;
  }>;
  
  /** Instruction data (hex or decoded) */
  data: string | Record<string, unknown>;
  
  /** Human-readable summary */
  summary: string;
}

/**
 * Simulation result from Solana RPC
 */
export interface SimulationResult {
  /** Whether simulation succeeded */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Program logs */
  logs: string[];
  
  /** Compute units consumed */
  unitsConsumed?: number;
  
  /** Accounts that would be modified */
  accounts?: string[];
}

/**
 * Transaction metadata after building
 */
export interface TransactionMetadata {
  /** Recent blockhash used */
  blockhash: string;
  
  /** Last valid block height */
  lastValidBlockHeight: number;
  
  /** Current slot when built */
  slot: number;
  
  /** Current timestamp when built */
  timestamp: number;
  
  /** Estimated fee in lamports */
  estimatedFee: number;
  
  /** Memo byte length (if applicable) */
  memoLength?: number;
}

// ============================================================================
// DRY RUN TYPES
// ============================================================================

/**
 * Individual step in dry run execution
 */
export interface DryRunStep {
  /** Step name for display */
  name: string;
  
  /** Step type */
  type: 'seal' | 'update-uri' | 'retire';
  
  /** Serialized unsigned transaction (Base64) */
  transaction: string;
  
  /** Decoded instructions for transparency */
  decoded: DecodedInstruction[];
  
  /** Simulation result */
  simulation: SimulationResult;
  
  /** Estimated fee in lamports */
  estimatedFee: number;
  
  /** Warnings specific to this step */
  warnings: string[];
}

/**
 * Complete dry run report
 */
export interface DryRunReport {
  /** Always 'dry-run' to identify report type */
  mode: 'dry-run';
  
  /** ISO 8601 timestamp of report creation */
  timestamp: string;
  
  /** Solana mint address */
  mint: string;
  
  /** Bitcoin inscription ID */
  inscriptionId: string;
  
  /** Media SHA-256 hash */
  sha256: string;
  
  /** Chosen retirement method */
  method: TeleburnMethod;
  
  /** All steps that would be executed */
  steps: DryRunStep[];
  
  /** Total estimated fee in lamports */
  totalEstimatedFee: number;
  
  /** Total estimated fee in SOL (for display) */
  totalEstimatedFeeSOL: number;
  
  /** Summary of payloads */
  summary: {
    /** Seal memo that would be written */
    sealPayload: Sbt01Seal;
    /** Retire memo that would be written */
    retirePayload: Sbt01Retire;
    /** Pointer URI if metadata update planned */
    pointerUri?: string;
  };
  
  /** Non-critical warnings */
  warnings: string[];
  
  /** Critical blockers that prevent execution */
  blockers: string[];
}

// ============================================================================
// VERIFICATION TYPES
// ============================================================================

/**
 * Inscription content verification result
 */
export interface InscriptionVerificationResult {
  /** Whether verification passed */
  valid: boolean;
  
  /** Inscription ID that was verified */
  inscriptionId: string;
  
  /** SHA-256 hash of fetched content */
  fetchedHash: string;
  
  /** Expected SHA-256 hash */
  expectedHash: string;
  
  /** Content MIME type */
  contentType?: string;
  
  /** Content size in bytes */
  byteLength?: number;
  
  /** Error message if verification failed */
  error?: string;
}

/**
 * RPC source verification info
 */
export interface VerificationSource {
  /** RPC endpoint URL */
  rpc: string;
  
  /** Status from this RPC */
  status: string;
  
  /** Block height at verification time */
  blockHeight?: number;
  
  /** Timestamp at verification time */
  timestamp?: number;
}

/**
 * Complete teleburn verification result
 */
export interface VerificationResult {
  /** Determined teleburn method/status */
  method: TeleburnStatus;
  
  /** Confidence level in verification */
  confidence: ConfidenceLevel;
  
  /** Solana mint address */
  mint: string;
  
  /** Bitcoin inscription ID (if found) */
  inscriptionId?: string;
  
  /** Media SHA-256 (if found) */
  sha256?: string;
  
  /** RPC sources consulted */
  sources: VerificationSource[];
  
  /** Parsed seal memo (if found on-chain) */
  sealMemo?: Sbt01Seal;
  
  /** Parsed retire memo (if found on-chain) */
  retireMemo?: Sbt01Retire;
  
  /** Seal transaction signature */
  sealTransaction?: string;
  
  /** Retire transaction signature */
  retireTransaction?: string;
  
  /** Current token supply */
  supply?: number;
  
  /** Derived owner ATA balance (if applicable) */
  derivedOwnerBalance?: number;
  
  /** Incinerator ATA balance (if applicable) */
  incineratorBalance?: number;
  
  /** Non-critical warnings */
  warnings: string[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to build seal transaction
 */
export interface SealTransactionRequest {
  /** Fee payer public key (Base58) */
  feePayer: string;
  
  /** Solana mint address */
  mint: string;
  
  /** Bitcoin inscription ID */
  inscriptionId: string;
  
  /** Media SHA-256 hash (hex) */
  sha256: string;
  
  /** Network selection */
  network?: 'mainnet' | 'devnet';
  
  /** Optional multi-sig signers */
  signers?: string[];
}

/**
 * Request to build retire transaction
 */
export interface RetireTransactionRequest {
  /** Fee payer public key (Base58) */
  feePayer: string;
  
  /** Solana mint address */
  mint: string;
  
  /** Bitcoin inscription ID */
  inscriptionId: string;
  
  /** Media SHA-256 hash (hex) */
  sha256: string;
  
  /** Retirement method */
  method: TeleburnMethod;
  
  /** Bump seed (REQUIRED for teleburn-derived) */
  bump?: number;
}

/**
 * Generic transaction build response
 */
export interface TransactionBuildResponse {
  /** Whether build succeeded */
  success: boolean;
  
  /** Serialized unsigned transaction (Base64) */
  transaction?: string;
  
  /** Transaction metadata */
  metadata?: TransactionMetadata;
  
  /** Decoded instructions */
  decoded?: DecodedInstruction[];
  
  /** Simulation result */
  simulation?: SimulationResult;
  
  /** Estimated fee in lamports */
  estimatedFee?: number;
  
  /** Memo payload (for display) */
  payload?: Sbt01Seal | Sbt01Retire;
  
  /** Error message if failed */
  error?: string;
  
  /** Validation error details */
  details?: unknown;
}

// ============================================================================
// DERIVED OWNER TYPES
// ============================================================================

/**
 * Result of derived owner computation
 */
export interface DerivedOwnerResult {
  /** Derived public key (off-curve) */
  publicKey: PublicKey;
  
  /** Bump seed used (for reproducibility) */
  bump: number;
}

// ============================================================================
// TIMESTAMP TYPES
// ============================================================================

/**
 * Solana blockchain timestamp information
 */
export interface SolanaTimestamp {
  /** Current slot number */
  slot: number;
  
  /** Unix epoch timestamp (seconds) */
  timestamp: number;
  
  /** Whether slot is finalized */
  finalized: boolean;
}

// ============================================================================
// TOKEN-2022 TYPES
// ============================================================================

/**
 * Token-2022 extension compatibility result
 */
export interface Token2022CompatibilityResult {
  /** Whether token is compatible with teleburn */
  compatible: boolean;
  
  /** Detected extensions */
  extensions: string[];
  
  /** Non-critical warnings */
  warnings: string[];
  
  /** Critical blockers */
  blockers: string[];
  
  /** Recommendations for user */
  recommendations: string[];
}

// ============================================================================
// BATCH PROCESSING TYPES
// ============================================================================

/**
 * Batch item for processing
 */
export interface BatchItem {
  /** Solana mint address */
  mint: string;
  
  /** Bitcoin inscription ID */
  inscriptionId: string;
  
  /** Media SHA-256 hash */
  sha256: string;
  
  /** Retirement method */
  method: TeleburnMethod;
  
  /** Optional metadata URI */
  pointerUri?: string;
  
  /** Whether to update metadata */
  updateMetadata?: boolean;
}

/**
 * Batch item result
 */
export interface BatchItemResult {
  /** Index in original batch */
  index: number;
  
  /** Whether item succeeded */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Transaction signatures if successful */
  signatures?: {
    seal?: string;
    updateUri?: string;
    retire?: string;
  };
}

/**
 * Complete batch processing result
 */
export interface BatchResult {
  /** Total items processed */
  total: number;
  
  /** Number of successful items */
  successful: number;
  
  /** Number of failed items */
  failed: number;
  
  /** Individual results */
  results: BatchItemResult[];
}

/**
 * Batch progress tracking (for localStorage resume)
 */
export interface BatchProgress {
  /** Total items in batch */
  total: number;
  
  /** Completed item indices */
  completed: number[];
  
  /** Failed item indices */
  failed: number[];
  
  /** Pending item indices */
  pending: number[];
}

