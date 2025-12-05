/**
 * KILN Teleburn Protocol v1.0
 * Minimal memo format for Solana → Bitcoin Ordinals teleburns
 * 
 * Spec: https://github.com/fevra-dev/kiln/blob/main/docs/TELEBURN_SPEC_v1.0.md
 * 
 * @description Implements the simplified teleburn protocol with minimal memo format.
 * Removed: SHA256 verification, derived addresses, JSON memo format
 * Added: Simple teleburn: prefix format, legacy support
 */

import { PublicKey, Transaction, TransactionInstruction, Connection } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  createCloseAccountInstruction,
  createBurnInstruction
} from '@solana/spl-token';

// ============================================================================
// CONSTANTS
// ============================================================================

/** SPL Memo program for on-chain breadcrumbs */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/** Canonical Solana incinerator address (provably unspendable) */
export const INCINERATOR = new PublicKey('1nc1nerator11111111111111111111111111111111');

/** v1.0 memo prefix */
const PREFIX = 'teleburn:';

/** Legacy prefix (for backwards compatibility) */
const LEGACY_PREFIX = 'kiln:';

/** Inscription ID regex: 64 hex chars + 'i' + numeric index */
const INSCRIPTION_REGEX = /^[a-f0-9]{64}i[0-9]+$/;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed inscription ID components
 */
export interface ParsedInscriptionId {
  /** Bitcoin transaction ID (hex string) */
  txid: string;
  /** Inscription index within the transaction */
  index: number;
}

/**
 * Legacy JSON memo format (v0.1.x)
 */
interface LegacyJsonMemo {
  standard?: string;
  version?: string;
  inscription?: { id: string } | string;
  [key: string]: unknown;
}

/**
 * Memo parsing result
 */
export interface MemoParseResult {
  /** Extracted inscription ID */
  inscriptionId: string;
  /** Format detected */
  format: 'v1' | 'legacy-prefix' | 'legacy-json';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates an inscription ID format
 * @param inscriptionId - Bitcoin inscription ID (e.g., "abc123...i0")
 * @returns true if valid format
 */
export function isValidInscriptionId(inscriptionId: string): boolean {
  return INSCRIPTION_REGEX.test(inscriptionId);
}

/**
 * Parses an inscription ID into its components
 * @param inscriptionId - Bitcoin inscription ID
 * @returns { txid, index }
 * @throws Error if format is invalid
 */
export function parseInscriptionId(inscriptionId: string): ParsedInscriptionId {
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }
  
  const iIndex = inscriptionId.lastIndexOf('i');
  const txid = inscriptionId.slice(0, iIndex);
  const index = parseInt(inscriptionId.slice(iIndex + 1), 10);
  
  return { txid, index };
}

// ============================================================================
// MEMO BUILDING (v1.0)
// ============================================================================

/**
 * Builds a teleburn memo (v1.0 format)
 * @param inscriptionId - Bitcoin inscription ID (e.g., "abc123...i0")
 * @returns Formatted memo string (e.g., "teleburn:abc123...i0")
 * @throws Error if inscription ID is invalid
 */
export function buildTeleburnMemo(inscriptionId: string): string {
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }
  return `${PREFIX}${inscriptionId}`;
}

// ============================================================================
// MEMO PARSING (v1.0 + Legacy Support)
// ============================================================================

/**
 * Parses a teleburn memo (v1.0 format)
 * @param memo - Memo string from transaction
 * @returns Inscription ID
 * @throws Error if memo format is invalid
 */
export function parseTeleburnMemo(memo: string): string {
  if (!memo.startsWith(PREFIX)) {
    throw new Error('Not a teleburn memo');
  }
  
  const inscriptionId = memo.slice(PREFIX.length);
  
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID in memo: ${inscriptionId}`);
  }
  
  return inscriptionId;
}

/**
 * Parses legacy kiln: prefix memo format
 * @param memo - Memo string
 * @returns Inscription ID or null if not a legacy memo
 */
export function parseLegacyPrefixMemo(memo: string): string | null {
  if (!memo.startsWith(LEGACY_PREFIX)) {
    return null;
  }
  
  const inscriptionId = memo.slice(LEGACY_PREFIX.length);
  
  if (!isValidInscriptionId(inscriptionId)) {
    return null;
  }
  
  return inscriptionId;
}

/**
 * Parses legacy JSON memo format (v0.1.x)
 * @param memo - JSON memo string
 * @returns Inscription ID or null if not a legacy memo
 */
export function parseLegacyJsonMemo(memo: string): string | null {
  try {
    const parsed: LegacyJsonMemo = JSON.parse(memo);
    
    // Check for KILN standard
    if (parsed.standard?.toLowerCase() !== 'kiln') {
      return null;
    }
    
    // Extract inscription ID
    const inscriptionId = typeof parsed.inscription === 'string' 
      ? parsed.inscription 
      : parsed.inscription?.id;
    
    if (!inscriptionId || !isValidInscriptionId(inscriptionId)) {
      return null;
    }
    
    return inscriptionId;
  } catch {
    return null;
  }
}

/**
 * Parses any supported memo format (v1.0 or legacy)
 * @param memo - Memo string (teleburn:, kiln:, or JSON format)
 * @returns { inscriptionId, format }
 * @throws Error if not a valid teleburn memo
 */
export function parseAnyTeleburnMemo(memo: string): MemoParseResult {
  // Try v1.0 format first (teleburn:)
  if (memo.startsWith(PREFIX)) {
    return { 
      inscriptionId: parseTeleburnMemo(memo), 
      format: 'v1' 
    };
  }
  
  // Try legacy kiln: prefix
  const legacyPrefixId = parseLegacyPrefixMemo(memo);
  if (legacyPrefixId) {
    return { 
      inscriptionId: legacyPrefixId, 
      format: 'legacy-prefix' 
    };
  }
  
  // Try legacy JSON format
  const legacyJsonId = parseLegacyJsonMemo(memo);
  if (legacyJsonId) {
    return { 
      inscriptionId: legacyJsonId, 
      format: 'legacy-json' 
    };
  }
  
  throw new Error('Not a valid teleburn memo');
}

/**
 * Checks if a memo is a valid teleburn memo
 * @param memo - Memo string to check
 * @returns true if valid teleburn memo
 */
export function isTeleburnMemo(memo: string): boolean {
  try {
    parseAnyTeleburnMemo(memo);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// VERIFICATION HELPERS
// ============================================================================

export interface TeleburnVerification {
  valid: boolean;
  inscriptionId: string | null;
  format: 'v1' | 'legacy-prefix' | 'legacy-json' | null;
  error: string | null;
}

/**
 * Verifies a memo and extracts teleburn data
 * @param memo - Memo string from burn transaction
 * @returns Verification result
 */
export function verifyMemo(memo: string): TeleburnVerification {
  try {
    const { inscriptionId, format } = parseAnyTeleburnMemo(memo);
    return {
      valid: true,
      inscriptionId,
      format,
      error: null
    };
  } catch (e) {
    return {
      valid: false,
      inscriptionId: null,
      format: null,
      error: e instanceof Error ? e.message : 'Unknown error'
    };
  }
}

// ============================================================================
// INDEXING HELPERS
// ============================================================================

/**
 * Regex for finding v1.0 teleburn memos
 */
export const TELEBURN_MEMO_PATTERN = /^teleburn:[a-f0-9]{64}i[0-9]+$/;

/**
 * Regex for finding any teleburn memos (v1.0 or legacy kiln:)
 */
export const ANY_TELEBURN_PATTERN = /^(teleburn:|kiln:)[a-f0-9]{64}i[0-9]+$/;

/**
 * SQL-safe pattern for LIKE queries (v1.0 format)
 * Usage: WHERE memo LIKE 'teleburn:%'
 */
export const TELEBURN_SQL_PATTERN = 'teleburn:%';

/**
 * SQL-safe patterns for finding all teleburns including legacy
 * Usage: WHERE memo LIKE 'teleburn:%' OR memo LIKE 'kiln:%' OR memo LIKE '%"standard":"Kiln"%'
 */
export const ALL_TELEBURN_SQL_PATTERNS = [
  'teleburn:%',           // v1.0
  'kiln:%',               // legacy prefix
  '%"standard":"Kiln"%'   // legacy JSON
];

// ============================================================================
// TOKEN PROGRAM DETECTION
// ============================================================================

/**
 * Detect token program (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
 * 
 * @param connection - Solana connection
 * @param mint - Mint public key
 * @returns Token program ID
 */
export async function getTokenProgramId(
  connection: Connection, 
  mint: PublicKey
): Promise<PublicKey> {
  try {
    const accountInfo = await connection.getAccountInfo(mint);
    if (!accountInfo) {
      throw new Error('Mint account not found');
    }
    
    // Check owner
    if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return TOKEN_2022_PROGRAM_ID;
    }
    
    return TOKEN_PROGRAM_ID;
  } catch (error) {
    // Default to TOKEN_PROGRAM_ID on error
    console.warn('Failed to detect token program, defaulting to TOKEN_PROGRAM_ID:', error);
    return TOKEN_PROGRAM_ID;
  }
}

// ============================================================================
// MEMO INSTRUCTIONS
// ============================================================================

/**
 * Create SPL Memo instruction with string payload (v1.0 format)
 * 
 * @param memo - Memo string (e.g., "teleburn:abc123...i0")
 * @returns Memo instruction
 */
export function createMemoInstruction(memo: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(memo, 'utf-8')
  });
}

// ============================================================================
// TRANSACTION BUILDERS
// ============================================================================

/**
 * Build transaction to burn SPL token (reduce supply)
 * 
 * This permanently destroys the token by reducing total supply.
 * 
 * @param connection - Solana connection
 * @param payer - Transaction signer and fee payer
 * @param mint - Mint to burn from
 * @param inscriptionId - Bitcoin inscription ID for memo
 * @returns Unsigned transaction
 */
export async function buildBurnTx(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  inscriptionId: string
): Promise<Transaction> {
  // Validate inscription ID
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }

  // Detect token program (TOKEN or TOKEN_2022)
  const tokenProgram = await getTokenProgramId(connection, mint);
  
  // Get owner's ATA
  const fromAta = await getAssociatedTokenAddress(mint, payer, false, tokenProgram);
  
  // Build memo (v1.0 format)
  const memo = buildTeleburnMemo(inscriptionId);
  
  // Build instructions
  const ixs = [
    createMemoInstruction(memo),
    createBurnInstruction(fromAta, mint, payer, 1, [], tokenProgram),
    createCloseAccountInstruction(fromAta, payer, payer, [], tokenProgram)
  ];
  
  // Build transaction
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  return tx;
}

/**
 * Build transaction to incinerate SPL token (send to dead address)
 * 
 * Transfers token to canonical incinerator address (no known private key).
 * 
 * @param connection - Solana connection
 * @param payer - Transaction signer and fee payer
 * @param mint - Mint to incinerate
 * @param inscriptionId - Bitcoin inscription ID for memo
 * @returns Unsigned transaction
 */
export async function buildIncinerateTx(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  inscriptionId: string
): Promise<Transaction> {
  // Validate inscription ID
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }

  // Detect token program
  const tokenProgram = await getTokenProgramId(connection, mint);
  
  // Get ATAs
  const fromAta = await getAssociatedTokenAddress(mint, payer, false, tokenProgram);
  const toAta = await getAssociatedTokenAddress(mint, INCINERATOR, true, tokenProgram);
  
  // Build memo (v1.0 format)
  const memo = buildTeleburnMemo(inscriptionId);
  
  // Build instructions
  const ixs = [
    createMemoInstruction(memo),
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      toAta,
      INCINERATOR,
      mint,
      tokenProgram
    ),
    createTransferInstruction(fromAta, toAta, payer, 1, [], tokenProgram),
    createCloseAccountInstruction(fromAta, payer, payer, [], tokenProgram)
  ];
  
  // Build transaction
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  return tx;
}
