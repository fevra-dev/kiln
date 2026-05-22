import { PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { buildCnftBurn, estimateCnftBurnSize } from '@/lib/local-burn/cnft-burn';
import {
  CnftOwnershipMismatchError,
  CnftDelegatedError,
} from '@/lib/local-burn/errors';
import type { DasAsset, NftKind } from '@/lib/local-burn/types';

const RPC_URL = 'https://mock-rpc';
const OWNER = new PublicKey('11111111111111111111111111111112');
const NOT_OWNER = '11111111111111111111111111111113';
const ASSET_ID = 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
const TREE = 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';

function makeAsset(ownerPubkey: string, delegate: string | null = null): DasAsset {
  return {
    id: ASSET_ID,
    interface: 'V1_NFT',
    ownership: { owner: ownerPubkey, delegate, ownership_model: 'single' },
    content: { metadata: { name: 'Test cNFT' } },
    compression: {
      compressed: true,
      tree: TREE,
      leaf_id: 0,
      data_hash: 'aabb',
      creator_hash: 'ccdd',
    },
  };
}

function makeKindInfo(): Extract<NftKind, { kind: 'cnft' }> {
  return {
    kind: 'cnft',
    assetId: new PublicKey(ASSET_ID),
    tree: new PublicKey(TREE),
    leafIndex: 0,
    dataHash: 'aabb',
    creatorHash: 'ccdd',
  };
}

describe('buildCnftBurn pre-flight checks', () => {
  it('throws CnftOwnershipMismatchError when DAS owner != signer', async () => {
    const umi = createUmi(RPC_URL);
    await expect(buildCnftBurn({
      umi,
      asset: makeAsset(NOT_OWNER), // DAS says NotOwner
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER, // signer says Owner
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    })).rejects.toBeInstanceOf(CnftOwnershipMismatchError);
  });

  it('throws CnftDelegatedError when active delegate is different from owner', async () => {
    const umi = createUmi(RPC_URL);
    const delegateAddr = '11111111111111111111111111111114';
    await expect(buildCnftBurn({
      umi,
      asset: makeAsset(OWNER.toBase58(), delegateAddr),
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER,
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    })).rejects.toBeInstanceOf(CnftDelegatedError);
  });

  it('does NOT throw delegate error when delegate equals owner', async () => {
    // Pre-flight passes ownership + delegate; only fails at network calls
    // for proof/canopy. We assert it does NOT throw ownership/delegate errors.
    const umi = createUmi(RPC_URL);
    const result = buildCnftBurn({
      umi,
      asset: makeAsset(OWNER.toBase58(), OWNER.toBase58()),
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER,
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    });

    // Network failure expected (no fetch mock set), but NOT delegate/ownership.
    await expect(result).rejects.not.toBeInstanceOf(CnftDelegatedError);
    await expect(result).rejects.not.toBeInstanceOf(CnftOwnershipMismatchError);
  });
});

describe('estimateCnftBurnSize', () => {
  it('exposes a heuristic estimator', () => {
    expect(estimateCnftBurnSize(0)).toBeGreaterThanOrEqual(280);
    expect(estimateCnftBurnSize(20)).toBeGreaterThan(estimateCnftBurnSize(0));
    // 30 proof nodes (32 bytes each = 960) + base ~280 = 1240 (over 1232 limit)
    expect(estimateCnftBurnSize(30)).toBeGreaterThan(1232);
  });

  it('grows linearly with proof length', () => {
    const baseline = estimateCnftBurnSize(0);
    const tenNodes = estimateCnftBurnSize(10);
    expect(tenNodes - baseline).toBe(10 * 32);
  });
});
