/**
 * Asset detection — Helius DAS-driven, returns NftKind discriminated union.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §4
 */

import { PublicKey } from '@solana/web3.js';
import type { NftKind, DasAsset } from './types';
import { AssetNotFoundError, NotAnNftError } from './errors';

interface DasGetAssetEnvelope {
  jsonrpc: string;
  id: string;
  result: unknown;
}

export async function detectAssetKind(
  mintOrAssetId: string,
  rpcUrl: string,
): Promise<{ kind: NftKind; asset: DasAsset }> {
  const body = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getAsset',
    params: { id: mintOrAssetId },
  };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DAS getAsset HTTP ${res.status}`);
  }

  const env = (await res.json()) as DasGetAssetEnvelope;
  const result = env.result;

  if (result === null || result === undefined) {
    throw new AssetNotFoundError(mintOrAssetId);
  }

  const asset = result as DasAsset;
  const iface = typeof asset.interface === 'string' ? asset.interface : '';

  // Order matters: compression check beats interface check (a cNFT may
  // have interface 'V1_NFT' but be compressed).
  if (asset.compression?.compressed === true) {
    return {
      kind: {
        kind: 'cnft',
        assetId: new PublicKey(asset.id),
        tree: new PublicKey(asset.compression.tree!),
        leafIndex: asset.compression.leaf_id!,
        dataHash: asset.compression.data_hash!,
        creatorHash: asset.compression.creator_hash!,
      },
      asset,
    };
  }

  if (iface === 'ProgrammableNFT') {
    return { kind: { kind: 'pnft', mint: new PublicKey(asset.id) }, asset };
  }

  if (iface === 'V1_NFT' || iface === 'V1_PRINT' || iface === 'V2_NFT') {
    return { kind: { kind: 'regular', mint: new PublicKey(asset.id) }, asset };
  }

  if (iface === 'MplCoreAsset' || iface === 'MplCoreCollection') {
    return { kind: { kind: 'core', assetId: new PublicKey(asset.id) }, asset };
  }

  if (iface === 'FungibleToken' || iface === 'FungibleAsset') {
    throw new NotAnNftError(iface);
  }

  return {
    kind: { kind: 'unknown', daInterface: iface, identifier: asset.id },
    asset,
  };
}
