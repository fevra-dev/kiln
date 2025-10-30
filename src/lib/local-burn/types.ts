/**
 * Local Burn Types
 *
 * Defines common types used by the local Metaplex burn implementation.
 */

/**
 * NFT standards we may encounter for local burn routing.
 */
export type NftStandard = 'CORE' | 'PNFT' | 'REGULAR';

/**
 * Arguments required to assemble and send a local burn with inline memo.
 */
export interface LocalBurnArgs {
  /** Base58 mint address */
  mint: string;
  /** Base58 owner wallet (fee payer and authority) */
  owner: string;
  /** Bitcoin inscription id (txid + index) */
  inscriptionId: string;
  /** Content SHA-256 hex string */
  sha256: string;
  /** Optional priority fee in micro-lamports */
  priorityMicrolamports?: number;
}

/**
 * Result returned after a successful local burn.
 */
export interface LocalBurnResult {
  /** Transaction signature of the burn+memo tx */
  signature: string;
  /** NFT standard used */
  type: NftStandard;
}


