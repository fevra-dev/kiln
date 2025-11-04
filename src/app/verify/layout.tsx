'use client';

/**
 * Verify Page Layout
 * 
 * Wraps the verify page with wallet providers for optional metadata update functionality.
 */

import { WalletProviders } from '@/components/wallet/WalletProviders';

export default function VerifyLayout({
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

