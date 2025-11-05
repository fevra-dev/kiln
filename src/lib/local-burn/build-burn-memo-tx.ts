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
import { publicKey, transactionBuilder, keypairIdentity } from '@metaplex-foundation/umi';
import { generateSigner } from '@metaplex-foundation/umi';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  fetchDigitalAssetWithAssociatedToken,
  findMetadataPda,
  findMasterEditionPda,
  burnV1,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { VersionedTransaction, VersionedMessage, Connection } from '@solana/web3.js';
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
export async function buildBurnMemoTransaction(
  rpcUrl: string,
  mint: string,
  owner: string,
  inscriptionId: string,
  sha256: string,
  priorityMicrolamports: number = 2_000
): Promise<{
  transaction: string; // base64 serialized transaction
  isVersioned: boolean;
  nftType: 'PNFT' | 'REGULAR';
}> {
  // Create server-side Umi instance with a dummy keypair for building
  // The transaction won't be signed, so the keypair doesn't need to be valid
  const umi = createUmi(rpcUrl);
  const dummyKeypair = generateSigner(umi);
  umi.use(keypairIdentity(dummyKeypair));
  
  // Register SPL Token programs with Umi
  // This is required for burnV1 to recognize associated token accounts
  // Create minimal program objects with stub implementations
  // Using type assertion to satisfy Program interface requirements
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
  tb = tb.add(
    burnV1(umi, {
      mint: mintPk,
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

  // Build memo with teleburn action
  const memo = buildRetireMemo({
    inscriptionId,
    mint,
    sha256,
    timestamp: Math.floor(Date.now() / 1000),
  });

  // Add memo instruction
  const MEMO_PROGRAM_ID = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const memoData = new TextEncoder().encode(JSON.stringify(memo));
  tb = tb.add({
    instruction: {
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: memoData,
    },
    signers: [],
    bytesCreatedOnChain: 0,
  });

  // Build the transaction (without sending)
  // The transaction will be built with the dummy keypair as fee payer
  // The client will set the correct fee payer when signing
  
  // CRITICAL: Fetch blockhash BEFORE building to ensure it's available
  // Umi's transaction builder should automatically fetch blockhash during build(),
  // but we need to ensure it's actually set correctly
  const connection = new Connection(rpcUrl, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();
  
  // Get the built transaction from Umi
  const builtTx = await tb.build(umi);
  const message = builtTx.message;
  
  // Convert Umi TransactionMessage to Solana VersionedMessage format
  const versionedMessage = message as unknown as VersionedMessage;
  
  // CRITICAL: VersionedTransaction requires blockhash to be in the message structure
  // We need to ensure the blockhash is properly set. Since VersionedMessage doesn't
  // expose a direct setter, we'll use Object.defineProperty to force-set it
  // on the message's internal structure
  const messageWithBlockhash = Object.assign({}, versionedMessage, {
    recentBlockhash: blockhash,
  }) as VersionedMessage;
  
  // Create versioned transaction with blockhash set
  const versionedTx = new VersionedTransaction(messageWithBlockhash);
  
  // CRITICAL: Verify blockhash is actually set by checking the transaction
  // If it's not set, we'll get an error during serialization
  let serializedMessage: Uint8Array;
  try {
    serializedMessage = versionedTx.serialize();
    
    // After successful serialization, verify the blockhash is actually in the transaction
    // by deserializing and checking
    const deserialized = VersionedTransaction.deserialize(serializedMessage);
    if (!deserialized.message.recentBlockhash) {
      throw new Error('Blockhash was not set in the deserialized transaction');
    }
  } catch (error) {
    // If serialization or verification fails, provide detailed error
    if (error instanceof Error && (error.message.includes('blockhash') || error.message.includes('Blockhash was not set'))) {
      console.error('❌ BUILD BURN+MEMO: Blockhash verification failed');
      console.error('Blockhash we tried to set:', blockhash);
      console.error('Error:', error.message);
      throw new Error(`Transaction build failed: Blockhash could not be set in VersionedTransaction. This indicates Umi's transaction builder did not properly fetch or set the blockhash. Please verify RPC connection and Umi configuration. Error: ${error.message}`);
    }
    throw error;
  }
  
  // Convert to base64 for transport
  const base64Tx = Buffer.from(serializedMessage).toString('base64');

  return {
    transaction: base64Tx,
    isVersioned: true,
    nftType,
  };
}

