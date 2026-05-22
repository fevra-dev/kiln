/**
 * cNFT proof fetching + canopy depth + slicing.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §5.3-§5.4
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { ConcurrentMerkleTreeAccount } from '@solana/spl-account-compression';
import type { Umi } from '@metaplex-foundation/umi';

export interface AssetProof {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: string;
}

export async function fetchAssetProof(
  assetId: PublicKey,
  rpcUrl: string,
): Promise<AssetProof> {
  const body = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getAssetProof',
    params: { id: assetId.toBase58() },
  };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DAS getAssetProof HTTP ${res.status}`);
  }

  const env = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };

  if (env.error) {
    throw new Error(`DAS getAssetProof RPC error ${env.error.code}: ${env.error.message}`);
  }

  if (env.result == null) {
    throw new Error(`DAS getAssetProof returned null result for asset ${assetId.toBase58()}`);
  }

  return env.result as AssetProof;
}

export async function fetchTreeCanopyDepth(
  treePubkey: PublicKey,
  _umi: Umi,
  rpcUrl: string,
): Promise<number> {
  // _umi is part of the uniform signature but we use a raw web3 Connection
  // here because @solana/spl-account-compression's parser takes a Connection.
  const conn = new Connection(rpcUrl, 'confirmed');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = await ConcurrentMerkleTreeAccount.fromAccountAddress(conn as any, treePubkey);
  return account.getCanopyDepth();
}

/**
 * Slice off canopy nodes from the end of the proof.
 * Bubblegum's burn instruction only needs the proof nodes NOT covered
 * by the on-chain canopy.
 */
export function sliceProof(proof: string[], canopyDepth: number): string[] {
  if (canopyDepth <= 0) return [...proof];
  if (canopyDepth >= proof.length) return [];
  return proof.slice(0, proof.length - canopyDepth);
}
