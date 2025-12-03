/**
 * Batch Teleburn Layout
 * 
 * Wraps the batch teleburn page with wallet providers.
 * 
 * @description Layout for batch teleburn feature
 * @version 0.1.1
 */

import { WalletProviders } from '@/components/wallet/WalletProviders';

export default function BatchLayout({
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

