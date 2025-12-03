/**
 * History Layout
 * 
 * Wraps the history page with wallet providers for wallet connection.
 * 
 * @description Layout for teleburn history page
 * @version 0.1.1
 */

import { WalletProviders } from '@/components/wallet/WalletProviders';

export default function HistoryLayout({
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

