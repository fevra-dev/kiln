/**
 * KILN Teleburn Protocol v1.0
 * Minimal memo format for Solana → Bitcoin Ordinals teleburns
 * 
 * Format: teleburn:<inscription_id>
 * 
 * This memo is embedded in the SAME transaction as the burn operation.
 * This provides:
 * - Atomic proof: memo and burn share the same transaction signature
 * - Accurate timing: transaction blockTime/slot is the authoritative timestamp
 * - Minimal size: ~78 bytes vs 250+ bytes for JSON format
 * 
 * Legacy support: This module also provides helpers for parsing legacy formats
 * (v0.1.x JSON memos and kiln: prefix format) for backwards compatibility.
 */

import { buildTeleburnMemo } from '../teleburn';

/**
 * Build a teleburn memo (v1.0 format)
 * 
 * @param inscriptionId - Bitcoin inscription ID (e.g., "abc123...i0")
 * @returns Formatted memo string (e.g., "teleburn:abc123...i0")
 */
export function buildRetireMemo(params: {
  inscriptionId: string;
}): string {
  return buildTeleburnMemo(params.inscriptionId);
}


