/**
 * Teleburn Layout
 * 
 * Wraps teleburn pages with wallet providers.
 */

import { WalletProviders } from '@/components/wallet/WalletProviders';

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

