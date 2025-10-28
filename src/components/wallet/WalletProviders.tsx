'use client';

/**
 * Wallet Providers Component
 * 
 * Sets up Solana wallet adapter context for the entire app.
 * Supports multiple wallet types (Phantom, Solflare, etc.)
 * 
 * @description Wraps app with wallet adapter providers
 * @version 0.1.1
 */

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter CSS (red matrix themed)
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProvidersProps {
  children: ReactNode;
  network?: WalletAdapterNetwork;
}

/**
 * Wallet Providers Component
 * 
 * Configures Solana wallet adapters for the application.
 * Supports mainnet and devnet networks.
 */
export const WalletProviders: FC<WalletProvidersProps> = ({ 
  children, 
  network = WalletAdapterNetwork.Mainnet  // Mainnet for production
}) => {
  // Configure RPC endpoint with fallbacks
  const endpoint = useMemo(() => {
    // Use environment variable (Helius RPC for mainnet)
    if (process.env['NEXT_PUBLIC_SOLANA_RPC']) {
      return process.env['NEXT_PUBLIC_SOLANA_RPC'];
    }
    
    // Fallback to appropriate network endpoint
    if (network === WalletAdapterNetwork.Mainnet) {
      // Use a more reliable RPC endpoint that doesn't block requests
      console.warn('⚠️ Using public mainnet RPC. Set NEXT_PUBLIC_SOLANA_RPC for better performance.');
      console.warn('📡 Using Allnodes public RPC: https://solana-rpc.publicnode.com');
      return 'https://solana-rpc.publicnode.com'; // Allnodes public RPC (free, no auth required)
    }
    
    // For devnet
    return 'https://api.devnet.solana.com';
  }, [network]);

  // Configure wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Add more wallet adapters here as needed:
      // new SolflareWalletAdapter(),
      // new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

