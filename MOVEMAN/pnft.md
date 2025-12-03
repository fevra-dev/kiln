Overview of pNFTs on SolanaProgrammable Non-Fungible Tokens (pNFTs) are an advanced NFT standard on Solana, introduced by Metaplex as part of the Token Metadata program. They build on traditional NFTs by adding programmability, allowing creators to enforce custom rules on asset operations like transfers, delegations, and burns. This addresses limitations in earlier standards where users could bypass the Token Metadata program by interacting directly with the SPL Token program, potentially evading rules such as royalties.Key features of pNFTs:Rule Sets: Creators define rules via the Token Auth Rules program, which can allow or deny operations based on conditions (e.g., allow-list of programs that enforce royalties, pubkey matches, or composite logic like "all" or "any"). These rules are stored in a Rule Set account and can be shared across multiple pNFTs.
Granular Delegation: Delegates can be assigned specific roles (e.g., sale, transfer, staking) without full control, tracked in a Token Record account.
Enforced Routing: All operations must go through the Token Metadata program, enabling rule validation.
Always-Frozen Token Accounts: To prevent direct SPL Token interactions, pNFT token accounts are perpetually frozen. The Token Metadata program temporarily thaws the account for valid operations, performs the action atomically, and refreezes it (if applicable).
Differences from Regular NFTs: Standard NFTs (e.g., NonFungible standard) lack built-in programmability and can be manipulated directly via SPL Token instructions. pNFTs use Token-2022 extensions (like metadata pointers) and integrate with the Token Auth Rules program for on-chain enforcement. They support royalty enforcement on transfers, which isn't guaranteed in older standards.
Use Cases: Enforcing creator royalties (e.g., by denying non-compliant marketplaces), creating soulbound tokens (non-transferable), or utility-based delegations (e.g., staking without losing ownership).
Creation and Management: Minted using Metaplex SDKs (e.g., JS or Rust). Tools like QuickNode guides demonstrate minting to devnet. pNFTs represent ~99% of new Solana NFT issuance via Metaplex, with standards like ProgrammableNonFungible. 

quicknode.com +3

pNFTs are part of Metaplex's evolution, with resources like videos and GitHub repos for minting/staking examples. They coexist with other standards like Metaplex Core (for compressed, lower-cost NFTs) but focus on programmability. 

youtube.com +2

Why You're Seeing "Token Account Frozen" ErrorsThe error occurs because pNFT token accounts are intentionally always frozen in the SPL Token program. This design forces all operations (including burns) through the Metaplex Token Metadata program to enforce any rule sets. Attempting a direct SPL Token burn (e.g., via spl-token burn) fails due to the freeze. Instead, use the Token Metadata program's Burn instruction, which automatically thaws the account, validates rules, performs the burn, and handles refreezing (though unnecessary post-burn as accounts are closed). 

docs.sol-incinerator.com +2

If a rule set blocks the burn (e.g., custom deny rules), it may fail even with the correct instruction—check the pNFT's metadata for programmableConfig to see the rule set. For scam or frozen non-pNFTs, thawing requires the freeze authority (often the creator), but pNFTs handle thawing internally via Metaplex. 

solana.stackexchange.com +1

How to Burn pNFTs (Thaw and Burn Process)To burn properly, use the Metaplex Token Metadata program's Burn instruction (via SDK like Umi or JS). This unified interface supports pNFTs (TokenStandard.ProgrammableNonFungible) and closes associated accounts (e.g., token, metadata, edition, token record), reclaiming rent-exempt SOL. No separate thaw call is needed—the burn instruction thaws atomically if rules pass.Steps Using Metaplex Umi SDK (Recommended for Apps)Setup: Install @metaplex-foundation/umi and @metaplex-foundation/mpl-token-metadata. Connect to Solana (e.g., devnet/mainnet) and use a wallet signer.
Fetch Asset Details: Retrieve the pNFT's token account, token record, and rule set (if any) using fetchDigitalAssetWithAssociatedToken.
Prepare Accounts: Include mint, token, tokenRecord, collectionMetadata (if in a collection), and authorizationRules (from metadata.programmableConfig).
Execute Burn: Call burnV1 with TokenStandard.ProgrammableNonFungible. Sign and confirm the transaction.
Handle Rules: If the pNFT has authorization rules, provide authorizationData with any required payload for validation.

JavaScript Code Example (Umi SDK):javascript

import {
  burnV1,
  fetchDigitalAssetWithAssociatedToken,
  findMetadataPda,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, unwrapOption } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { Connection, Keypair } from '@solana/web3.js';

// Setup Umi with connection and wallet (replace with your wallet)
const connection = new Connection('https://api.mainnet-beta.solana.com');
const wallet = Keypair.generate(); // Or use your wallet adapter
const umi = createUmi(connection.rpcEndpoint).use(walletAdapterIdentity(wallet));

// pNFT mint address (replace with yours)
const mintId = publicKey('YOUR_PNFT_MINT_ADDRESS_HERE');

// Fetch pNFT with associated token account
const assetWithToken = await fetchDigitalAssetWithAssociatedToken(umi, mintId, umi.identity.publicKey);

// Get collection (if any)
const collectionMint = unwrapOption(assetWithToken.metadata.collection);
const collectionMetadata = collectionMint ? findMetadataPda(umi, { mint: collectionMint.key })[0] : undefined;

// Get authorization rules (if rule set exists)
const authRules = assetWithToken.metadata.programmableConfig?.ruleSet || undefined; // Fetch from metadata

// Burn the pNFT
const tx = await burnV1(umi, {
  mintAccount: mintId,
  token: assetWithToken.token.publicKey,
  tokenRecord: assetWithToken.tokenRecord?.publicKey,
  collectionMetadata,
  tokenStandard: TokenStandard.ProgrammableNonFungible,
  authorizationRules: authRules ? publicKey(authRules) : undefined,
  // If rules require data: authorizationData: { payload: {...} }
}).sendAndConfirm(umi);

const signature = base58.deserialize(tx.signature)[0];
console.log(`Burn successful! Tx Signature: ${signature}`);

Expected Outcome: Closes token, metadata, edition, and token record accounts. Reclaims ~0.002-0.005 SOL rent (varies by accounts). Fails if rules deny the burn or insufficient authority. 

developers.metaplex.com +1

Alternative Tools/MethodsMetaplex JS SDK: Use metaplex.nfts().delete({ mintAddress: new PublicKey(mint) }) for a simpler wrapper. 

docs.moralis.com

Wallets: Phantom/Solflare support in-app burning (select NFT > Burn). They use Metaplex under the hood, handling thaw/burn. 

community.magiceden.io +2

CLI: Use spl-token burn only for non-pNFTs; for pNFTs, build a custom transaction with Metaplex burn CPI.

Insights from Sol-IncineratorSol-Incinerator is a popular dApp for burning unwanted Solana assets, including pNFTs, to reclaim rent SOL. It scans your wallet, lists selectable assets (indicating frozen ones with ), and burns via a simple UI (connect wallet > select > burn > sign). For pNFTs, it likely uses Metaplex's burn instruction to handle the perpetual freeze, as direct burns fail. It supports NFTs/pNFTs explicitly, with fees reclaimed minus small tx costs. Source code isn't public, but it processes burns in batches and swaps reclaimed SOL if desired. Users report it works for pNFTs where direct methods fail, confirming thaw/burn integration. 

alchemy.com +6

For your teleburn app (assuming a Telegram bot for remote burns), integrate the Umi/JS code above into a backend service. Use wallet adapters for user signing, fetch user NFTs via Moralis/Helius APIs, and execute burns on demand. Test on devnet first to avoid mainnet issues. If rules block burns, advise users to check the pNFT's rule set.

