'use client';

/**
 * Step 1: Connect Wallet
 * 
 * First step of teleburn wizard - wallet connection.
 * Terminal-style interface with red matrix theme.
 * 
 * @description Wallet connection step with balance display
 * @version 0.1.1
 */

import { FC, useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletButton } from '../wallet/WalletButton';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface Step1ConnectProps {
  onComplete: () => void;
}

/**
 * Step 1: Wallet Connection
 * 
 * Prompts user to connect wallet and displays balance.
 */
export const Step1Connect: FC<Step1ConnectProps> = ({ onComplete }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Fetch wallet balance when connected
  useEffect(() => {
    if (publicKey && connected) {
      setLoading(true);
      setBalanceError(null);
      connection.getBalance(publicKey)
        .then((bal) => {
          setBalance(bal / LAMPORTS_PER_SOL);
          setBalanceError(null);
        })
        .catch((err) => {
          console.error('Failed to fetch balance:', err);
          setBalance(0); // Set to 0 instead of null so we can proceed
          setBalanceError('Unable to fetch balance (RPC error). You may need to configure a custom RPC endpoint.');
        })
        .finally(() => setLoading(false));
    } else {
      setBalance(null);
      setBalanceError(null);
    }
  }, [publicKey, connected, connection]);

  // Auto-advance when wallet connected
  useEffect(() => {
    if (connected && publicKey && balance !== null) {
      // Small delay to show balance before advancing
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [connected, publicKey, balance, onComplete]);

  return (
    <div className="step-connect space-y-6">
      {/* Terminal Prompt */}
      <div className="terminal-output mb-8">
        <div className="text-terminal-prompt mb-2">$ init_teleburn_session</div>
        <div className="text-terminal-text/70 text-sm mb-4">
          {`> Initializing KILN.1 protocol...`}<br />
          {`> Awaiting wallet authentication...`}<br />
          <span className="animate-terminal-blink">▊</span>
        </div>
      </div>

      {/* Connection Status */}
      {!connected ? (
        <div className="connection-prompt space-y-6">
          <div className="alert alert-info">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <div className="font-bold mb-1">WALLET CONNECTION REQUIRED</div>
                <div className="text-sm opacity-80">
                  This protocol requires a Solana wallet to sign transactions.
                  Connect your wallet to begin the teleburn process.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <WalletButton />
          </div>

          <div className="security-notice text-xs opacity-60 text-center space-y-2">
            <div>🔒 Your keys never leave your wallet</div>
            <div>🔍 All transactions are simulated before execution</div>
            <div>⚡ No automatic signing - explicit approval required</div>
          </div>
        </div>
      ) : (
        <div className="connection-success space-y-6">
          {/* Success Message */}
          <div className="alert alert-success">
            <div className="flex items-start gap-3">
              <div className="text-2xl animate-pulse-red">✓</div>
              <div className="flex-1">
                <div className="font-bold mb-2">WALLET CONNECTED</div>
                <div className="space-y-1 text-sm font-mono">
                  <div>
                    <span className="text-terminal-prompt">ADDRESS:</span>{' '}
                    <span className="text-terminal-text">
                      {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                    </span>
                  </div>
                  <div>
                    <span className="text-terminal-prompt">BALANCE:</span>{' '}
                    {loading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : balanceError ? (
                      <span className="text-yellow-500 text-xs">{balance?.toFixed(4) || '0.0000'} SOL (unverified)</span>
                    ) : balance !== null ? (
                      <span className="text-terminal-text">
                        {balance.toFixed(4)} SOL
                      </span>
                    ) : (
                      <span className="opacity-50">Unknown</span>
                    )}
                  </div>
                  {balanceError && (
                    <div className="text-xs text-yellow-500/80 mt-2">
                      ⚠️ {balanceError}
                    </div>
                  )}
                  <div>
                    <span className="text-terminal-prompt">STATUS:</span>{' '}
                    <span className="text-terminal-text">AUTHENTICATED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-advancing message */}
          <div className="text-center text-sm opacity-70">
            <div className="animate-pulse">
              {`> Proceeding to inscription verification...`}
            </div>
          </div>
        </div>
      )}

      {/* Connection Requirements */}
      <div className="requirements-box">
        <div className="text-xs font-bold mb-3 text-terminal-prompt">
          [ REQUIREMENTS ]
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className={connected ? 'text-green-500' : 'text-terminal-text/40'}>
              {connected ? '✓' : '○'}
            </div>
            <div>Solana wallet installed (Phantom, Solflare, etc.)</div>
          </div>
          <div className="flex items-center gap-2">
            <div className={connected ? 'text-green-500' : 'text-terminal-text/40'}>
              {connected ? '✓' : '○'}
            </div>
            <div>Wallet connected to mainnet</div>
          </div>
          <div className="flex items-center gap-2">
            <div className={(balance !== null && balance > 0.01) ? 'text-green-500' : 'text-terminal-text/40'}>
              {(balance !== null && balance > 0.01) ? '✓' : '○'}
            </div>
            <div>Sufficient SOL for transaction fees (~0.01 SOL)</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .alert {
          padding: 1.5rem;
          border: 1px solid var(--terminal-text);
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(5px);
        }

        .alert-info {
          border-color: rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 15px rgba(255, 0, 0, 0.2);
        }

        .alert-success {
          border-color: var(--terminal-text);
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
          animation: pulse-border 2s infinite;
        }

        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 0, 0, 0.6);
          }
        }

        .requirements-box {
          padding: 1rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.4);
        }

        .security-notice {
          border-top: 1px solid rgba(255, 0, 0, 0.2);
          padding-top: 1rem;
        }

        .terminal-output {
          font-family: 'JetBrains Mono', monospace;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};

