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
  updateV1,
} from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';

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
  updateAuthority: string,
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
  const authorityPk = publicKey(updateAuthority);

  // Find metadata PDA
  const metadataPda = findMetadataPda(umi, { mint: mintPk })[0];

  // Build Ordinals URL
  const ordinalsUrl = `https://ordinals.com/inscription/${inscriptionId}`;

  // Build transaction with compute budget
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(umi, { units: 500_000 }));
  tb = tb.add(setComputeUnitPrice(umi, { microLamports: priorityMicrolamports }));

  // Add update metadata instruction
  // Note: updateV1 allows updating specific fields without replacing entire metadata
  // We'll update the URI to point to Ordinals
  tb = tb.add(
    updateV1(umi, {
      metadata: metadataPda,
      updateAuthority: authorityPk,
      data: {
        uri: ordinalsUrl, // Update the URI to point to Ordinals
        // Keep other fields unchanged by not specifying them
      },
    })
  );

  // Build the transaction (without sending)
  const builtTx = await tb.build(umi);
  
  // Get the built transaction message
  const message = builtTx.message;
  
  // Umi messages are versioned transactions - serialize directly
  // The message has a bytes property that contains the serialized transaction
  const serializedMessage = message.bytes;
  
  // Convert to base64 for transport
  const base64Tx = Buffer.from(serializedMessage).toString('base64');

  return {
    transaction: base64Tx,
    isVersioned: true,
    ordinalsUrl,
  };
}

