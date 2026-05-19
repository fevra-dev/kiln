/**
 * Local Burn Types
 *
 * Defines common types used by the local Metaplex burn implementation.
 */

import type { PublicKey } from '@solana/web3.js';

/**
 * NFT standards we may encounter for local burn routing.
 */
export type NftStandard = 'CORE' | 'PNFT' | 'REGULAR';

/**
 * Discriminated union of supported Solana asset standards.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §4.1
 */
export type NftKind =
  | { kind: 'regular'; mint: PublicKey }
  | { kind: 'pnft'; mint: PublicKey }
  | { kind: 'cnft';
      assetId: PublicKey;
      tree: PublicKey;
      /** zero-based leaf index in the Merkle tree, used as both nonce and index in Bubblegum.burn */
      leafIndex: number;
      /** lowercase hex string, as returned by DAS compression.data_hash */
      dataHash: string;
      /** lowercase hex string, as returned by DAS compression.creator_hash */
      creatorHash: string;
    }
  | { kind: 'core'; assetId: PublicKey }
  | { kind: 'mpl-inscription'; mint: PublicKey }
  | { kind: 'libreplex-inscription'; mint: PublicKey }
  | { kind: 'unknown'; daInterface: string; identifier: string };

/**
 * Normalized DAS asset shape (snake_case fields preserved from JSON-RPC wire format).
 * Burn builders should consume NftKind (camelCase) rather than DasAsset directly when the
 * data is available there; DasAsset is the source-of-truth for fields not yet hoisted
 * into NftKind (e.g., ownership.delegate for cNFT pre-flight checks).
 */
export interface DasAsset {
  id: string;
  interface: string;
  ownership: {
    owner: string;
    delegate: string | null;
    ownership_model: 'single' | 'token';
  };
  content: {
    metadata: { name?: string; description?: string };
    files?: Array<{ uri: string; mime?: string }>;
    json_uri?: string;
  };
  compression?: {
    compressed: boolean;
    tree?: string;
    leaf_id?: number;
    data_hash?: string;
    creator_hash?: string;
    asset_hash?: string;
    seq?: number;
  };
}

/**
 * What the dispatcher returns after building a burn+memo tx.
 * Replaces the old `nftType: 'PNFT' | 'REGULAR'` shape.
 */
export interface BuiltBurnTx {
  transaction: string;          // base64 serialized
  /** true → client must decode with VersionedTransaction; false → legacy Transaction. */
  isVersioned: boolean;
  nftKind: NftKind['kind'];     // expanded from old nftType
}

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


