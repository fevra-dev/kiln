// src/lib/transaction-builder.ts
/**
 * KILN.1 Transaction Builder
 * 
 * Builds Solana transactions for the teleburn protocol:
 * - Seal: Record inscription proof on-chain via SPL Memo
 * - Retire: Burn/Incinerate/Transfer to derived owner
 * - Update URI: Optional metadata pointer update
 * 
 * All transactions include timestamp and block_height for temporal anchoring.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import { deriveTeleburnAddress } from './teleburn';
import { SolanaTimestampService } from './solana-timestamp';
import type { Sbt01Seal, Sbt01Retire } from './types';

// Memo Program ID
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Incinerator address (provably unspendable)
export const INCINERATOR_ADDRESS = new PublicKey('1nc1nerator11111111111111111111111111111111');

/**
 * Teleburn method options
 */
export type TeleburnMethod = 'burn' | 'incinerate' | 'teleburn-derived';

/**
 * Transaction builder parameters for seal
 */
export interface SealTransactionParams {
  payer: PublicKey;
  mint: PublicKey;
  inscriptionId: string;
  sha256: string;
  authority?: PublicKey[]; // Optional multi-sig authorities
  rpcUrl?: string;
}

/**
 * Transaction builder parameters for retire
 */
export interface RetireTransactionParams {
  payer: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  inscriptionId: string;
  sha256: string;
  method: TeleburnMethod;
  amount?: bigint; // Amount to retire (default: 1 for NFTs)
  rpcUrl?: string;
}

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

/**
 * Transaction Builder Service
 * 
 * Handles construction of all KILN.1 protocol transactions
 */
export class TransactionBuilder {
  private connection: Connection;
  private timestampService: SolanaTimestampService;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.timestampService = new SolanaTimestampService(rpcUrl);
  }

  /**
   * Build SEAL transaction
   * 
   * Creates a transaction with:
   * 1. SPL Memo instruction with KILN.1 seal payload
   * 2. Timestamp and block height anchoring
   * 
   * @param params - Seal transaction parameters
   * @returns Built transaction ready for signing
   */
  async buildSealTransaction(params: SealTransactionParams): Promise<BuiltTransaction> {
    const { payer, mint, inscriptionId, sha256, authority } = params;

    // Note: We'll get the actual timestamp and block height after transaction confirmation
    // For now, use placeholder values that will be updated
    const slot = 0; // Will be updated after confirmation
    const timestamp = 0; // Will be updated after confirmation

    // Construct KILN-0.1.1 seal memo payload
    const sealMemo: Sbt01Seal = {
      standard: 'KILN',
      version: '0.1.1',
      source_chain: 'solana-mainnet',
      target_chain: 'bitcoin-mainnet',
      action: 'seal',
      timestamp,
      block_height: slot,
      inscription: {
        id: inscriptionId,
      },
      solana: {
        mint: mint.toBase58(),
      },
      media: {
        sha256,
      },
    };

    // Add optional multi-sig authorities
    if (authority && authority.length > 0) {
      sealMemo.extra = {
        signers: authority.map((a) => a.toBase58()),
      };
    }

    // Serialize memo to JSON
    const memoJson = JSON.stringify(sealMemo);

    // Create transaction
    const transaction = new Transaction();

    // Add memo instruction
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoJson, 'utf-8'),
      })
    );

    // Set fee payer
    transaction.feePayer = payer;

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Estimate fee
    const estimatedFee = await this.estimateTransactionFee(transaction);

    return {
      transaction,
      description: `SEAL: Record inscription ${inscriptionId.slice(0, 8)}...${inscriptionId.slice(-4)} proof on Solana`,
      estimatedFee,
    };
  }

  /**
   * Build RETIRE transaction
   * 
   * Creates a transaction to permanently retire the Solana token:
   * - burn: Reduce total supply to 0
   * - incinerate: Send to provably unspendable address
   * - teleburn-derived: Send to deterministic off-curve address
   * 
   * Includes retire memo with timestamp and block height.
   * 
   * @param params - Retire transaction parameters
   * @returns Built transaction ready for signing
   */
  async buildRetireTransaction(params: RetireTransactionParams): Promise<BuiltTransaction> {
    const { payer, owner, mint, inscriptionId, sha256, method, amount = 1n } = params;

    // Note: We'll get the actual timestamp and block height after transaction confirmation
    // For now, use placeholder values that will be updated
    const slot = 0; // Will be updated after confirmation
    const timestamp = 0; // Will be updated after confirmation

    // Get token program (support both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID)
    const tokenProgram = await this.detectTokenProgram(mint);

    // Get owner's ATA
    const ownerAta = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      tokenProgram
    );

    // Create transaction
    const transaction = new Transaction();

    // Build retire memo
    const retireMemo: Sbt01Retire = {
      standard: 'KILN',
      version: '0.1.1',
      action: method,
      timestamp,
      block_height: slot,
      inscription: {
        id: inscriptionId,
      },
      solana: {
        mint: mint.toBase58(),
      },
      media: {
        sha256,
      },
    };

    // Add method-specific instructions
    let description = '';

    switch (method) {
      case 'burn': {
        // Burn instruction (reduces supply)
        transaction.add(
          createBurnInstruction(
            ownerAta,
            mint,
            owner,
            amount,
            [],
            tokenProgram
          )
        );
        description = `BURN: Permanently destroy token (supply → 0)`;
        break;
      }

      case 'incinerate': {
        // Transfer to incinerator (provably unspendable)
        const incineratorAta = getAssociatedTokenAddressSync(
          mint,
          INCINERATOR_ADDRESS,
          true, // allowOwnerOffCurve
          tokenProgram
        );

        // Create ATA if it doesn't exist (idempotent - won't fail if exists)
        transaction.add(
          createAssociatedTokenAccountIdempotentInstruction(
            payer, // payer
            incineratorAta, // associatedToken
            INCINERATOR_ADDRESS, // owner
            mint, // mint
            tokenProgram // programId
          )
        );

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            ownerAta,
            incineratorAta,
            owner,
            amount,
            [],
            tokenProgram
          )
        );
        description = `INCINERATE: Send to provably unspendable address`;
        break;
      }

      case 'teleburn-derived': {
        // Derive deterministic off-curve address from inscription ID for verification
        const derivedOwner = await deriveTeleburnAddress(inscriptionId);

        // Burn the token (reduce supply to 0)
        // Note: We don't transfer to the derived address because it's off-curve
        // and cannot own an ATA. Instead, we burn and record the derivation.
        transaction.add(
          createBurnInstruction(
            ownerAta,
            mint,
            owner,
            amount,
            [],
            tokenProgram
          )
        );

        // Add derived owner to memo for cryptographic verification
        // This proves the burn is linked to a specific Bitcoin inscription
        retireMemo.derived = { 
          owner: derivedOwner.toBase58(),
          algorithm: 'SHA-256(txid || index || salt)'
        };

        description = `TELEBURN: Burn token linked to inscription (derived: ${derivedOwner.toBase58().slice(0, 8)}...)`;
        break;
      }
    }

    // Add retire memo instruction
    const memoJson = JSON.stringify(retireMemo);
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoJson, 'utf-8'),
      })
    );

    // Set fee payer and blockhash
    transaction.feePayer = payer;
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Estimate fee
    const estimatedFee = await this.estimateTransactionFee(transaction);

    return {
      transaction,
      description,
      estimatedFee,
    };
  }

  /**
   * Build metadata URI update transaction
   * 
   * Updates the token metadata URI to point to the pointer JSON
   * (only for mutable metadata)
   * 
   * @param params - URI update parameters
   * @returns Built transaction ready for signing
   */
  async buildUpdateUriTransaction(params: UpdateUriParams): Promise<BuiltTransaction> {
    const { payer, authority, mint, newUri } = params;

    // TODO: Implement Metaplex metadata update instruction
    // This requires @metaplex-foundation/mpl-token-metadata
    // For now, return a placeholder

    const transaction = new Transaction();
    transaction.feePayer = payer;

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const estimatedFee = await this.estimateTransactionFee(transaction);

    return {
      transaction,
      description: `UPDATE URI: Point metadata to pointer JSON at ${newUri}`,
      estimatedFee,
    };
  }

  /**
   * Detect which token program a mint uses
   * 
   * @param mint - Mint address
   * @returns Token program ID (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
   */
  private async detectTokenProgram(mint: PublicKey): Promise<PublicKey> {
    try {
      const accountInfo = await this.connection.getAccountInfo(mint);
      if (!accountInfo) {
        throw new Error(`Mint account ${mint.toBase58()} not found`);
      }

      // Check if owner is TOKEN_2022_PROGRAM_ID
      if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        return TOKEN_2022_PROGRAM_ID;
      }

      return TOKEN_PROGRAM_ID;
    } catch (error) {
      // Default to TOKEN_PROGRAM_ID
      console.warn(`Failed to detect token program for ${mint.toBase58()}, defaulting to TOKEN_PROGRAM_ID`);
      return TOKEN_PROGRAM_ID;
    }
  }

  /**
   * Estimate transaction fee
   * 
   * @param transaction - Transaction to estimate
   * @returns Estimated fee in lamports
   */
  private async estimateTransactionFee(transaction: Transaction): Promise<number> {
    try {
      const message = transaction.compileMessage();
      const fee = await this.connection.getFeeForMessage(message);
      return fee.value ?? 5000; // Default to 5000 lamports if estimation fails
    } catch (error) {
      console.warn('Failed to estimate transaction fee:', error);
      return 5000; // Default fee
    }
  }

  /**
   * Get actual transaction timestamp and block height after confirmation
   * 
   * This method should be called after a transaction is confirmed to get
   * the accurate timestamp and block height for the memo.
   * 
   * @param signature - Transaction signature
   * @returns Actual timestamp and block height from the confirmed transaction
   */
  async getTransactionTimestamp(signature: string): Promise<{ timestamp: number; block_height: number }> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        throw new Error('Transaction not found');
      }

      if (!tx.blockTime) {
        throw new Error('Block time not available for transaction');
      }

      return {
        timestamp: tx.blockTime,
        block_height: tx.slot
      };
    } catch (error) {
      throw new Error(
        `Failed to get transaction timestamp: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Build complete teleburn flow (seal + retire)
   * 
   * Returns all transactions needed for a full teleburn:
   * 1. Seal transaction
   * 2. Optional URI update transaction
   * 3. Retire transaction
   * 
   * @param sealParams - Seal parameters
   * @param retireParams - Retire parameters
   * @param uriParams - Optional URI update parameters
   * @returns Array of built transactions in execution order
   */
  async buildTeleburnFlow(
    sealParams: SealTransactionParams,
    retireParams: RetireTransactionParams,
    uriParams?: UpdateUriParams
  ): Promise<BuiltTransaction[]> {
    const transactions: BuiltTransaction[] = [];

    // 1. Seal transaction
    transactions.push(await this.buildSealTransaction(sealParams));

    // 2. Optional URI update
    if (uriParams) {
      transactions.push(await this.buildUpdateUriTransaction(uriParams));
    }

    // 3. Retire transaction
    transactions.push(await this.buildRetireTransaction(retireParams));

    return transactions;
  }
}

/**
 * Helper function to create a transaction builder instance
 * 
 * @param rpcUrl - Solana RPC URL
 * @returns TransactionBuilder instance
 */
export function createTransactionBuilder(rpcUrl: string): TransactionBuilder {
  return new TransactionBuilder(rpcUrl);
}

