/**
 * Umi factory for client-side local burn assembly.
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import type { WalletAdapter } from '@solana/wallet-adapter-base';

/**
 * Create a client-only Umi instance bound to the connected wallet.
 */
export function createClientUmi(rpcUrl: string, wallet: WalletAdapter) {
  if (typeof window === 'undefined') {
    throw new Error('createClientUmi must be called in the browser');
  }
  return createUmi(rpcUrl).use(walletAdapterIdentity(wallet));
}


