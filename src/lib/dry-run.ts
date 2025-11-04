// src/lib/dry-run.ts
/**
 * KILN.1 Dry Run Service
 * 
 * Simulates entire teleburn flow without signing or broadcasting:
 * 1. Build single burn+memo transaction (replaces separate seal/retire)
 * 2. Decode transaction to show human-readable details
 * 3. Simulate transaction on-chain (no side effects)
 * 4. Calculate total fees
 * 5. Identify any warnings or errors
 * 6. Generate downloadable rehearsal receipt
 * 
 * CRITICAL: No transactions are signed or sent. Zero risk.
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TransactionBuilder, TeleburnMethod, type UpdateUriParams } from './transaction-builder';
import { TransactionDecoder, type DecodedTransaction } from './transaction-decoder';
import { buildBurnMemoTransaction } from './local-burn/build-burn-memo-tx';

/**
 * Simulation result for a single transaction
 */
export interface SimulationResult {
  success: boolean;
  logs?: string[];
  unitsConsumed?: number;
  error?: string;
}

/**
 * Dry run step (one transaction in the flow)
 */
export interface DryRunStep {
  name: string;
  description: string;
  transaction: Transaction;
  decoded: DecodedTransaction;
  simulation: SimulationResult;
  estimatedFee: number;
}

/**
 * Complete dry run report
 */
export interface DryRunReport {
  mode: 'dry-run';
  timestamp: string;
  mint: string;
  inscriptionId: string;
  method: TeleburnMethod;
  steps: DryRunStep[];
  totalEstimatedFee: number;
  totalComputeUnits: number;
  warnings: string[];
  errors: string[];
  success: boolean;
  debug?: {
    tokenAccountAddresses?: {
      mint: string;
      owner: string;
      ataSPL: string;
      ataToken2022: string;
    };
    tokenAccountState?: {
      splToken?: {
        address: string;
        exists: boolean;
        amount: string;
        isFrozen: boolean;
        owner: string;
        mint: string;
      };
      token2022?: {
        address: string;
        exists: boolean;
        amount: string;
        isFrozen: boolean;
        owner: string;
        mint: string;
      };
    };
    mintInfo?: {
      mint: string;
      owner: string;
      isToken2022: boolean;
      isSPLToken: boolean;
    };
    rpcUrl?: string;
    fallbackSuccess?: boolean;
    fallbackRpcUrl?: string;
    pnftDetection?: {
      basicDetection: boolean;
      solIncineratorAvailable: boolean;
      solIncineratorDetection: boolean;
      finalDetection: boolean;
    };
  };
}

/**
 * Dry run parameters
 */
export interface DryRunParams {
  // Seal params
  payer: PublicKey;
  mint: PublicKey;
  inscriptionId: string;
  sha256: string;
  authority?: PublicKey[];

  // Retire params
  owner: PublicKey;
  method: TeleburnMethod;
  amount?: bigint;

  // Optional URI update
  updateUri?: {
    authority: PublicKey;
    newUri: string;
  };

  // RPC
  rpcUrl: string;
}

/**
 * Dry Run Service
 * 
 * Orchestrates complete teleburn simulation without signing
 */
export class DryRunService {
  private connection: Connection;
  private builder: TransactionBuilder;
  private decoder: TransactionDecoder;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.builder = new TransactionBuilder(rpcUrl);
    this.decoder = new TransactionDecoder(rpcUrl);
  }

  /**
   * Execute complete dry run
   * 
   * Builds, decodes, and simulates all transactions in the teleburn flow.
   * Returns comprehensive report with no side effects.
   * 
   * @param params - Dry run parameters
   * @returns Complete dry run report
   */
  async executeDryRun(params: DryRunParams): Promise<DryRunReport> {
    const steps: DryRunStep[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let totalEstimatedFee = 0;
    let totalComputeUnits = 0;
    
    // Initialize debug info for troubleshooting
    const debugInfo: DryRunReport['debug'] = {
      rpcUrl: params.rpcUrl,
      tokenAccountState: {},
      tokenAccountAddresses: undefined,
      mintInfo: undefined,
      fallbackSuccess: undefined,
      fallbackRpcUrl: undefined
    };

    try {
      // Step 1: Build single BURN+MEMO transaction
      console.log(`🔥 DRY RUN: Building single burn+memo transaction...`);
      
      let burnMemoTx: Transaction | VersionedTransaction;
      let burnMemoDecoded: DecodedTransaction;
      let burnMemoSimulation: SimulationResult;
      let burnMemoEstimatedFee = 5000; // Default estimate
      let nftType: 'PNFT' | 'REGULAR' = 'REGULAR';
      
      try {
        // Build the burn+memo transaction using Metaplex
        const burnMemoResult = await buildBurnMemoTransaction(
          params.rpcUrl,
          params.mint.toBase58(),
          params.owner.toBase58(),
          params.inscriptionId,
          params.sha256,
          2_000 // priority microlamports
        );
        
        nftType = burnMemoResult.nftType;
        
        // Parse the transaction
        const txBuffer = Buffer.from(burnMemoResult.transaction, 'base64');
        if (burnMemoResult.isVersioned) {
          burnMemoTx = VersionedTransaction.deserialize(txBuffer);
        } else {
          burnMemoTx = Transaction.from(txBuffer);
        }
        
        // Convert to Transaction for decoding/simulation (if needed)
        let txForSimulation: Transaction;
        if (burnMemoTx instanceof VersionedTransaction) {
          // For simulation, we need to convert versioned to legacy temporarily
          // Or we can simulate the versioned transaction directly
          txForSimulation = new Transaction();
          // Note: This is a simplified approach - in practice, we'd need to properly convert
          // For now, we'll simulate the versioned transaction directly
        } else {
          txForSimulation = burnMemoTx;
        }
        
        // Decode and simulate
        if (burnMemoTx instanceof VersionedTransaction) {
          // For versioned transactions, create a mock decoded transaction
          burnMemoDecoded = {
            feePayer: params.payer.toBase58(),
            recentBlockhash: undefined,
            signatures: [],
            instructions: [{
              programId: 'Metaplex Token Metadata',
              programName: 'Metaplex',
              instructionName: 'Burn V1',
              accounts: [],
              data: 'Burn + Memo',
            }],
            estimatedFee: burnMemoEstimatedFee,
            warnings: [],
          };
          
          // Simulate versioned transaction
          const simulation = await this.connection.simulateTransaction(burnMemoTx);
          burnMemoSimulation = {
            success: !simulation.value.err,
            logs: simulation.value.logs || [],
            unitsConsumed: simulation.value.unitsConsumed || 0,
            error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
          };
        } else {
          burnMemoDecoded = await this.decoder.decodeTransaction(txForSimulation, true);
          burnMemoSimulation = await this.simulateTransaction(txForSimulation);
        }
        
        // Estimate fee from simulation
        if (burnMemoSimulation.unitsConsumed) {
          // Rough estimate: base fee + compute units
          burnMemoEstimatedFee = 5000 + Math.ceil(burnMemoSimulation.unitsConsumed / 1000000) * 1000;
        }
        
      } catch (error) {
        console.error(`❌ DRY RUN: Failed to build burn+memo transaction:`, error);
        errors.push(`BURN+MEMO transaction build failed: ${error instanceof Error ? error.message : String(error)}`);
        
        // Create error state
        burnMemoTx = new Transaction();
        burnMemoDecoded = {
          feePayer: params.payer.toBase58(),
          recentBlockhash: undefined,
          signatures: [],
          instructions: [],
          estimatedFee: 5000,
          warnings: ['Transaction build failed'],
        };
        burnMemoSimulation = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      steps.push({
        name: 'burn-memo',
        description: `BURN + MEMO: Burn ${nftType} and record teleburn proof in single transaction`,
        transaction: burnMemoTx instanceof VersionedTransaction ? new Transaction() : burnMemoTx, // Convert for compatibility
        decoded: burnMemoDecoded,
        simulation: burnMemoSimulation,
        estimatedFee: burnMemoEstimatedFee,
      });

      totalEstimatedFee += burnMemoEstimatedFee;
      totalComputeUnits += burnMemoSimulation.unitsConsumed || 0;

      if (!burnMemoSimulation.success) {
        errors.push(`BURN+MEMO simulation failed: ${burnMemoSimulation.error}`);
      }

      warnings.push(...burnMemoDecoded.warnings);

      // Step 2: Optional URI update
      if (params.updateUri) {
        const uriParams: UpdateUriParams = {
          payer: params.payer,
          authority: params.updateUri.authority,
          mint: params.mint,
          newUri: params.updateUri.newUri,
          rpcUrl: params.rpcUrl,
        };

        const uriTx = await this.builder.buildUpdateUriTransaction(uriParams);
        const uriDecoded = await this.decoder.decodeTransaction(uriTx.transaction, true);
        const uriSimulation = await this.simulateTransaction(uriTx.transaction);

        steps.push({
          name: 'update-uri',
          description: uriTx.description,
          transaction: uriTx.transaction,
          decoded: uriDecoded,
          simulation: uriSimulation,
          estimatedFee: uriTx.estimatedFee,
        });

        totalEstimatedFee += uriTx.estimatedFee;
        totalComputeUnits += uriSimulation.unitsConsumed || 0;

        if (!uriSimulation.success) {
          warnings.push(`URI update simulation failed: ${uriSimulation.error}`);
        }

        warnings.push(...uriDecoded.warnings);
      }

      // Additional validation checks
      await this.validateDryRun(params, warnings, errors);
      
      // Pre-transaction validation
      await this.validatePreTransaction(params, warnings, errors);

    } catch (error) {
      errors.push(`Dry run failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const success = errors.length === 0;

    return {
      mode: 'dry-run',
      timestamp: new Date().toISOString(),
      mint: params.mint.toBase58(),
      inscriptionId: params.inscriptionId,
      method: params.method,
      steps,
      totalEstimatedFee,
      totalComputeUnits,
      warnings: [...new Set(warnings)], // Deduplicate
      errors: [...new Set(errors)],     // Deduplicate
      success,
      debug: debugInfo, // Add debug information
    };
  }

  /**
   * Simulate a transaction on-chain without sending
   * 
   * @param transaction - Transaction to simulate
   * @returns Simulation result
   */
  private async simulateTransaction(transaction: Transaction): Promise<SimulationResult> {
    try {
      // Ensure transaction has a recent blockhash
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      // Simulate transaction
      const simulation = await this.connection.simulateTransaction(transaction, undefined, true);

      if (simulation.value.err) {
        return {
          success: false,
          logs: simulation.value.logs || [],
          error: JSON.stringify(simulation.value.err),
        };
      }

      return {
        success: true,
        logs: simulation.value.logs || [],
        unitsConsumed: simulation.value.unitsConsumed || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Perform additional validation checks
   * 
   * @param params - Dry run parameters
   * @param warnings - Array to add warnings to
   * @param errors - Array to add errors to
   */
  private async validateDryRun(
    params: DryRunParams,
    warnings: string[],
    errors: string[]
  ): Promise<void> {
    try {
      // Check if payer has sufficient balance
      const payerBalance = await this.connection.getBalance(params.payer);
      const minimumBalance = 10_000_000; // 0.01 SOL

      if (payerBalance < minimumBalance) {
        warnings.push(`Payer balance (${payerBalance / 1e9} SOL) may be insufficient for transaction fees and rent`);
      }

      // Check if mint exists
      const mintInfo = await this.connection.getAccountInfo(params.mint);
      if (!mintInfo) {
        errors.push(`Mint account ${params.mint.toBase58()} does not exist`);
      }

      // Check if owner has tokens to retire
      // Note: This requires fetching token account - skipping for now to avoid complexity

      // Validate inscription ID format
      if (!/^[0-9a-f]{64}i\d+$/i.test(params.inscriptionId)) {
        errors.push(`Invalid inscription ID format: ${params.inscriptionId}`);
      }

      // Validate SHA-256 format
      if (!/^[0-9a-f]{64}$/i.test(params.sha256)) {
        errors.push(`Invalid SHA-256 hash format: ${params.sha256}`);
      }

    } catch (error) {
      warnings.push(`Validation check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pre-transaction validation checks
   * 
   * @param params - Dry run parameters
   * @param warnings - Warnings array
   * @param errors - Errors array
   */
  private async validatePreTransaction(
    params: DryRunParams,
    warnings: string[],
    errors: string[]
  ): Promise<void> {
    try {
      // Check SOL balance (only warn, don't error - simulation will catch actual issues)
      const payerBalance = await this.connection.getBalance(params.payer);
      const estimatedFee = 0.00001; // ~0.00001 SOL for burn transaction
      
      if (payerBalance < estimatedFee * 1e9) {
        warnings.push(`💰 LOW SOL BALANCE: Wallet has ${(payerBalance / 1e9).toFixed(6)} SOL, recommend at least ${estimatedFee} SOL`);
      }

      // Check if token account exists for the owner
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        params.owner,
        { mint: params.mint }
      );

      if (tokenAccounts.value.length === 0) {
        errors.push(`🔍 NO TOKEN ACCOUNT: Owner doesn't have an Associated Token Account for this NFT`);
        errors.push(`   The NFT may not be in this wallet or the token account doesn't exist.`);
      } else {
        // Check token balance
        const tokenAccount = tokenAccounts.value[0];
        if (tokenAccount) {
          const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount.pubkey);
          
          if (accountInfo.value.uiAmount === 0) {
            errors.push(`🔍 NO TOKENS: Token account exists but has 0 balance`);
            errors.push(`   The NFT may have been transferred out of this wallet.`);
          }
        }
      }

    } catch (error) {
      warnings.push(`Pre-transaction validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 
   * @param report - Dry run report
   * @returns JSON string ready for download
   */
  static generateRehearsalReceipt(report: DryRunReport): string {
    // Create simplified receipt for user download
    const receipt = {
      mode: report.mode,
      timestamp: report.timestamp,
      mint: report.mint,
      inscription: report.inscriptionId,
      method: report.method,
      
      planned_transactions: report.steps.map((step) => ({
        name: step.name,
        description: step.description,
        programs: step.decoded.instructions.map((ix) => ix.programName),
        accounts: step.decoded.instructions.flatMap((ix) => 
          ix.accounts.map((acc) => ({
            pubkey: acc.pubkey,
            roles: acc.roles,
            label: acc.label,
          }))
        ),
        estimated_fee_lamports: step.estimatedFee,
        estimated_fee_sol: step.estimatedFee / 1e9,
        simulation_success: step.simulation.success,
        simulation_error: step.simulation.error,
        compute_units: step.simulation.unitsConsumed,
      })),

      total_fees: {
        lamports: report.totalEstimatedFee,
        sol: report.totalEstimatedFee / 1e9,
      },

      total_compute_units: report.totalComputeUnits,

      warnings: report.warnings,
      errors: report.errors,
      success: report.success,

      metadata: {
        generated_at: report.timestamp,
        sbt01_version: '0.1.1',
        tool: 'KILN.1 Teleburn Dry Run',
      },
    };

    return JSON.stringify(receipt, null, 2);
  }

  /**
   * Estimate total SOL cost for entire teleburn flow
   * 
   * @param params - Dry run parameters
   * @returns Estimated total cost in SOL
   */
  async estimateTotalCost(params: DryRunParams): Promise<number> {
    const report = await this.executeDryRun(params);
    return report.totalEstimatedFee / 1e9; // Convert lamports to SOL
  }

  /**
   * Quick validation check (fast, no full simulation)
   * 
   * @param params - Dry run parameters
   * @returns Array of validation errors (empty if valid)
   */
  async quickValidate(params: DryRunParams): Promise<string[]> {
    const errors: string[] = [];

    // Format checks (fast, no RPC calls)
    if (!/^[0-9a-f]{64}i\d+$/i.test(params.inscriptionId)) {
      errors.push('Invalid inscription ID format');
    }

    if (!/^[0-9a-f]{64}$/i.test(params.sha256)) {
      errors.push('Invalid SHA-256 hash format');
    }

    // Basic RPC checks
    try {
      const mintInfo = await this.connection.getAccountInfo(params.mint);
      if (!mintInfo) {
        errors.push('Mint account does not exist');
      }

      const payerBalance = await this.connection.getBalance(params.payer);
      if (payerBalance < 5000) {
        errors.push('Payer has insufficient balance');
      }
    } catch (error) {
      errors.push(`RPC error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return errors;
  }
}

/**
 * Helper function to create a dry run service instance
 * 
 * @param rpcUrl - Solana RPC URL
 * @returns DryRunService instance
 */
export function createDryRunService(rpcUrl: string): DryRunService {
  return new DryRunService(rpcUrl);
}

