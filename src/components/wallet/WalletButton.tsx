'use client';

/**
 * Wallet Button Component
 * 
 * Connect/disconnect wallet button with red matrix theme styling.
 * Shows wallet address when connected.
 * 
 * @description Terminal-style wallet connection button
 * @version 0.1.1
 */

import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface WalletButtonProps {
  className?: string;
  showBalance?: boolean;
}

/**
 * Wallet Button Component
 * 
 * Styled wallet connection button matching red matrix theme.
 */
export const WalletButton: FC<WalletButtonProps> = ({ 
  className = '',
  showBalance = false 
}) => {
  const { publicKey } = useWallet();

  return (
    <div className={`wallet-button-container ${className}`}>
      <WalletMultiButton 
        className="terminal-button wallet-adapter-button-trigger"
      />
      
      {publicKey && showBalance && (
        <div className="mt-2 text-xs text-terminal-text opacity-70 font-mono">
          <span className="text-terminal-prompt">$</span> Connected: {publicKey.toBase58().slice(0, 8)}...
        </div>
      )}

      <style jsx global>{`
        /* Red Matrix Theme Wallet Button Overrides */
        .wallet-adapter-button {
          background-color: #000000 !important;
          border: 1px solid var(--terminal-text) !important;
          color: var(--terminal-text) !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 0.875rem !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.3) !important;
          transition: all 0.2s !important;
        }

        .wallet-adapter-button:hover:not([disabled]) {
          background-color: var(--terminal-text) !important;
          color: #000000 !important;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.6) !important;
        }

        .wallet-adapter-button:active:not([disabled]) {
          transform: none;
        }

        .wallet-adapter-button[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .wallet-adapter-button-trigger {
          padding: 0.75rem 1.5rem !important;
        }

        .wallet-adapter-modal-wrapper {
          background-color: rgba(0, 0, 0, 0.95) !important;
          backdrop-filter: blur(10px);
        }

        .wallet-adapter-modal {
          background-color: #0a0a0a !important;
          border: 1px solid var(--terminal-text) !important;
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.5) !important;
        }

        .wallet-adapter-modal-title {
          color: var(--terminal-text) !important;
          font-family: 'JetBrains Mono', monospace !important;
          text-transform: uppercase !important;
          letter-spacing: 0.1em !important;
        }

        .wallet-adapter-modal-list {
          background-color: transparent !important;
        }

        .wallet-adapter-modal-list-item {
          background-color: #000000 !important;
          border: 1px solid rgba(255, 0, 0, 0.3) !important;
          margin-bottom: 0.5rem !important;
        }

        .wallet-adapter-modal-list-item:hover:not([disabled]) {
          background-color: rgba(255, 0, 0, 0.1) !important;
          border-color: var(--terminal-text) !important;
          box-shadow: 0 0 15px rgba(255, 0, 0, 0.4) !important;
        }

        .wallet-adapter-modal-list-item img,
        .wallet-adapter-modal-list-item svg {
          display: none !important;
        }

        .wallet-adapter-button-start-icon,
        .wallet-adapter-button-end-icon {
          display: none !important;
        }

        .wallet-adapter-modal-button-close {
          background-color: transparent !important;
          color: var(--terminal-text) !important;
        }

        .wallet-adapter-modal-button-close:hover {
          background-color: rgba(255, 0, 0, 0.2) !important;
        }
      `}</style>
    </div>
  );
};

