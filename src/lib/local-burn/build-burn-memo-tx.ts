/**
 * Build a single burn+memo transaction (without sending).
 * 
 * This function builds a transaction that includes:
 * 1. Compute budget instructions (CU limit and priority fee)
 * 2. Metaplex burnV1 instruction (handles both pNFT and regular NFT)
 * 3. SPL Memo instruction with Kiln teleburn proof
 * 
 * The transaction is built but NOT sent, allowing the client to sign it.
 * 
 * **Discoverability**: The transaction will be easily discoverable on Solana block explorers
 * when searching by mint address because:
 * - The mint address is included directly in the burnV1 instruction account keys
 * - All related accounts (metadata PDA, edition PDA, token account) are derived from the mint
 * - Block explorers index transactions by account keys, ensuring the mint search will find this transaction
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, transactionBuilder, createNoopSigner, signerIdentity } from '@metaplex-foundation/umi';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  fetchDigitalAssetWithAssociatedToken,
  findMetadataPda,
  findMasterEditionPda,
  burnV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { Connection, PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { buildRetireMemo } from './memo';

/**
 * Build a burn+memo transaction without sending it.
 * 
 * @param rpcUrl - Solana RPC URL
 * @param mint - Mint address (string)
 * @param owner - Owner address (string)
 * @param inscriptionId - Bitcoin inscription ID
 * @param sha256 - SHA-256 hash of inscription content
 * @param priorityMicrolamports - Optional priority fee in microlamports
 * @returns Serialized transaction ready for client signing
 */
/**
 * Free public RPC endpoints for fallback when configured RPC fails
 */
const FALLBACK_RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
];

/**
 * Validate RPC URL by making a test request
 * Returns the working URL or a fallback
 */
async function getWorkingRpcUrl(rpcUrl: string): Promise<string> {
  try {
    // Quick test to see if RPC is responding
    const connection = new Connection(rpcUrl, 'confirmed');
    await connection.getSlot();
    return rpcUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Check for auth errors (401, 403, Unauthorized)
    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized')) {
      console.warn(`⚠️ RPC ${rpcUrl} returned auth error, trying fallbacks...`);
      
      // Try fallback endpoints
      for (const fallback of FALLBACK_RPC_ENDPOINTS) {
        try {
          const testConn = new Connection(fallback, 'confirmed');
          await testConn.getSlot();
          console.log(`✅ Using fallback RPC: ${fallback}`);
          return fallback;
        } catch {
          // Try next fallback
        }
      }
    }
    
    // Return original URL if no fallback works (let actual error propagate later)
    console.warn(`⚠️ Could not validate RPC, proceeding with original: ${rpcUrl}`);
    return rpcUrl;
  }
}

export async function buildBurnMemoTransaction(
  rpcUrl: string,
  mint: string,
  owner: string,
  inscriptionId: string,
  priorityMicrolamports: number = 2_000
): Promise<{
  transaction: string; // base64 serialized transaction
  isVersioned: boolean;
  nftType: 'PNFT' | 'REGULAR';
}> {
  // Validate RPC URL and get working endpoint (with fallback)
  const workingRpcUrl = await getWorkingRpcUrl(rpcUrl);
  
  // Create server-side Umi instance
  const umi = createUmi(workingRpcUrl);
  
  // Register SPL Token programs with Umi
  // This is required for burnV1 to recognize associated token accounts
  umi.programs.add({
    name: 'splToken',
    publicKey: publicKey(TOKEN_PROGRAM_ID.toString()),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  } as unknown as Parameters<typeof umi.programs.add>[0]);
  umi.programs.add({
    name: 'splAssociatedToken',
    publicKey: publicKey(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  } as unknown as Parameters<typeof umi.programs.add>[0]);
  
  const mintPk = publicKey(mint);
  const ownerPk = publicKey(owner);
  
  // Create a "noop" signer for the owner - this represents the owner's public key
  // for transaction building without having their private key.
  // The client wallet will provide the actual signature.
  const ownerSigner = createNoopSigner(ownerPk);
  
  // Set the owner as the Umi identity (required for transaction building)
  // This makes the owner the default signer/fee payer for all instructions
  umi.use(signerIdentity(ownerSigner));

  // Fetch digital asset to determine NFT type
  const asset = await fetchDigitalAssetWithAssociatedToken(umi, mintPk, ownerPk);

  const metadataPda = findMetadataPda(umi, { mint: mintPk })[0];
  const masterEditionPda = findMasterEditionPda(umi, { mint: mintPk })[0];

  const collection = asset.metadata.collection.__option === 'Some' ? asset.metadata.collection.value : null;
  const collectionMetadata = collection ? findMetadataPda(umi, { mint: collection.key })[0] : undefined;

  // Determine NFT type from token standard
  const tokenStandard = asset.metadata.tokenStandard.__option === 'Some' 
    ? asset.metadata.tokenStandard.value 
    : TokenStandard.NonFungible;
  
  const nftType: 'PNFT' | 'REGULAR' = tokenStandard === TokenStandard.ProgrammableNonFungible 
    ? 'PNFT' 
    : 'REGULAR';

  // Build transaction with compute budget
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(umi, { units: 500_000 }));
  tb = tb.add(setComputeUnitPrice(umi, { microLamports: priorityMicrolamports }));

  // Add burn instruction (works for both pNFT and regular NFT)
  // CRITICAL: Set the authority to the actual owner (using noop signer)
  // This ensures correct account derivation for the burn instruction
  tb = tb.add(
    burnV1(umi, {
      mint: mintPk,
      authority: ownerSigner, // Use the owner as authority, not Umi identity
      token: asset.token.publicKey,
      tokenRecord: asset.tokenRecord?.publicKey,
      metadata: metadataPda,
      edition: masterEditionPda,
      collectionMetadata,
      tokenStandard: tokenStandard === TokenStandard.ProgrammableNonFungible
        ? TokenStandard.ProgrammableNonFungible
        : TokenStandard.NonFungible,
    })
  );

  // Build memo with teleburn action (v1.0 format: teleburn:<inscription_id>)
  const memo = buildRetireMemo({
    inscriptionId,
  });

  // Add memo instruction (v1.0 format: simple string, not JSON)
  const MEMO_PROGRAM_ID = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const memoData = new TextEncoder().encode(memo); // memo is already a string (teleburn:...)
  tb = tb.add({
    instruction: {
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: memoData,
    },
    signers: [],
    bytesCreatedOnChain: 0,
  });

  // Build the transaction using web3.js directly to avoid Umi's signing requirements
  // This extracts the instructions from Umi and builds a versioned transaction manually
  
  // Fetch blockhash
  const connection = new Connection(workingRpcUrl, 'confirmed');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
  console.log(`🔗 BUILD BURN+MEMO: Fetched blockhash ${blockhash.slice(0, 8)}... (lastValidBlockHeight: ${lastValidBlockHeight})`);
  console.log(`🔥 BUILD BURN+MEMO: NFT type detected: ${nftType}`);
  console.log(`👤 BUILD BURN+MEMO: Owner/Authority: ${owner}`);
  console.log(`🎫 BUILD BURN+MEMO: Token account: ${asset.token.publicKey}`);
  console.log(`📝 BUILD BURN+MEMO: Token record: ${asset.tokenRecord?.publicKey || 'N/A (regular NFT)'}`);
  
  // Extract instructions from the Umi transaction builder
  // This gets the properly constructed instructions without triggering signing
  const umiInstructions = tb.getInstructions();
  
  console.log(`📋 BUILD BURN+MEMO: Extracted ${umiInstructions.length} instructions from Umi`);
  
  // Convert Umi instructions to web3.js instructions
  const web3JsInstructions = umiInstructions.map((ix) => toWeb3JsInstruction(ix));
  
  // Get the owner as web3.js PublicKey for the transaction
  const ownerWeb3Js = new PublicKey(owner);
  
  // Create a versioned transaction message
  const messageV0 = new TransactionMessage({
    payerKey: ownerWeb3Js,
    recentBlockhash: blockhash,
    instructions: web3JsInstructions,
  }).compileToV0Message();
  
  // Create the versioned transaction (without signatures - client will sign)
  const versionedTx = new VersionedTransaction(messageV0);
  
  console.log(`✅ BUILD BURN+MEMO: Transaction built with blockhash ${blockhash.slice(0, 8)}...`);
  console.log(`📊 BUILD BURN+MEMO: Transaction has ${web3JsInstructions.length} instructions`);
  
  // Serialize the full transaction (with empty signatures that client will fill)
  const serializedTx = versionedTx.serialize();
  
  // Convert to base64 for transport
  const base64Tx = Buffer.from(serializedTx).toString('base64');

  return {
    transaction: base64Tx,
    isVersioned: true,
    nftType,
  };
}

