/**
 * Build burn+memo transaction. Thin dispatcher over per-standard burn builders.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §3.2, §4.5
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, signerIdentity, createNoopSigner } from '@metaplex-foundation/umi';
import { Connection, PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { detectAssetKind } from './detect';
import { buildPnftBurn } from './pnft-burn';
import { buildRegularBurn } from './regular-burn';
import { buildCnftBurn } from './cnft-burn';
import { NotYetImplementedError, UnsupportedStandardError } from './errors';
import type { BuiltBurnTx } from './types';

export interface BuildBurnMemoArgs {
  rpcUrl: string;
  mint: string;            // mint OR cNFT assetId OR Core assetId
  owner: string;
  inscriptionId: string;
  priorityMicrolamports?: number;
}

const FALLBACK_RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
];

async function getWorkingRpcUrl(rpcUrl: string): Promise<string> {
  try {
    const conn = new Connection(rpcUrl, 'confirmed');
    await conn.getSlot();
    return rpcUrl;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
      for (const fallback of FALLBACK_RPC_ENDPOINTS) {
        try {
          const c = new Connection(fallback, 'confirmed');
          await c.getSlot();
          return fallback;
        } catch {
          // try next
        }
      }
    }
    return rpcUrl;
  }
}

export async function buildBurnMemoTransaction(args: BuildBurnMemoArgs): Promise<BuiltBurnTx> {
  const priorityMicrolamports = args.priorityMicrolamports ?? 2_000;
  const workingRpcUrl = await getWorkingRpcUrl(args.rpcUrl);

  // 1. Detect asset kind
  const { kind, asset } = await detectAssetKind(args.mint, workingRpcUrl);

  // 2. Set up Umi
  const umi = createUmi(workingRpcUrl);
  umi.programs.add({
    name: 'splToken',
    publicKey: publicKey(TOKEN_PROGRAM_ID.toString()),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  } as unknown as Parameters<typeof umi.programs.add>[0]);
  umi.programs.add({
    name: 'splAssociatedToken',
    publicKey: publicKey(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  } as unknown as Parameters<typeof umi.programs.add>[0]);
  umi.use(mplBubblegum());

  const ownerPubkey = new PublicKey(args.owner);
  const ownerSigner = createNoopSigner(publicKey(ownerPubkey.toBase58()));
  umi.use(signerIdentity(ownerSigner));

  const common = {
    umi,
    asset,
    inscriptionId: args.inscriptionId,
    ownerPubkey,
    priorityMicrolamports,
    rpcUrl: workingRpcUrl,
  };

  // 3. Dispatch
  let tb;
  switch (kind.kind) {
    case 'pnft':
      tb = await buildPnftBurn({ ...common, kindInfo: kind });
      break;
    case 'regular':
      tb = await buildRegularBurn({ ...common, kindInfo: kind });
      break;
    case 'cnft':
      tb = await buildCnftBurn({ ...common, kindInfo: kind });
      break;
    case 'core':
    case 'mpl-inscription':
    case 'libreplex-inscription':
      throw new NotYetImplementedError(kind.kind);
    case 'unknown':
      throw new UnsupportedStandardError(kind.daInterface);
  }

  // 4. Compile + serialize
  const conn = new Connection(workingRpcUrl, 'confirmed');
  const { blockhash } = await conn.getLatestBlockhash();

  const umiInstructions = tb.getInstructions();
  const web3JsInstructions = umiInstructions.map((ix) => toWeb3JsInstruction(ix));

  const messageV0 = new TransactionMessage({
    payerKey: ownerPubkey,
    recentBlockhash: blockhash,
    instructions: web3JsInstructions,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  const serialized = versionedTx.serialize();
  const base64Tx = Buffer.from(serialized).toString('base64');

  return {
    transaction: base64Tx,
    isVersioned: true,
    nftKind: kind.kind,
  };
}
