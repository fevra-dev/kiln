/**
 * pNFT (Programmable NFT) burn path. Uses Metaplex Token Metadata burnV1
 * with TokenStandard.ProgrammableNonFungible.
 *
 * Refactored to accept a pre-fetched DasAsset from the dispatcher in
 * build-burn-memo-tx.ts. PDAs are derived from the mint pubkey;
 * collection metadata comes from DasAsset.grouping if present.
 *
 * Instruction order (preserved from pre-refactor):
 * 1. ComputeBudget (set CU limit and priority fee)
 * 2. Metaplex burnV1 (atomically thaws and burns the pNFT)
 * 3. SPL Memo (records Kiln teleburn proof inline)
 */

import type { Umi, TransactionBuilder } from '@metaplex-foundation/umi';
import type { PublicKey } from '@solana/web3.js';
import type { DasAsset, NftKind } from './types';
import { publicKey, transactionBuilder, createNoopSigner } from '@metaplex-foundation/umi';
import {
  burnV1,
  TokenStandard,
  findMetadataPda,
  findMasterEditionPda,
  findTokenRecordPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  setComputeUnitLimit,
  setComputeUnitPrice,
  findAssociatedTokenPda,
} from '@metaplex-foundation/mpl-toolbox';
import { withSplMemoString } from './ix-helpers';
import { buildRetireMemo } from './memo';

const PNFT_BURN_COMPUTE_UNITS = 500_000;

export async function buildPnftBurn(args: {
  umi: Umi;
  asset: DasAsset;
  kindInfo: Extract<NftKind, { kind: 'pnft' }>;
  inscriptionId: string;
  ownerPubkey: PublicKey;
  priorityMicrolamports: number;
  rpcUrl: string;
}): Promise<TransactionBuilder> {
  const mintPk = publicKey(args.kindInfo.mint.toBase58());
  const ownerPk = publicKey(args.ownerPubkey.toBase58());
  const ownerSigner = createNoopSigner(ownerPk);

  // PDAs from mint
  const metadataPda = findMetadataPda(args.umi, { mint: mintPk })[0];
  const masterEditionPda = findMasterEditionPda(args.umi, { mint: mintPk })[0];
  const ownerAta = findAssociatedTokenPda(args.umi, { mint: mintPk, owner: ownerPk })[0];
  const tokenRecord = findTokenRecordPda(args.umi, { mint: mintPk, token: ownerAta })[0];

  // Optional collection metadata (from DAS grouping)
  let collectionMetadata: ReturnType<typeof findMetadataPda>[0] | undefined;
  const grouping = (args.asset as DasAsset & {
    grouping?: Array<{ group_key: string; group_value: string }>;
  }).grouping;
  if (grouping && grouping.length > 0) {
    const collKey = grouping.find(g => g.group_key === 'collection')?.group_value;
    if (collKey) {
      collectionMetadata = findMetadataPda(args.umi, { mint: publicKey(collKey) })[0];
    }
  }

  // Build tx
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(args.umi, { units: PNFT_BURN_COMPUTE_UNITS }));
  tb = tb.add(setComputeUnitPrice(args.umi, { microLamports: args.priorityMicrolamports }));

  tb = tb.add(
    burnV1(args.umi, {
      mint: mintPk,
      authority: ownerSigner,
      token: ownerAta,
      tokenRecord,
      metadata: metadataPda,
      edition: masterEditionPda,
      collectionMetadata,
      tokenStandard: TokenStandard.ProgrammableNonFungible,
    }),
  );

  // Memo
  const memo = buildRetireMemo({ inscriptionId: args.inscriptionId });
  tb = withSplMemoString(tb, memo);

  return tb;
}
