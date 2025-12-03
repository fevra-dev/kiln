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
 * Free public RPC endpoints (no auth required)
 * Used as fallback when configured RPC returns 401/403
 */
const PUBLIC_RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

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
    // Check if configured RPC looks like it has an API key that might be invalid
    const configuredRpc = process.env['NEXT_PUBLIC_SOLANA_RPC'];
    
    // If configured RPC contains api-key parameter, warn user but still try it first
    // The browser will show 401 errors if the key is invalid
    if (configuredRpc) {
      // Check if it's a Helius URL - they frequently have auth issues
      if (configuredRpc.includes('helius') && configuredRpc.includes('api-key')) {
        console.log('🔑 Using configured Helius RPC. If you see 401 errors, update NEXT_PUBLIC_SOLANA_RPC in .env.local');
      }
      return configuredRpc;
    }
    
    // Fallback to appropriate network endpoint
    if (network === WalletAdapterNetwork.Mainnet) {
      // Use a reliable free public RPC endpoint
      console.warn('⚠️ Using public mainnet RPC. Set NEXT_PUBLIC_SOLANA_RPC for better performance.');
      console.warn('📡 Using PublicNode RPC: https://solana-rpc.publicnode.com');
      return PUBLIC_RPC_ENDPOINTS[0] as string;
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
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

