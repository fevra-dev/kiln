/**
 * cNFT burn path. Uses @metaplex-foundation/mpl-bubblegum for the burn
 * instruction and DAS getAssetProof for the Merkle proof.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §5
 */

import { PublicKey } from '@solana/web3.js';
import { burn as bubblegumBurn } from '@metaplex-foundation/mpl-bubblegum';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import {
  transactionBuilder,
  publicKey,
  publicKeyBytes,
  createNoopSigner,
  type Umi,
  type TransactionBuilder,
} from '@metaplex-foundation/umi';
import { withSplMemoString } from './ix-helpers';
import { buildRetireMemo } from './memo';
import { fetchAssetProof, fetchTreeCanopyDepth, sliceProof } from './cnft-proof';
import {
  CnftOwnershipMismatchError,
  CnftDelegatedError,
  CnftTooDeepError,
} from './errors';
import type { DasAsset, NftKind } from './types';

const CNFT_BURN_COMPUTE_UNITS = 300_000;
const MAX_TX_SIZE = 1232;
const BASE_TX_BYTES = 280;
const PER_PROOF_NODE_BYTES = 32;

export function estimateCnftBurnSize(slicedProofLength: number): number {
  return BASE_TX_BYTES + slicedProofLength * PER_PROOF_NODE_BYTES;
}

export async function buildCnftBurn(args: {
  umi: Umi;
  asset: DasAsset;
  kindInfo: Extract<NftKind, { kind: 'cnft' }>;
  inscriptionId: string;
  ownerPubkey: PublicKey;
  priorityMicrolamports: number;
  rpcUrl: string;
}): Promise<TransactionBuilder> {
  // Pre-flight: ownership
  if (args.asset.ownership.owner !== args.ownerPubkey.toBase58()) {
    throw new CnftOwnershipMismatchError(args.asset.ownership.owner, args.ownerPubkey.toBase58());
  }

  // Pre-flight: delegate (only block if delegate is set AND different from owner)
  if (
    args.asset.ownership.delegate !== null &&
    args.asset.ownership.delegate !== args.asset.ownership.owner
  ) {
    throw new CnftDelegatedError(args.asset.ownership.delegate);
  }

  // Fetch fresh proof (network call)
  const proof = await fetchAssetProof(args.kindInfo.assetId, args.rpcUrl);

  // Determine canopy depth and slice the proof
  const canopyDepth = await fetchTreeCanopyDepth(args.kindInfo.tree, args.umi, args.rpcUrl);
  const slicedProof = sliceProof(proof.proof, canopyDepth);

  // Pre-flight: tx size check
  const estimatedSize = estimateCnftBurnSize(slicedProof.length);
  if (estimatedSize > MAX_TX_SIZE) {
    throw new CnftTooDeepError(args.kindInfo.tree.toBase58(), slicedProof.length, estimatedSize);
  }

  // Convert types for Bubblegum's burn ix:
  //   root:        base58 string (DAS) → Uint8Array via publicKeyBytes()
  //   dataHash:    hex string (NftKind) → Uint8Array via Buffer.from(hex)
  //   creatorHash: hex string (NftKind) → Uint8Array via Buffer.from(hex)
  //   proof:       base58 string[] → Array<UmiPublicKey> via publicKey()
  const rootBytes: Uint8Array = publicKeyBytes(proof.root);
  const dataHashBytes: Uint8Array = Buffer.from(args.kindInfo.dataHash, 'hex');
  const creatorHashBytes: Uint8Array = Buffer.from(args.kindInfo.creatorHash, 'hex');
  const proofPubkeys = slicedProof.map(p => publicKey(p));

  // Build transaction
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(args.umi, { units: CNFT_BURN_COMPUTE_UNITS }));
  tb = tb.add(setComputeUnitPrice(args.umi, { microLamports: args.priorityMicrolamports }));

  const ownerSigner = createNoopSigner(publicKey(args.ownerPubkey.toBase58()));

  tb = tb.add(
    bubblegumBurn(args.umi, {
      leafOwner: ownerSigner,
      merkleTree: publicKey(args.kindInfo.tree.toBase58()),
      root: rootBytes,
      dataHash: dataHashBytes,
      creatorHash: creatorHashBytes,
      nonce: args.kindInfo.leafIndex,
      index: args.kindInfo.leafIndex,
      proof: proofPubkeys,
    }),
  );

  // Attach teleburn memo (v1.0 format: teleburn:<inscriptionId>)
  const memo = buildRetireMemo({ inscriptionId: args.inscriptionId });
  tb = withSplMemoString(tb, memo);

  return tb;
}
