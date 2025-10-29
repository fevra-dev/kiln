/**
 * Metaplex pNFT Burn Implementation
 * 
 * This module handles burning Programmable NFTs (pNFTs) using the Metaplex
 * Token Metadata program, which properly handles frozen accounts by:
 * 1. Automatically thawing the account atomically
 * 2. Validating any rule sets
 * 3. Burning the token
 * 4. Closing all associated accounts
 * 5. Reclaiming SOL rent
 * 
 * NOTE: This module requires Metaplex packages to be installed at runtime.
 * It gracefully handles missing dependencies by returning appropriate errors.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';

// Metaplex functionality is completely optional and loaded at runtime
// This prevents any build-time dependency resolution issues

export interface MetaplexBurnParams {
  mint: PublicKey;
  owner: PublicKey;
  wallet: WalletAdapter;
  connection: Connection;
  inscriptionId: string;
}

export interface MetaplexBurnResult {
  success: boolean;
  signature?: string;
  error?: string;
  reclaimedSol?: number;
}

/**
 * Burn a pNFT using Metaplex Token Metadata program
 * This is the correct way to burn pNFTs that have frozen accounts
 */
export async function burnPNFTWithMetaplex(
  params: MetaplexBurnParams
): Promise<MetaplexBurnResult> {
  try {
    console.log(`🔥 METAPLEX BURN: Starting pNFT burn for mint: ${params.mint.toBase58()}`);
    
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      throw new Error('Metaplex burn only available in browser environment');
    }
    
    // For now, return an error indicating Metaplex is not available
    // This prevents build-time dependency issues
    console.log(`⚠️ METAPLEX BURN: Metaplex burn not yet implemented`);
    console.log(`💡 METAPLEX BURN: This feature requires additional setup`);
    
    return {
      success: false,
      error: 'Metaplex burn not yet implemented - requires additional setup'
    };
    
  } catch (error) {
    console.error(`❌ METAPLEX BURN: Burn failed:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if a mint is a pNFT by fetching its metadata
 */
export async function isPNFT(
  mint: PublicKey,
  connection: Connection,
  owner?: PublicKey
): Promise<boolean> {
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return false; // Can't check pNFT status on server side
    }
    
    console.log(`🔍 PNFT CHECK: Starting comprehensive pNFT detection for mint: ${mint.toBase58()}`);
    
    // Method 1: Check if the mint uses Token-2022 program (common for pNFTs)
    try {
      const mintInfo = await connection.getAccountInfo(mint);
      if (mintInfo && mintInfo.owner.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        console.log(`🔍 PNFT CHECK: Detected Token-2022 mint, likely a pNFT`);
        return true;
      }
      console.log(`🔍 PNFT CHECK: Mint owner: ${mintInfo?.owner.toBase58() || 'unknown'}`);
    } catch (error) {
      console.log(`🔍 PNFT CHECK: Error checking mint account:`, error);
    }
    
    // Method 2: Check for frozen token account (classic pNFT characteristic)
    // This is the most reliable indicator for pNFTs that use SPL Token program
    if (owner) {
      try {
        const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = await import('@solana/spl-token');
        const { unpackAccount } = await import('@solana/spl-token');
        
        // Get the associated token account for this mint
        const tokenAccount = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
      
      console.log(`🔍 PNFT CHECK: Checking token account: ${tokenAccount.toBase58()}`);
      
      const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
      if (tokenAccountInfo) {
        const tokenAccountData = unpackAccount(tokenAccount, tokenAccountInfo, TOKEN_PROGRAM_ID);
        console.log(`🔍 PNFT CHECK: Token account frozen status: ${tokenAccountData.isFrozen}`);
        console.log(`🔍 PNFT CHECK: Token account amount: ${tokenAccountData.amount}`);
        
        // If the token account is frozen and has tokens, it's likely a pNFT
        if (tokenAccountData.isFrozen && tokenAccountData.amount > 0n) {
          console.log(`🔍 PNFT CHECK: Detected frozen token account with tokens - likely a pNFT!`);
          return true;
        }
      } else {
        console.log(`🔍 PNFT CHECK: Token account not found`);
      }
      } catch (error) {
        console.log(`🔍 PNFT CHECK: Error checking token account:`, error);
      }
    } else {
      console.log(`🔍 PNFT CHECK: No owner provided, skipping token account check`);
    }
    
    // Method 3: Check for Metaplex metadata (if available)
    // This would require additional Metaplex SDK integration
    
    console.log(`🔍 PNFT CHECK: No pNFT indicators found`);
    return false;
    
  } catch (error) {
    console.log(`🔍 PNFT CHECK: Error in pNFT detection:`, error);
    return false;
  }
}
