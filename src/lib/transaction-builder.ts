// src/lib/transaction-builder.ts
/**
 * Transaction Builder
 *
 * Builds auxiliary Solana transactions used by the dry-run/simulate path.
 * The primary v1.0 burn+memo transaction is built in
 * `src/lib/local-burn/build-burn-memo-tx.ts`; this file only retains the
 * URI-update placeholder and a confirmed-tx timestamp helper.
 */

import { PublicKey, Transaction } from '@solana/web3.js';
import type { TeleburnMethod } from './types';
import { withRpcFailover } from './rpc-failover';

// Memo Program ID
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Teleburn method options — re-exported for callers that import from this module.
 */
export type { TeleburnMethod };

/**
 * Transaction builder parameters for URI update
 */
export interface UpdateUriParams {
  payer: PublicKey;
  authority: PublicKey;
  mint: PublicKey;
  newUri: string;
  rpcUrl?: string;
}

/**
 * Built transaction response
 */
export interface BuiltTransaction {
  transaction: Transaction;
  description: string;
  estimatedFee: number; // in lamports
}

export class TransactionBuilder {
  constructor(_rpcUrl: string) {
    // rpcUrl is accepted for signature compatibility; connections are obtained
    // per-call via withRpcFailover.
  }

  /**
   * Build URI update transaction (placeholder — Metaplex update_metadata not yet wired up here;
   * the live update path is `/api/tx/update-metadata`).
   */
  async buildUpdateUriTransaction(params: UpdateUriParams): Promise<BuiltTransaction> {
    const { payer, newUri } = params;

    const transaction = new Transaction();
    transaction.feePayer = payer;

    const { blockhash } = await withRpcFailover(async (conn) => {
      return await conn.getLatestBlockhash();
    });
    transaction.recentBlockhash = blockhash;

    const estimatedFee = await this.estimateTransactionFee(transaction);

    return {
      transaction,
      description: `UPDATE URI: Point metadata to pointer JSON at ${newUri}`,
      estimatedFee,
    };
  }

  private async estimateTransactionFee(transaction: Transaction): Promise<number> {
    try {
      const message = transaction.compileMessage();
      const fee = await withRpcFailover(async (conn) => {
        return await conn.getFeeForMessage(message);
      });
      return fee.value ?? 5000;
    } catch (error) {
      console.warn('Failed to estimate transaction fee:', error);
      return 5000;
    }
  }

  /**
   * Get actual timestamp + slot for a confirmed transaction.
   */
  async getTransactionTimestamp(signature: string): Promise<{ timestamp: number; block_height: number }> {
    const tx = await withRpcFailover(async (conn) => {
      return await conn.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }
    if (!tx.blockTime) {
      throw new Error('Block time not available for transaction');
    }

    return {
      timestamp: tx.blockTime,
      block_height: tx.slot,
    };
  }
}

export function createTransactionBuilder(rpcUrl: string): TransactionBuilder {
  return new TransactionBuilder(rpcUrl);
}
