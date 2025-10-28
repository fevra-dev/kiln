// src/lib/dry-run.ts
/**
 * KILN.1 Dry Run Service
 * 
 * Simulates entire teleburn flow without signing or broadcasting:
 * 1. Build all transactions (seal, retire, optional URI update)
 * 2. Decode each transaction to show human-readable details
 * 3. Simulate each transaction on-chain (no side effects)
 * 4. Calculate total fees
 * 5. Identify any warnings or errors
 * 6. Generate downloadable rehearsal receipt
 * 
 * CRITICAL: No transactions are signed or sent. Zero risk.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TransactionBuilder, TeleburnMethod, type SealTransactionParams, type RetireTransactionParams, type UpdateUriParams } from './transaction-builder';
import { TransactionDecoder, type DecodedTransaction } from './transaction-decoder';

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
      // Step 1: Build SEAL transaction
      const sealParams: SealTransactionParams = {
        payer: params.payer,
        mint: params.mint,
        inscriptionId: params.inscriptionId,
        sha256: params.sha256,
        authority: params.authority,
        rpcUrl: params.rpcUrl,
      };

      const sealTx = await this.builder.buildSealTransaction(sealParams);
      const sealDecoded = await this.decoder.decodeTransaction(sealTx.transaction);
      const sealSimulation = await this.simulateTransaction(sealTx.transaction);

      steps.push({
        name: 'seal',
        description: sealTx.description,
        transaction: sealTx.transaction,
        decoded: sealDecoded,
        simulation: sealSimulation,
        estimatedFee: sealTx.estimatedFee,
      });

      totalEstimatedFee += sealTx.estimatedFee;
      totalComputeUnits += sealSimulation.unitsConsumed || 0;

      if (!sealSimulation.success) {
        errors.push(`SEAL simulation failed: ${sealSimulation.error}`);
      }

      warnings.push(...sealDecoded.warnings);

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
        const uriDecoded = await this.decoder.decodeTransaction(uriTx.transaction);
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

      // Step 3: RETIRE transaction
      const retireParams: RetireTransactionParams = {
        payer: params.payer,
        owner: params.owner,
        mint: params.mint,
        inscriptionId: params.inscriptionId,
        sha256: params.sha256,
        method: params.method,
        amount: params.amount,
        rpcUrl: params.rpcUrl,
      };

      console.log(`🔄 DRY RUN: Building RETIRE transaction...`);
      const retireTx = await this.builder.buildRetireTransaction(retireParams);
      console.log(`✅ DRY RUN: RETIRE transaction built successfully`);
      const retireDecoded = await this.decoder.decodeTransaction(retireTx.transaction);
      
      // CRITICAL DEBUG: Check actual token account state before simulation
      console.log(`🔍 DRY RUN: Checking token account state before simulation...`);
      
      try {
        const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
        const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
        
        // Get owner's ATA for both token programs
        const ownerAtaSPL = getAssociatedTokenAddressSync(params.mint, params.owner, false, TOKEN_PROGRAM_ID);
        const ownerAtaToken2022 = getAssociatedTokenAddressSync(params.mint, params.owner, false, TOKEN_2022_PROGRAM_ID);
        
        console.log(`🔍 DRY RUN: Token account addresses:`, {
          mint: params.mint.toBase58(),
          owner: params.owner.toBase58(),
          ataSPL: ownerAtaSPL.toBase58(),
          ataToken2022: ownerAtaToken2022.toBase58()
        });
        
        debugInfo.tokenAccountAddresses = {
          mint: params.mint.toBase58(),
          owner: params.owner.toBase58(),
          ataSPL: ownerAtaSPL.toBase58(),
          ataToken2022: ownerAtaToken2022.toBase58()
        };
        
        // Check SPL Token account state
        try {
          const splAccountInfo = await this.connection.getAccountInfo(ownerAtaSPL);
          if (splAccountInfo) {
            const { unpackAccount } = await import('@solana/spl-token');
            const splAccount = unpackAccount(ownerAtaSPL, splAccountInfo, TOKEN_PROGRAM_ID);
            const splAccountState = {
              address: ownerAtaSPL.toBase58(),
              exists: true,
              amount: splAccount.amount.toString(),
              isFrozen: splAccount.isFrozen,
              owner: splAccount.owner.toBase58(),
              mint: splAccount.mint.toBase58()
            };
            console.log(`🔍 DRY RUN: SPL Token account state:`, splAccountState);
            debugInfo.tokenAccountState!.splToken = splAccountState;
          } else {
            console.log(`🔍 DRY RUN: SPL Token account does not exist:`, ownerAtaSPL.toBase58());
          }
        } catch (error) {
          console.log(`🔍 DRY RUN: Error checking SPL Token account:`, error);
        }
        
        // Check Token-2022 account state
        try {
          const token2022AccountInfo = await this.connection.getAccountInfo(ownerAtaToken2022);
          if (token2022AccountInfo) {
            const { unpackAccount } = await import('@solana/spl-token');
            const token2022Account = unpackAccount(ownerAtaToken2022, token2022AccountInfo, TOKEN_2022_PROGRAM_ID);
            const token2022AccountState = {
              address: ownerAtaToken2022.toBase58(),
              exists: true,
              amount: token2022Account.amount.toString(),
              isFrozen: token2022Account.isFrozen,
              owner: token2022Account.owner.toBase58(),
              mint: token2022Account.mint.toBase58()
            };
            console.log(`🔍 DRY RUN: Token-2022 account state:`, token2022AccountState);
            debugInfo.tokenAccountState!.token2022 = token2022AccountState;
          } else {
            console.log(`🔍 DRY RUN: Token-2022 account does not exist:`, ownerAtaToken2022.toBase58());
          }
        } catch (error) {
          console.log(`🔍 DRY RUN: Error checking Token-2022 account:`, error);
        }
        
        // Check mint account to see which program owns it
        const mintInfo = await this.connection.getAccountInfo(params.mint);
        if (mintInfo) {
          const mintState = {
            mint: params.mint.toBase58(),
            owner: mintInfo.owner.toBase58(),
            isToken2022: mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID),
            isSPLToken: mintInfo.owner.equals(TOKEN_PROGRAM_ID)
          };
          console.log(`🔍 DRY RUN: Mint account info:`, mintState);
          debugInfo.mintInfo = mintState;
        }
        
      } catch (error) {
        console.log(`🔍 DRY RUN: Error checking token account state:`, error);
      }
      
      let retireSimulation = await this.simulateTransaction(retireTx.transaction);
      
      console.log(`🔍 DRY RUN: Initial simulation result:`, {
        success: retireSimulation.success,
        error: retireSimulation.error,
        errorType: typeof retireSimulation.error,
        logs: retireSimulation.logs
      });
      
      // If simulation fails with "Account is frozen", try with alternative token program
      const errorStr = retireSimulation.error ? String(retireSimulation.error) : '';
      const logsStr = retireSimulation.logs ? retireSimulation.logs.join(' ') : '';
      const hasFrozenError = errorStr.toLowerCase().includes('account is frozen') ||
                            errorStr.includes('Custom:17') ||
                            errorStr.includes('0x11') ||
                            logsStr.toLowerCase().includes('account is frozen');
      
      console.log(`🔍 DRY RUN: Frozen error detection:`, {
        errorStr,
        logsStr,
        hasFrozenError,
        willTryFallback: !retireSimulation.success && hasFrozenError
      });
      
      if (!retireSimulation.success && hasFrozenError) {
        
        console.log(`🔄 DRY RUN: Account frozen detected, trying alternative approaches...`);
        
        // First, try alternative token program
        console.log(`🔄 DRY RUN: Trying alternative token program...`);
        const alternativeRetireTx = await this.builder.buildRetireTransaction({
          ...retireParams,
          forceTokenProgram: 'TOKEN_2022_PROGRAM_ID' // Force Token-2022 program
        });
        
        const alternativeSimulation = await this.simulateTransaction(alternativeRetireTx.transaction);
        
        if (alternativeSimulation.success) {
          console.log(`✅ DRY RUN: Alternative token program succeeded!`);
          retireSimulation = alternativeSimulation;
          // Update the transaction and decoded data
          retireTx.transaction = alternativeRetireTx.transaction;
          retireTx.description = alternativeRetireTx.description + ' (using Token-2022 program fallback)';
        } else {
          console.log(`❌ DRY RUN: Alternative token program also failed`);
          
          // Second, try different RPC endpoint (RPC state inconsistency)
          console.log(`🔄 DRY RUN: Trying different RPC endpoint (RPC state issue)...`);
          const fallbackRpcUrl = 'https://api.mainnet-beta.solana.com'; // QuickNode public RPC
          
          if (params.rpcUrl !== fallbackRpcUrl) {
            console.log(`🔄 DRY RUN: Switching from ${params.rpcUrl} to ${fallbackRpcUrl}`);
            
            // Create new dry run service with fallback RPC
            const fallbackDryRun = new DryRunService(fallbackRpcUrl);
            
            // Try simulation with fallback RPC
            const fallbackSimulation = await fallbackDryRun.simulateTransaction(retireTx.transaction);
            
            if (fallbackSimulation.success) {
              console.log(`✅ DRY RUN: Fallback RPC succeeded! RPC state inconsistency confirmed.`);
              retireSimulation = fallbackSimulation;
              retireTx.description = retireTx.description + ' (using fallback RPC)';
              debugInfo.fallbackSuccess = true;
              debugInfo.fallbackRpcUrl = fallbackRpcUrl;
            } else {
              console.log(`❌ DRY RUN: Fallback RPC also failed`);
              debugInfo.fallbackSuccess = false;
              debugInfo.fallbackRpcUrl = fallbackRpcUrl;
            }
          } else {
            console.log(`🔄 DRY RUN: Already using fallback RPC, no other RPC to try`);
          }
        }
      }

      steps.push({
        name: 'retire',
        description: retireTx.description,
        transaction: retireTx.transaction,
        decoded: retireDecoded,
        simulation: retireSimulation,
        estimatedFee: retireTx.estimatedFee,
      });

      totalEstimatedFee += retireTx.estimatedFee;
      totalComputeUnits += retireSimulation.unitsConsumed || 0;
      
      console.log(`Retire transaction fee: ${retireTx.estimatedFee} lamports (${retireTx.estimatedFee / 1e9} SOL)`);
      console.log(`Total estimated fee so far: ${totalEstimatedFee} lamports (${totalEstimatedFee / 1e9} SOL)`);

      if (!retireSimulation.success) {
        errors.push(`RETIRE simulation failed: ${retireSimulation.error}`);
        
        // Enhanced error detection for common issues
        if (retireSimulation.error && typeof retireSimulation.error === 'string') {
          const errorStr = retireSimulation.error.toLowerCase();
          
          // Check for specific error patterns
          if (errorStr.includes('account is frozen')) {
            errors.push(`⚠️  PNFT DETECTED: This NFT appears to be a Programmable NFT (pNFT) with frozen transfer restrictions.`);
            errors.push(`   pNFTs cannot be burned while frozen. Contact the freeze authority to unfreeze the account.`);
            errors.push(`   Alternative: Use a different NFT or wait for freeze restrictions to be lifted.`);
          } else if (errorStr.includes('insufficient funds') || errorStr.includes('insufficient sol')) {
            errors.push(`💰 INSUFFICIENT SOL: Your wallet doesn't have enough SOL to cover transaction fees.`);
            errors.push(`   Required: ~0.000005 SOL minimum. Add more SOL to your wallet and try again.`);
          } else if (errorStr.includes('account not found') || errorStr.includes('invalid account')) {
            errors.push(`🔍 ACCOUNT ISSUE: Token account or associated token account may not exist.`);
            errors.push(`   Try refreshing the page or reconnecting your wallet.`);
          } else if (errorStr.includes('custom') && errorStr.includes('17')) {
            errors.push(`⚠️  TOKEN PROGRAM ERROR: Custom error 17 detected.`);
            errors.push(`   This is most likely: Account is frozen (pNFT freeze restrictions)`);
            errors.push(`   Check if this is a Programmable NFT (pNFT) with frozen transfers.`);
            errors.push(`   Contact the freeze authority or use a different NFT.`);
          } else {
            errors.push(`❓ UNKNOWN ERROR: ${retireSimulation.error}`);
            errors.push(`   Try: 1) Check SOL balance 2) Refresh page 3) Reconnect wallet 4) Try different NFT`);
          }
        }
      }

      warnings.push(...retireDecoded.warnings);

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

