/**
 * Local pNFT burn assembly with inline SPL Memo (single transaction).
 * 
 * Instruction order:
 * 1. ComputeBudget (set CU limit and priority fee)
 * 2. Metaplex burnV1 (atomically thaws and burns the pNFT)
 * 3. SPL Memo (records Kiln teleburn proof inline)
 * 
 * Benefits of inline memo:
 * - Atomic linkage: memo and burn share the same transaction signature
 * - Accurate timestamps: tx blockTime/slot is authoritative
 * - Single transaction: no separate memo tx needed
 * - Gas efficient: one transaction instead of two
 */
import { publicKey, transactionBuilder, base58 } from '@metaplex-foundation/umi';
import {
  fetchDigitalAssetWithAssociatedToken,
  findMetadataPda,
  findMasterEditionPda,
  burnV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { withComputeBudget, withSplMemo } from './ix-helpers';
import { buildRetireMemo } from './memo';
import type { LocalBurnArgs } from './types';

/**
 * Assemble and send a pNFT burn that includes a KILN memo inline.
 */
export async function buildAndSendPnftBurnWithMemo(
  umi: any,
  args: LocalBurnArgs
): Promise<{ signature: string }> {
  const mintPk = publicKey(args.mint);
  const ownerPk = publicKey(args.owner);

  const asset = await fetchDigitalAssetWithAssociatedToken(umi, mintPk, ownerPk);

  const metadataPda = findMetadataPda(umi, { mint: mintPk })[0];
  const masterEditionPda = findMasterEditionPda(umi, { mint: mintPk })[0];

  const collection = asset.metadata.collection.__option === 'Some' ? asset.metadata.collection.value : null;
  const collectionMetadata = collection ? findMetadataPda(umi, { mint: collection.key })[0] : undefined;
  const ruleSet = asset.metadata.programmableConfig?.ruleSet;

  let tb = transactionBuilder();
  tb = withComputeBudget(tb, { microLamports: args.priorityMicrolamports });

  tb = tb.add(
    burnV1(umi, {
      mintAccount: mintPk,
      token: asset.token.publicKey,
      tokenRecord: asset.tokenRecord?.publicKey,
      metadata: metadataPda,
      edition: masterEditionPda,
      collectionMetadata,
      tokenStandard: TokenStandard.ProgrammableNonFungible,
      authorizationRules: ruleSet ? publicKey(ruleSet) : undefined,
    })
  );

  // Build memo with teleburn action (pNFTs are burned via Metaplex)
  const memo = buildRetireMemo({
    inscriptionId: args.inscriptionId,
    mint: args.mint,
    sha256: args.sha256,
    timestamp: Math.floor(Date.now() / 1000),
  });
  tb = withSplMemo(tb, memo);

  const res = await tb.sendAndConfirm(umi);
  const [sig] = base58.deserialize(res.signature);
  return { signature: sig };
}


