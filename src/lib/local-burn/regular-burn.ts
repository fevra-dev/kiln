/**
 * Local regular NFT burn assembly with inline SPL Memo (single transaction).
 */
import { publicKey, transactionBuilder, base58, type Umi } from '@metaplex-foundation/umi';
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
 * Assemble and send a regular NFT burn that includes a KILN memo inline.
 */
export async function buildAndSendRegularBurnWithMemo(
  umi: Umi,
  args: LocalBurnArgs
): Promise<{ signature: string }> {
  const mintPk = publicKey(args.mint);
  const ownerPk = publicKey(args.owner);

  const asset = await fetchDigitalAssetWithAssociatedToken(umi, mintPk, ownerPk);

  const metadataPda = findMetadataPda(umi, { mint: mintPk })[0];
  const masterEditionPda = findMasterEditionPda(umi, { mint: mintPk })[0];

  const collection = asset.metadata.collection.__option === 'Some' ? asset.metadata.collection.value : null;
  const collectionMetadata = collection ? findMetadataPda(umi, { mint: collection.key })[0] : undefined;

  let tb = transactionBuilder();
  tb = withComputeBudget(umi, tb, { microLamports: args.priorityMicrolamports });

  tb = tb.add(
    burnV1(umi, {
      mint: mintPk,
      token: asset.token.publicKey,
      metadata: metadataPda,
      edition: masterEditionPda,
      collectionMetadata,
      tokenStandard: TokenStandard.NonFungible,
    })
  );

  // Build memo with teleburn action (regular NFTs are burned via Metaplex)
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


