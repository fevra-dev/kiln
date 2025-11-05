/**
 * Update Metaplex NFT metadata to point to Ordinals inscription.
 * 
 * This function updates the NFT's metadata URI to point to the Ordinals content
 * at https://ordinals.com/inscription/{inscriptionId}
 * 
 * Requires:
 * - NFT must be mutable (updateAuthority must allow updates)
 * - User must be the updateAuthority
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, transactionBuilder, generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import {
  findMetadataPda,
  fetchMetadata,
  updateV1,
} from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { VersionedTransaction, VersionedMessage } from '@solana/web3.js';

/**
 * Build a metadata update transaction to point NFT image to Ordinals inscription.
 * 
 * @param rpcUrl - Solana RPC URL
 * @param mint - Mint address (string)
 * @param updateAuthority - Update authority public key (must be the signer)
 * @param inscriptionId - Bitcoin inscription ID
 * @param priorityMicrolamports - Optional priority fee in microlamports
 * @returns Serialized transaction ready for client signing
 */
export async function buildUpdateMetadataToOrdinalsTransaction(
  rpcUrl: string,
  mint: string,
  _updateAuthority: string, // Unused - client will set authority when signing
  inscriptionId: string,
  priorityMicrolamports: number = 2_000
): Promise<{
  transaction: string; // base64 serialized transaction
  isVersioned: boolean;
  ordinalsUrl: string;
}> {
  // Create server-side Umi instance with a dummy keypair for building
  const umi = createUmi(rpcUrl);
  const dummyKeypair = generateSigner(umi);
  umi.use(keypairIdentity(dummyKeypair));
  
  const mintPk = publicKey(mint);
  // Note: authority will be set by the client when signing the transaction

  // Find metadata PDA
  const metadataPda = findMetadataPda(umi, { mint: mintPk })[0];

  // Fetch existing metadata to preserve other fields
  const existingMetadata = await fetchMetadata(umi, metadataPda);

  // Build Ordinals URL
  const ordinalsUrl = `https://ordinals.com/inscription/${inscriptionId}`;

  // Build transaction with compute budget
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(umi, { units: 500_000 }));
  tb = tb.add(setComputeUnitPrice(umi, { microLamports: priorityMicrolamports }));

  // Add update metadata instruction
  // Update the URI while preserving all other metadata fields
  // Note: authority will be set by the client when signing, we use the dummy signer for building
  tb = tb.add(
    updateV1(umi, {
      metadata: metadataPda,
      mint: mintPk,
      authority: dummyKeypair, // Use dummy signer for building, client will set correct authority when signing
      data: {
        name: existingMetadata.name,
        symbol: existingMetadata.symbol,
        uri: ordinalsUrl, // Update the URI to point to Ordinals
        sellerFeeBasisPoints: existingMetadata.sellerFeeBasisPoints,
        creators: existingMetadata.creators,
      },
    })
  );

  // Build the transaction (without sending)
  const builtTx = await tb.build(umi);
  
  // Get the built transaction message
  const message = builtTx.message;
  
  // Convert Umi TransactionMessage to Solana VersionedMessage format
  // Umi's message structure is compatible with Solana's wire format at runtime
  // The underlying structure matches Solana's VersionedMessage format
  // We use type assertion because the types differ but the runtime structure is compatible
  // Using 'unknown' as intermediate type to satisfy ESLint no-explicit-any rule
  const versionedTx = new VersionedTransaction(message as unknown as VersionedMessage);
  
  // Serialize the versioned transaction (unsigned transaction bytes)
  const serializedMessage = versionedTx.serialize();
  
  // Convert to base64 for transport
  const base64Tx = Buffer.from(serializedMessage).toString('base64');

  return {
    transaction: base64Tx,
    isVersioned: true,
    ordinalsUrl,
  };
}

