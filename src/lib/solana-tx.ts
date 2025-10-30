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

      // Check if transaction has Metaplex Token Metadata program
      // Handle both legacy and versioned transactions
      let hasMetaIx = false;
      if ('instructions' in tx.transaction.message) {
        // Legacy transaction
        const programIds = tx.transaction.message.programIds();
        hasMetaIx = programIds.some((pid) => pid.equals(TOKEN_METADATA_PROGRAM_ID));
      } else {
        // Versioned transaction (V0)
        // Check account keys (first staticAccountKeys, then lookup tables)
        const metaPidStr = TOKEN_METADATA_PROGRAM_ID.toBase58();
        const staticKeys = tx.transaction.message.staticAccountKeys || [];
        hasMetaIx = staticKeys.some((key) => key.toBase58() === metaPidStr);
        
        // Also check in instructions (compile-time programs are in static keys)
        if (!hasMetaIx && tx.transaction.message.compiledInstructions) {
          for (const ix of tx.transaction.message.compiledInstructions) {
            const programKeyIndex = ix.programIdIndex;
            const programKey = staticKeys[programKeyIndex]?.toBase58();
            if (programKey === metaPidStr) {
              hasMetaIx = true;
              break;
            }
          }
        }
      }
      
      if (!hasMetaIx) continue;

      // Get fee payer (first account key)
      const feePayer = 
        'accountKeys' in tx.transaction.message
          ? tx.transaction.message.accountKeys[0]?.toBase58()
          : tx.transaction.message.staticAccountKeys[0]?.toBase58();
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


