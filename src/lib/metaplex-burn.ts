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
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';

// Dynamic imports for Metaplex to avoid build issues
let createUmi: any;
let publicKey: any;
let unwrapOption: any;
let base58: any;
let burnV1: any;
let fetchDigitalAssetWithAssociatedToken: any;
let findMetadataPda: any;
let TokenStandard: any;
let walletAdapterIdentity: any;

// Initialize Metaplex imports dynamically
async function initMetaplex() {
  if (!createUmi) {
    try {
      const umiBundle = await import('@metaplex-foundation/umi-bundle-defaults');
      const tokenMetadata = await import('@metaplex-foundation/mpl-token-metadata');
      const walletAdapter = await import('@metaplex-foundation/umi-signer-wallet-adapters');
      
      createUmi = umiBundle.createUmi;
      publicKey = umiBundle.publicKey;
      unwrapOption = umiBundle.unwrapOption;
      base58 = umiBundle.base58;
      
      burnV1 = tokenMetadata.burnV1;
      fetchDigitalAssetWithAssociatedToken = tokenMetadata.fetchDigitalAssetWithAssociatedToken;
      findMetadataPda = tokenMetadata.findMetadataPda;
      TokenStandard = tokenMetadata.TokenStandard;
      
      walletAdapterIdentity = walletAdapter.walletAdapterIdentity;
    } catch (error) {
      console.error('Failed to load Metaplex dependencies:', error);
      throw new Error('Metaplex dependencies not available');
    }
  }
}

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
    
    // Initialize Metaplex dependencies
    await initMetaplex();
    
    // Create Umi instance with wallet adapter
    const umi = createUmi(params.connection.rpcEndpoint)
      .use(walletAdapterIdentity(params.wallet));
    
    const mintId = publicKey(params.mint.toBase58());
    
    console.log(`🔍 METAPLEX BURN: Fetching pNFT asset details...`);
    
    // Fetch the pNFT with associated token account
    const assetWithToken = await fetchDigitalAssetWithAssociatedToken(
      umi, 
      mintId, 
      publicKey(params.owner.toBase58())
    );
    
    console.log(`✅ METAPLEX BURN: Asset fetched successfully`);
    console.log(`📊 METAPLEX BURN: Token standard: ${assetWithToken.metadata.tokenStandard}`);
    console.log(`📊 METAPLEX BURN: Token account: ${assetWithToken.token.publicKey}`);
    
    // Check if this is actually a pNFT
    if (assetWithToken.metadata.tokenStandard !== TokenStandard.ProgrammableNonFungible) {
      console.log(`⚠️ METAPLEX BURN: Not a pNFT, falling back to SPL Token burn`);
      return {
        success: false,
        error: 'Not a pNFT - use SPL Token burn instead'
      };
    }
    
    // Get collection metadata (if in a collection)
    const collectionMint = unwrapOption(assetWithToken.metadata.collection);
    const collectionMetadata = collectionMint 
      ? findMetadataPda(umi, { mint: collectionMint.key })[0] 
      : undefined;
    
    // Get authorization rules (if rule set exists)
    const authRules = assetWithToken.metadata.programmableConfig?.ruleSet || undefined;
    
    console.log(`🔧 METAPLEX BURN: Collection metadata: ${collectionMetadata || 'None'}`);
    console.log(`🔧 METAPLEX BURN: Authorization rules: ${authRules || 'None'}`);
    
    // Build the burn instruction
    console.log(`🔥 METAPLEX BURN: Building burnV1 instruction...`);
    
    const burnParams = {
      mintAccount: mintId,
      token: assetWithToken.token.publicKey,
      tokenRecord: assetWithToken.tokenRecord?.publicKey,
      collectionMetadata,
      tokenStandard: TokenStandard.ProgrammableNonFungible,
      authorizationRules: authRules ? publicKey(authRules) : undefined,
      // If rules require data: authorizationData: { payload: {...} }
    };
    
    console.log(`🚀 METAPLEX BURN: Executing burn transaction...`);
    
    // Execute the burn
    const tx = await burnV1(umi, burnParams).sendAndConfirm(umi);
    
    const signature = base58.deserialize(tx.signature)[0];
    
    console.log(`✅ METAPLEX BURN: Burn successful!`);
    console.log(`📝 METAPLEX BURN: Transaction signature: ${signature}`);
    
    // Estimate reclaimed SOL (rough calculation)
    const reclaimedSol = 0.002; // Base estimate for token account
    
    return {
      success: true,
      signature,
      reclaimedSol
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
  connection: Connection
): Promise<boolean> {
  try {
    // Initialize Metaplex dependencies
    await initMetaplex();
    
    const umi = createUmi(connection.rpcEndpoint);
    const mintId = publicKey(mint.toBase58());
    
    // Try to fetch as pNFT first
    const asset = await fetchDigitalAssetWithAssociatedToken(umi, mintId, mintId);
    
    return asset.metadata.tokenStandard === TokenStandard.ProgrammableNonFungible;
  } catch {
    // If fetch fails, assume it's not a pNFT
    return false;
  }
}
