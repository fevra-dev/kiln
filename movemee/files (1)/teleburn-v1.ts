/**
 * KILN Teleburn Protocol v1.0
 * Minimal memo format for Solana → Bitcoin Ordinals teleburns
 * 
 * Spec: https://github.com/fevra-dev/kiln/blob/main/docs/TELEBURN_SPEC_v1.0.md
 */

const PREFIX = 'teleburn:';
const INSCRIPTION_REGEX = /^[a-f0-9]{64}i[0-9]+$/;

/**
 * Validates an inscription ID format
 * @param inscriptionId - Bitcoin inscription ID (e.g., "abc123...i0")
 * @returns true if valid
 */
export function isValidInscriptionId(inscriptionId: string): boolean {
  return INSCRIPTION_REGEX.test(inscriptionId);
}

/**
 * Builds a teleburn memo
 * @param inscriptionId - Bitcoin inscription ID
 * @returns Formatted memo string (e.g., "teleburn:abc123...i0")
 * @throws Error if inscription ID is invalid
 */
export function buildTeleburnMemo(inscriptionId: string): string {
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }
  return `${PREFIX}${inscriptionId}`;
}

/**
 * Parses a teleburn memo
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
 * Checks if a memo is a valid teleburn memo
 * @param memo - Memo string to check
 * @returns true if valid teleburn memo
 */
export function isTeleburnMemo(memo: string): boolean {
  try {
    parseTeleburnMemo(memo);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses an inscription ID into its components
 * @param inscriptionId - Bitcoin inscription ID
 * @returns { txid, index }
 * @throws Error if format is invalid
 */
export function parseInscriptionId(inscriptionId: string): { txid: string; index: number } {
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }
  
  const iIndex = inscriptionId.lastIndexOf('i');
  const txid = inscriptionId.slice(0, iIndex);
  const index = parseInt(inscriptionId.slice(iIndex + 1), 10);
  
  return { txid, index };
}

// ============================================================================
// Legacy Support (v0.1.x JSON format + kiln: prefix)
// ============================================================================

const LEGACY_PREFIX = 'kiln:';

interface LegacyMemo {
  standard?: string;
  version?: string;
  inscription?: { id: string } | string;
  [key: string]: unknown;
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
    const parsed: LegacyMemo = JSON.parse(memo);
    
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
export function parseAnyTeleburnMemo(memo: string): { 
  inscriptionId: string; 
  format: 'v1' | 'legacy-prefix' | 'legacy-json' 
} {
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

// ============================================================================
// Verification Helpers
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
// Indexing Helpers
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
