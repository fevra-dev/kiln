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

// Metaplex functionality is optional and only available in browser environment
// This prevents build-time dependency resolution issues

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
    
    // Dynamic import of Metaplex dependencies
    const umiBundle = await import('@metaplex-foundation/umi-bundle-defaults');
    const tokenMetadata = await import('@metaplex-foundation/mpl-token-metadata');
    const walletAdapter = await import('@metaplex-foundation/umi-signer-wallet-adapters');
    
    // Destructure the imports
    const { createUmi, publicKey, unwrapOption, base58 } = umiBundle;
    const { burnV1, fetchDigitalAssetWithAssociatedToken, findMetadataPda, TokenStandard } = tokenMetadata;
    const { walletAdapterIdentity } = walletAdapter;
    
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
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return false; // Can't check pNFT status on server side
    }
    
    // Dynamic import of Metaplex dependencies
    const umiBundle = await import('@metaplex-foundation/umi-bundle-defaults');
    const tokenMetadata = await import('@metaplex-foundation/mpl-token-metadata');
    
    // Destructure the imports
    const { createUmi, publicKey } = umiBundle;
    const { fetchDigitalAssetWithAssociatedToken, TokenStandard } = tokenMetadata;
    
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
