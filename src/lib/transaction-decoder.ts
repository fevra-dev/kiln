// src/lib/transaction-decoder.ts
/**
 * KILN.1 Transaction Decoder
 * 
 * Decodes Solana transactions into human-readable format.
 * Shows:
 * - Program invocations
 * - Account roles (signer, writable, read-only)
 * - Instruction data interpretation
 * - Fee estimation
 * 
 * Critical for dry run mode and user transparency.
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
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { MEMO_PROGRAM_ID } from './transaction-builder';

/**
 * Account role in a transaction
 */
export enum AccountRole {
  Signer = 'signer',
  Writable = 'writable',
  ReadOnly = 'readonly',
  FeePayer = 'fee-payer',
}

/**
 * Decoded account information
 */
export interface DecodedAccount {
  pubkey: string;
  roles: AccountRole[];
  label?: string; // Human-readable label (e.g., "Token Account", "Mint")
}

/**
 * Decoded instruction information
 */
export interface DecodedInstruction {
  programId: string;
  programName: string;
  instructionName: string;
  accounts: DecodedAccount[];
  data?: string; // Hex-encoded data
  decodedData?: Record<string, unknown>; // Parsed instruction data
}

/**
 * Decoded transaction
 */
export interface DecodedTransaction {
  feePayer: string;
  recentBlockhash?: string;
  signatures: string[];
  instructions: DecodedInstruction[];
  estimatedFee: number; // in lamports
  estimatedComputeUnits?: number;
  warnings: string[];
}

/**
 * Known program IDs and their names
 */
const KNOWN_PROGRAMS: Record<string, string> = {
  [SystemProgram.programId.toBase58()]: 'System Program',
  [TOKEN_PROGRAM_ID.toBase58()]: 'SPL Token',
  [TOKEN_2022_PROGRAM_ID.toBase58()]: 'SPL Token-2022',
  [ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()]: 'Associated Token Program',
  [MEMO_PROGRAM_ID.toBase58()]: 'SPL Memo',
  '11111111111111111111111111111111': 'System Program',
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'SPL Memo',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': 'SPL Token-2022',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Program',
};

/**
 * SPL Token instruction discriminators (first byte)
 */
enum TokenInstruction {
  InitializeMint = 0,
  InitializeAccount = 1,
  InitializeMultisig = 2,
  Transfer = 3,
  Approve = 4,
  Revoke = 5,
  SetAuthority = 6,
  MintTo = 7,
  Burn = 8,
  CloseAccount = 9,
  FreezeAccount = 10,
  ThawAccount = 11,
  TransferChecked = 12,
  ApproveChecked = 13,
  MintToChecked = 14,
  BurnChecked = 15,
}

/**
 * Transaction Decoder Service
 */
export class TransactionDecoder {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Decode a transaction into human-readable format
   * 
   * @param transaction - Transaction to decode
   * @returns Decoded transaction details
   */
  async decodeTransaction(transaction: Transaction): Promise<DecodedTransaction> {
    const warnings: string[] = [];
    const instructions: DecodedInstruction[] = [];

    // Get fee payer
    const feePayer = transaction.feePayer?.toBase58() || 'Unknown';

    // Get signatures
    const signatures = transaction.signatures.map((sig) => 
      sig.signature ? Buffer.from(sig.signature).toString('hex') : 'Unsigned'
    );

    // Decode each instruction
    for (let i = 0; i < transaction.instructions.length; i++) {
      const ix = transaction.instructions[i];
      if (ix) {
        const decoded = await this.decodeInstruction(ix, i, transaction);
        instructions.push(decoded);
      }
    }

    // Estimate fee
    let estimatedFee = 5000; // Default 5000 lamports
    try {
      const message = transaction.compileMessage();
      const feeResponse = await this.connection.getFeeForMessage(message);
      estimatedFee = feeResponse.value ?? 5000;
    } catch (error) {
      warnings.push('Failed to estimate transaction fee');
    }

    // Check for potential issues
    if (!transaction.recentBlockhash) {
      warnings.push('Transaction missing recent blockhash');
    }

    if (transaction.signatures.length === 0) {
      warnings.push('Transaction not signed');
    }

    return {
      feePayer,
      recentBlockhash: transaction.recentBlockhash,
      signatures,
      instructions,
      estimatedFee,
      warnings,
    };
  }

  /**
   * Decode a single instruction
   * 
   * @param instruction - Instruction to decode
   * @param index - Instruction index in transaction
   * @param transaction - Parent transaction for context
   * @returns Decoded instruction
   */
  private async decodeInstruction(
    instruction: TransactionInstruction,
    _index: number,
    _transaction: Transaction
  ): Promise<DecodedInstruction> {
    const programId = instruction.programId.toBase58();
    const programName = KNOWN_PROGRAMS[programId] || `Unknown Program (${programId.slice(0, 8)}...)`;

    // Decode accounts
    const accounts: DecodedAccount[] = instruction.keys.map((meta) => {
      const roles: AccountRole[] = [];
      if (meta.isSigner) roles.push(AccountRole.Signer);
      if (meta.isWritable) roles.push(AccountRole.Writable);
      if (!meta.isWritable) roles.push(AccountRole.ReadOnly);

      return {
        pubkey: meta.pubkey.toBase58(),
        roles,
        label: this.labelAccount(meta.pubkey, programId),
      };
    });

    // Decode instruction based on program
    let instructionName = 'Unknown Instruction';
    let decodedData: Record<string, unknown> | undefined;

    if (programId === MEMO_PROGRAM_ID.toBase58()) {
      instructionName = 'Add Memo';
      try {
        const memoText = instruction.data.toString('utf-8');
        decodedData = { memo: memoText };
        
        // Try to parse as KILN.1 JSON
        try {
          const json = JSON.parse(memoText);
          if (json.standard === 'KILN' && json.action) {
            instructionName = `KILN.1 ${json.action.toUpperCase()} Memo`;
            decodedData = { sbt01: json };
          }
        } catch {
          // Not JSON, regular memo
        }
      } catch {
        decodedData = { memo: '<binary data>' };
      }
    } else if (
      programId === TOKEN_PROGRAM_ID.toBase58() ||
      programId === TOKEN_2022_PROGRAM_ID.toBase58()
    ) {
      const decoded = this.decodeTokenInstruction(instruction);
      instructionName = decoded.name;
      decodedData = decoded.data;
    } else if (programId === SystemProgram.programId.toBase58()) {
      instructionName = 'System Instruction';
      // TODO: Decode system instructions
    }

    return {
      programId,
      programName,
      instructionName,
      accounts,
      data: instruction.data.toString('hex'),
      decodedData,
    };
  }

  /**
   * Decode SPL Token instruction
   * 
   * @param instruction - Token instruction
   * @returns Decoded instruction name and data
   */
  private decodeTokenInstruction(instruction: TransactionInstruction): {
    name: string;
    data?: Record<string, unknown>;
  } {
    if (instruction.data.length === 0) {
      return { name: 'Unknown Token Instruction' };
    }

    const discriminator = instruction.data[0];

    switch (discriminator) {
      case TokenInstruction.Transfer:
        return {
          name: 'Transfer',
          data: this.decodeTransferInstruction(instruction.data),
        };
      
      case TokenInstruction.TransferChecked:
        return {
          name: 'Transfer (Checked)',
          data: this.decodeTransferCheckedInstruction(instruction.data),
        };

      case TokenInstruction.Burn:
        return {
          name: 'Burn',
          data: this.decodeBurnInstruction(instruction.data),
        };

      case TokenInstruction.BurnChecked:
        return {
          name: 'Burn (Checked)',
          data: this.decodeBurnCheckedInstruction(instruction.data),
        };

      case TokenInstruction.MintTo:
        return {
          name: 'Mint To',
          data: { discriminator },
        };

      case TokenInstruction.Approve:
        return {
          name: 'Approve',
          data: { discriminator },
        };

      case TokenInstruction.CloseAccount:
        return {
          name: 'Close Account',
          data: { discriminator },
        };

      default:
        return {
          name: `Token Instruction (${discriminator})`,
          data: { discriminator },
        };
    }
  }

  /**
   * Decode Transfer instruction data
   */
  private decodeTransferInstruction(data: Buffer): Record<string, unknown> {
    if (data.length < 9) return { error: 'Invalid data length' };
    
    // Transfer layout: [u8 instruction, u64 amount]
    const amount = data.readBigUInt64LE(1);
    return { amount: amount.toString() };
  }

  /**
   * Decode TransferChecked instruction data
   */
  private decodeTransferCheckedInstruction(data: Buffer): Record<string, unknown> {
    if (data.length < 10) return { error: 'Invalid data length' };
    
    // TransferChecked layout: [u8 instruction, u64 amount, u8 decimals]
    const amount = data.readBigUInt64LE(1);
    const decimals = data.readUInt8(9);
    return { amount: amount.toString(), decimals };
  }

  /**
   * Decode Burn instruction data
   */
  private decodeBurnInstruction(data: Buffer): Record<string, unknown> {
    if (data.length < 9) return { error: 'Invalid data length' };
    
    // Burn layout: [u8 instruction, u64 amount]
    const amount = data.readBigUInt64LE(1);
    return { amount: amount.toString() };
  }

  /**
   * Decode BurnChecked instruction data
   */
  private decodeBurnCheckedInstruction(data: Buffer): Record<string, unknown> {
    if (data.length < 10) return { error: 'Invalid data length' };
    
    // BurnChecked layout: [u8 instruction, u64 amount, u8 decimals]
    const amount = data.readBigUInt64LE(1);
    const decimals = data.readUInt8(9);
    return { amount: amount.toString(), decimals };
  }

  /**
   * Label an account based on its role
   * 
   * @param pubkey - Account public key
   * @param programId - Program ID for context
   * @returns Human-readable label
   */
  private labelAccount(pubkey: PublicKey, programId: string): string | undefined {
    const pubkeyStr = pubkey.toBase58();

    // Check for well-known addresses
    if (pubkeyStr === '11111111111111111111111111111111') {
      return 'System Program';
    }

    if (pubkeyStr === '1nc1nerator11111111111111111111111111111111') {
      return 'Incinerator (Unspendable)';
    }

    if (KNOWN_PROGRAMS[pubkeyStr]) {
      return KNOWN_PROGRAMS[pubkeyStr];
    }

    // Context-based labeling
    if (
      programId === TOKEN_PROGRAM_ID.toBase58() ||
      programId === TOKEN_2022_PROGRAM_ID.toBase58()
    ) {
      // Could be token account, mint, or authority
      // Without on-chain queries, we can't determine for sure
      return 'Token Account/Mint';
    }

    return undefined;
  }

  /**
   * Decode multiple transactions in a flow
   * 
   * @param transactions - Array of transactions
   * @returns Array of decoded transactions
   */
  async decodeTransactionFlow(transactions: Transaction[]): Promise<DecodedTransaction[]> {
    const decoded: DecodedTransaction[] = [];

    for (const tx of transactions) {
      decoded.push(await this.decodeTransaction(tx));
    }

    return decoded;
  }
}

/**
 * Helper function to create a transaction decoder instance
 * 
 * @param rpcUrl - Solana RPC URL
 * @returns TransactionDecoder instance
 */
export function createTransactionDecoder(rpcUrl: string): TransactionDecoder {
  return new TransactionDecoder(rpcUrl);
}

