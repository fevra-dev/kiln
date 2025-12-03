/**
 * Teleburn Layout
 * 
 * Wraps teleburn pages with wallet providers.
 * Sets page-specific metadata for teleburn pages.
 */

import type { Metadata } from 'next';
import { WalletProviders } from '@/components/wallet/WalletProviders';

export const metadata: Metadata = {
  title: 'Kiln | Teleburn',
  description: 'Permanently link Solana NFTs to Bitcoin Ordinals through cryptographic burning. Forging cryptographic burns with proof of burn. Irreversible. No custody.',
};

export default function TeleburnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProviders>
      {children}
    </WalletProviders>
  );
}

