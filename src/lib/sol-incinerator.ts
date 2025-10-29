/**
 * Sol-Incinerator API Integration
 * 
 * This module integrates with the Sol-Incinerator API to handle burning
 * of all NFT types including pNFTs with frozen accounts.
 * 
 * Based on: https://docs.sol-incinerator.com/api/sol-incinerator-burn+close-api-documentation
 */

// Note: Connection and PublicKey are not directly used in this file
// but are kept for potential future use

export interface SolIncineratorBurnParams {
  userPublicKey: string;
  assetId: string;
  feePayer?: string;
  autoCloseTokenAccounts?: boolean;
  priorityFeeMicroLamports?: number;
  asLegacyTransaction?: boolean;
  burnAmount?: number;
}

export interface SolIncineratorBurnResponse {
  assetId: string;
  serializedTransaction: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  transactionType: string;
  isDestructiveAction: boolean;
}

export interface SolIncineratorPreviewResponse {
  assetId: string;
  transactionType: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  isDestructiveAction: boolean;
  assetInfo: {
    tokenAccount: string;
    mintAddress?: string;
    programId?: string;
    isMetaplexNFT?: boolean;
    isProgrammableNFT?: boolean;
    hasCollection?: boolean;
    tokenStandard?: number;
    frozen?: boolean;
    isZeroBalance?: boolean;
    tokenBalance?: string;
    hasHarvestFees?: boolean;
    isMplCoreNft?: boolean;
  };
  feeBreakdown: {
    totalFee: number;
    rentReclaimed: {
      tokenAccount: number;
      metadata?: number;
      edition?: number;
      tokenRecord?: number;
    };
  };
}

const SOL_INCINERATOR_API_BASE = 'https://v1.api.sol-incinerator.com';
const SOL_INCINERATOR_API_KEY = process.env['SOL_INCINERATOR_API_KEY'] || '833f505d-536d-4565-858d-66f1089d49c1';

/**
 * Check if an asset can be burned using Sol-Incinerator
 */
export async function checkAssetBurnability(
  assetId: string,
  userPublicKey: string,
  apiKey?: string
): Promise<SolIncineratorPreviewResponse | null> {
  const finalApiKey = apiKey || SOL_INCINERATOR_API_KEY;
  try {
    console.log(`🔥 SOL-INCINERATOR: Checking burnability for asset: ${assetId}`);
    console.log(`🔥 SOL-INCINERATOR: User public key: ${userPublicKey}`);
    console.log(`🔥 SOL-INCINERATOR: API key provided: ${!!apiKey}`);
    console.log(`🔥 SOL-INCINERATOR: Final API key: ${finalApiKey !== 'YOUR_SOL_INCINERATOR_API_KEY' ? 'VALID' : 'DEFAULT'}`);
    
    const requestBody = {
      userPublicKey,
      assetId
    };
    console.log(`🔥 SOL-INCINERATOR: Request body:`, requestBody);
    
    const response = await fetch(`${SOL_INCINERATOR_API_BASE}/burn/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(finalApiKey && finalApiKey !== 'YOUR_SOL_INCINERATOR_API_KEY' && { 'x-api-key': finalApiKey })
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ SOL-INCINERATOR: Preview failed: ${response.status} ${response.statusText}`);
      console.log(`❌ SOL-INCINERATOR: Error response:`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`✅ SOL-INCINERATOR: Asset preview successful:`, data);
    
    return data;
  } catch (error) {
    console.error(`❌ SOL-INCINERATOR: Preview error:`, error);
    return null;
  }
}

/**
 * Get burn transaction from Sol-Incinerator
 */
export async function getBurnTransaction(
  params: SolIncineratorBurnParams,
  apiKey?: string
): Promise<SolIncineratorBurnResponse | null> {
  try {
    console.log(`🔥 SOL-INCINERATOR: Getting burn transaction for asset: ${params.assetId}`);
    
    const response = await fetch(`${SOL_INCINERATOR_API_BASE}/burn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-api-key': apiKey })
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ SOL-INCINERATOR: Burn request failed: ${response.status} ${response.statusText}`);
      console.log(`❌ SOL-INCINERATOR: Error details:`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`✅ SOL-INCINERATOR: Burn transaction created:`, data);
    
    return data;
  } catch (error) {
    console.error(`❌ SOL-INCINERATOR: Burn error:`, error);
    return null;
  }
}

/**
 * Check if Sol-Incinerator API is available
 */
export async function checkSolIncineratorStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${SOL_INCINERATOR_API_BASE}/`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Detect if an asset is a pNFT using Sol-Incinerator preview
 */
export async function isPNFTViaSolIncinerator(
  assetId: string,
  userPublicKey: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const preview = await checkAssetBurnability(assetId, userPublicKey, apiKey);
    
    if (!preview) {
      return false;
    }
    
    // Check if it's a programmable NFT based on asset info
    return preview.assetInfo.isProgrammableNFT === true || 
           preview.assetInfo.frozen === true ||
           preview.transactionType.includes('PNFT') ||
           preview.transactionType.includes('Programmable');
  } catch (error) {
    console.error(`❌ SOL-INCINERATOR: pNFT detection error:`, error);
    return false;
  }
}
