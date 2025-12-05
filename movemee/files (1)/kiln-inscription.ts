/**
 * KILN Inscription Metadata Standard v1.0
 * Bitcoin-side metadata for Solana teleburns
 * 
 * Format follows BRC-20 conventions (p, op, v)
 * 
 * Spec: https://github.com/fevra-dev/kiln/blob/main/docs/INSCRIPTION_METADATA_SPEC.md
 */

// ============================================================================
// Types
// ============================================================================

export interface Attribute {
  trait_type: string;
  value: string | number | boolean;
}

/**
 * Minimal KILN teleburn inscription
 */
export interface KilnTeleburnMinimal {
  p: 'kiln';
  op: 'teleburn';
  v: 1;
  mint: string;
}

/**
 * Standard KILN teleburn inscription (with name + collection)
 */
export interface KilnTeleburnStandard extends KilnTeleburnMinimal {
  name: string;
  collection: string;
}

/**
 * Full KILN teleburn inscription (all fields)
 */
export interface KilnTeleburnFull extends KilnTeleburnStandard {
  symbol?: string;
  burn_tx?: string;
  attributes?: Attribute[];
}

/**
 * KILN provenance record (for existing inscriptions)
 */
export interface KilnProvenance {
  p: 'kiln';
  op: 'provenance';
  v: 1;
  inscription: string;
  mint: string;
  burn_tx?: string;
}

export type KilnInscription = KilnTeleburnMinimal | KilnTeleburnStandard | KilnTeleburnFull | KilnProvenance;

// ============================================================================
// Validation
// ============================================================================

const SOLANA_MINT_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const INSCRIPTION_ID_REGEX = /^[a-f0-9]{64}i[0-9]+$/;

export function isValidMint(mint: string): boolean {
  return SOLANA_MINT_REGEX.test(mint);
}

export function isValidInscriptionId(id: string): boolean {
  return INSCRIPTION_ID_REGEX.test(id);
}

export function isKilnInscription(data: unknown): data is KilnInscription {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  
  if (d.p !== 'kiln' || d.v !== 1) return false;
  if (typeof d.mint !== 'string' || !isValidMint(d.mint)) return false;
  
  if (d.op === 'teleburn') return true;
  if (d.op === 'provenance') {
    return typeof d.inscription === 'string' && isValidInscriptionId(d.inscription);
  }
  
  return false;
}

// ============================================================================
// Builders
// ============================================================================

/**
 * Build minimal inscription (required fields only)
 */
export function buildMinimal(mint: string): KilnTeleburnMinimal {
  if (!isValidMint(mint)) {
    throw new Error(`Invalid mint: ${mint}`);
  }
  return { p: 'kiln', op: 'teleburn', v: 1, mint };
}

/**
 * Build standard inscription (with name + collection)
 */
export function buildStandard(
  mint: string,
  name: string,
  collection: string
): KilnTeleburnStandard {
  if (!isValidMint(mint)) {
    throw new Error(`Invalid mint: ${mint}`);
  }
  return { p: 'kiln', op: 'teleburn', v: 1, mint, name, collection };
}

/**
 * Build full inscription (all fields)
 */
export function buildFull(options: {
  mint: string;
  name: string;
  collection: string;
  symbol?: string;
  burn_tx?: string;
  attributes?: Attribute[];
}): KilnTeleburnFull {
  if (!isValidMint(options.mint)) {
    throw new Error(`Invalid mint: ${options.mint}`);
  }
  
  const inscription: KilnTeleburnFull = {
    p: 'kiln',
    op: 'teleburn',
    v: 1,
    mint: options.mint,
    name: options.name,
    collection: options.collection
  };
  
  if (options.symbol) inscription.symbol = options.symbol;
  if (options.burn_tx) inscription.burn_tx = options.burn_tx;
  if (options.attributes?.length) inscription.attributes = options.attributes;
  
  return inscription;
}

/**
 * Build provenance record for existing inscription
 */
export function buildProvenance(
  inscriptionId: string,
  mint: string,
  burnTx?: string
): KilnProvenance {
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error(`Invalid inscription ID: ${inscriptionId}`);
  }
  if (!isValidMint(mint)) {
    throw new Error(`Invalid mint: ${mint}`);
  }
  
  const provenance: KilnProvenance = {
    p: 'kiln',
    op: 'provenance',
    v: 1,
    inscription: inscriptionId,
    mint
  };
  
  if (burnTx) provenance.burn_tx = burnTx;
  
  return provenance;
}

// ============================================================================
// Parsing
// ============================================================================

export interface ParseResult {
  valid: boolean;
  op: 'teleburn' | 'provenance' | null;
  mint: string | null;
  data: KilnInscription | null;
  error: string | null;
}

/**
 * Parse inscription JSON
 */
export function parse(json: string): ParseResult {
  try {
    const data = JSON.parse(json);
    
    if (!isKilnInscription(data)) {
      return { valid: false, op: null, mint: null, data: null, error: 'Invalid format' };
    }
    
    return {
      valid: true,
      op: data.op,
      mint: data.mint,
      data,
      error: null
    };
  } catch (e) {
    return {
      valid: false,
      op: null,
      mint: null,
      data: null,
      error: e instanceof Error ? e.message : 'Parse error'
    };
  }
}

/**
 * Quick check if JSON is KILN inscription
 */
export function isKiln(json: string): boolean {
  try {
    const data = JSON.parse(json);
    return data?.p === 'kiln';
  } catch {
    return false;
  }
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize to minified JSON
 */
export function serialize(inscription: KilnInscription): string {
  return JSON.stringify(inscription);
}

/**
 * Estimate size in bytes
 */
export function size(inscription: KilnInscription): number {
  return Buffer.byteLength(serialize(inscription), 'utf8');
}

// ============================================================================
// Indexing Helpers
// ============================================================================

/** SQL pattern for finding KILN inscriptions */
export const SQL_PATTERN = '%"p":"kiln"%';

/** Regex for content matching */
export const CONTENT_REGEX = /"p"\s*:\s*"kiln"/;
