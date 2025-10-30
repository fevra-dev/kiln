/**
 * Lightweight Solana transaction helpers to locate latest Metaplex burn tx for a mint.
 */
import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export interface LatestBurnTx {
  signature: string;
  slot: number;
  blockTime?: number | null;
  feePayer?: string;
}

/**
 * Heuristic: scan recent transactions for the mint account and return the most recent
 * tx that includes a Metaplex Token Metadata instruction (likely burnV1 when users retire).
 * This is a best-effort signal to show on the verification UI.
 */
export async function findLatestMetaplexTxForMint(
  connection: Connection,
  mint: string,
  limit = 20
): Promise<LatestBurnTx | null> {
  try {
    const mintPk = new PublicKey(mint);
    const sigs = await connection.getSignaturesForAddress(mintPk, { limit });
    for (const s of sigs) {
      const tx = await connection.getTransaction(s.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;

      const hasMetaIx = tx.transaction.message.programIds().some((pid) => pid.equals(TOKEN_METADATA_PROGRAM_ID));
      if (!hasMetaIx) continue;

      const feePayer = tx.transaction.message.accountKeys[0]?.toBase58();
      return {
        signature: s.signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        feePayer,
      };
    }
    return null;
  } catch {
    return null;
  }
}


