/**
 * Asset detection — Helius DAS-driven, returns NftKind discriminated union.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §4
 */

import { PublicKey } from '@solana/web3.js';
import type { NftKind, DasAsset } from './types';
import { AssetNotFoundError, MalformedDasResponseError, NotAnNftError } from './errors';

const DAS_GETASSET_TIMEOUT_MS = 10_000;

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

  let res;
  try {
    res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DAS_GETASSET_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error(`DAS getAsset timed out after ${DAS_GETASSET_TIMEOUT_MS}ms`);
    }
    throw new Error(`DAS getAsset fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    throw new Error(`DAS getAsset HTTP ${res.status}`);
  }

  const env = (await res.json()) as { jsonrpc?: string; id?: string; result?: unknown; error?: { code: number; message: string } };

  if (env.error) {
    throw new Error(`DAS getAsset RPC error ${env.error.code}: ${env.error.message}`);
  }

  const result = env.result;

  if (result === null || result === undefined) {
    throw new AssetNotFoundError(mintOrAssetId);
  }

  const asset = result as DasAsset;
  const iface = typeof asset.interface === 'string' ? asset.interface : '';

  // Order matters: compression check beats interface check (a cNFT may
  // have interface 'V1_NFT' but be compressed).
  if (asset.compression?.compressed === true) {
    const c = asset.compression;
    if (!c.tree || c.leaf_id == null || !c.data_hash || !c.creator_hash) {
      throw new MalformedDasResponseError(
        `compressed asset is missing required fields (tree=${!!c.tree}, leaf_id=${c.leaf_id != null}, data_hash=${!!c.data_hash}, creator_hash=${!!c.creator_hash})`,
      );
    }
    return {
      kind: {
        kind: 'cnft',
        assetId: new PublicKey(asset.id),
        tree: new PublicKey(c.tree),
        leafIndex: c.leaf_id,
        dataHash: c.data_hash,
        creatorHash: c.creator_hash,
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
