/**
 * Kiln Memo (v0.1.1) for inline burn transaction.
 *
 * This memo is embedded in the SAME transaction as the burn operation.
 * This provides:
 * - Atomic proof: memo and burn share the same transaction signature
 * - Accurate timing: transaction blockTime/slot is the authoritative timestamp
 * - No separate memo transaction needed
 * 
 * Note: timestamp/slot fields are optional hints (non-authoritative).
 * Always use the transaction's blockTime and slot for verification.
 */

export interface Sbt011RetireMemo {
  standard: 'Kiln';
  version: '0.1.1';
  /** Action type - teleburn operation (burn is implied) */
  action: 'teleburn';
  /** Method used to execute the burn (e.g., Metaplex burnV1) */
  method?: 'metaplex-burn-v1';
  inscription: { id: string };
  solana: { mint: string; derived_owner?: string };
  media: { sha256: string };
  /** Expected timestamp hint (non-authoritative - use tx blockTime for truth) */
  timestamp?: number;
  /** Expected slot/block height hint (non-authoritative - use tx slot for truth) */
  slot?: number;
}

/**
 * Build a compact RETIRE memo payload.
 */
export function buildRetireMemo(params: {
  inscriptionId: string;
  mint: string;
  sha256: string;
  derivedOwner?: string;
  /** Expected timestamp hint (non-authoritative) */
  timestamp?: number;
  /** Expected slot/block height hint (non-authoritative) */
  slot?: number;
}): Sbt011RetireMemo {
  return {
    standard: 'Kiln',
    version: '0.1.1',
    action: 'teleburn',
    method: 'metaplex-burn-v1', // Method used to execute the burn
    inscription: { id: params.inscriptionId },
    solana: { mint: params.mint, ...(params.derivedOwner && { derived_owner: params.derivedOwner }) },
    media: { sha256: params.sha256 },
    ...(params.timestamp && { timestamp: params.timestamp }),
    ...(params.slot && { slot: params.slot }),
  };
}


