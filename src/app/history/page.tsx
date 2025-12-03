'use client';

/**
 * History Page
 * 
 * Displays teleburn history for the connected wallet.
 * Allows users to view their past teleburns.
 * 
 * @description My Teleburns history view
 * @version 0.1.1
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Teleburn record structure
interface TeleburnRecord {
  signature: string;
  mint: string;
  inscriptionId: string;
  timestamp: number;
  blockTime: number | null;
  memo: {
    standard: string;
    version: string;
    action: string;
    method?: string;
    inscription?: { id: string };
    solana?: { mint: string };
    media?: { sha256: string };
    timestamp?: number;
  };
}

export default function HistoryPage() {
  const { publicKey, connected } = useWallet();
  const [teleburns, setTeleburns] = useState<TeleburnRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch history when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchHistory();
    } else {
      setTeleburns([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  /**
   * Fetch teleburn history from API
   */
  const fetchHistory = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          limit: 50,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTeleburns(data.teleburns);
      } else {
        setError(data.error || 'Failed to fetch history');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  /**
   * Truncate long strings with ellipsis
   */
  const truncate = (str: string, maxLen: number = 16): string => {
    if (str.length <= maxLen) return str;
    return `${str.slice(0, maxLen / 2)}...${str.slice(-maxLen / 2)}`;
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono">
      {/* Header */}
      <header className="border-b border-matrix-red/30 bg-matrix-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a 
                href="/" 
                className="text-4xl hover:text-matrix-red transition-colors duration-200"
                title="Return to Home"
              >
                ঌ
              </a>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-terminal-text glow-text whitespace-nowrap">
                [ My Teleburns ]
              </h1>
            </div>
            <div className="status-badge">
              <span>ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Terminal Style Header */}
        <div className="terminal-output mb-6">
          <div className="text-terminal-prompt mb-2">$ query_teleburn_history --wallet {publicKey?.toBase58().slice(0, 8) || '...'}</div>
          <div className="text-terminal-text/70 text-sm">
            {loading && '> Searching blockchain for Kiln teleburns...'}
            {!loading && connected && `> Found ${teleburns.length} teleburn${teleburns.length !== 1 ? 's' : ''}`}
            {!connected && '> Connect wallet to view your teleburn history'}
            <span className="animate-terminal-blink ml-1">▊</span>
          </div>
        </div>

        {/* Not Connected State */}
        {!connected && (
          <div className="terminal-window">
            <div className="terminal-window-header">
              <div className="terminal-window-controls">
                <div className="terminal-window-control red" />
                <div className="terminal-window-control yellow" />
                <div className="terminal-window-control green" />
              </div>
              <div className="terminal-window-title">wallet_required</div>
            </div>
            <div className="terminal-window-content p-8 text-center">
              <div className="text-4xl mb-4">🔒</div>
              <div className="text-xl mb-4">Connect Your Wallet</div>
              <div className="text-terminal-text/60 mb-6">
                Connect your Solana wallet to view your teleburn history.
              </div>
              <WalletMultiButton />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && connected && (
          <div className="terminal-window">
            <div className="terminal-window-header">
              <div className="terminal-window-controls">
                <div className="terminal-window-control red" />
                <div className="terminal-window-control yellow" />
                <div className="terminal-window-control green" />
              </div>
              <div className="terminal-window-title">loading_history</div>
            </div>
            <div className="terminal-window-content p-8">
              <div className="flex items-center justify-center gap-4">
                <div className="animate-spin text-2xl">🔥</div>
                <span>Scanning blockchain for Kiln teleburns...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="terminal-window border-red-500/50">
            <div className="terminal-window-header">
              <div className="terminal-window-controls">
                <div className="terminal-window-control red" />
                <div className="terminal-window-control yellow" />
                <div className="terminal-window-control green" />
              </div>
              <div className="terminal-window-title text-red-400">error</div>
            </div>
            <div className="terminal-window-content p-6">
              <div className="text-red-400">🚨 {error}</div>
              <button 
                onClick={fetchHistory}
                className="mt-4 px-4 py-2 border border-terminal-text/30 hover:border-terminal-text transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {connected && !loading && !error && teleburns.length === 0 && (
          <div className="terminal-window">
            <div className="terminal-window-header">
              <div className="terminal-window-controls">
                <div className="terminal-window-control red" />
                <div className="terminal-window-control yellow" />
                <div className="terminal-window-control green" />
              </div>
              <div className="terminal-window-title">no_records</div>
            </div>
            <div className="terminal-window-content p-8 text-center">
              <div className="text-4xl mb-4">📭</div>
              <div className="text-xl mb-4">No Teleburns Found</div>
              <div className="text-terminal-text/60 mb-6">
                You haven&apos;t performed any teleburns with this wallet yet.
              </div>
              <a 
                href="/teleburn"
                className="inline-block px-6 py-3 bg-matrix-red text-black font-bold hover:bg-red-400 transition-colors"
              >
                START TELEBURN →
              </a>
            </div>
          </div>
        )}

        {/* Teleburn History List */}
        {connected && !loading && teleburns.length > 0 && (
          <div className="space-y-4">
            {teleburns.map((burn, index) => (
              <div key={burn.signature} className="terminal-window">
                <div className="terminal-window-header">
                  <div className="terminal-window-controls">
                    <div className="terminal-window-control red" />
                    <div className="terminal-window-control yellow" />
                    <div className="terminal-window-control green" />
                  </div>
                  <div className="terminal-window-title">
                    teleburn_{String(index + 1).padStart(3, '0')}
                  </div>
                </div>
                <div className="terminal-window-content p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column - IDs */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-matrix-red">🔥</span>
                        <span className="text-terminal-text/60">Solana Mint:</span>
                        <a
                          href={`https://orb.helius.dev/address/${burn.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 font-mono text-sm"
                        >
                          {truncate(burn.mint, 20)}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400">₿</span>
                        <span className="text-terminal-text/60">Inscription:</span>
                        <a
                          href={`https://ordinals.com/inscription/${burn.inscriptionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 font-mono text-sm"
                        >
                          {truncate(burn.inscriptionId, 20)}
                        </a>
                      </div>
                    </div>

                    {/* Right Column - Details */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-terminal-text/60">📅 Date:</span>
                        <span className="font-mono text-sm">
                          {formatDate(burn.blockTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-terminal-text/60">📜 Tx:</span>
                        <a
                          href={`https://orb.helius.dev/tx/${burn.signature}?tab=instructions`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                        >
                          {truncate(burn.signature, 20)} →
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Version/Method Tags */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-terminal-text/10">
                    <span className="px-2 py-1 bg-matrix-red/20 text-matrix-red text-xs rounded">
                      Kiln v{burn.memo.version}
                    </span>
                    {burn.memo.method && (
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded">
                        {burn.memo.method}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Download History Button */}
        {connected && !loading && teleburns.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                const dataStr = JSON.stringify({
                  wallet: publicKey?.toBase58(),
                  exportedAt: new Date().toISOString(),
                  count: teleburns.length,
                  teleburns: teleburns.map(burn => ({
                    signature: burn.signature,
                    mint: burn.mint,
                    inscriptionId: burn.inscriptionId,
                    timestamp: burn.timestamp,
                    blockTime: burn.blockTime,
                    date: formatDate(burn.blockTime),
                    version: burn.memo.version,
                    method: burn.memo.method,
                  })),
                }, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `kiln-teleburns-${publicKey?.toBase58().slice(0, 8)}-${Date.now()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              className="px-6 py-2 border border-terminal-text/30 hover:border-terminal-text transition-colors text-sm"
            >
              Download History
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-matrix-red/30 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-terminal-text/40 text-sm">
          <a href="/teleburn" className="hover:text-matrix-red transition-colors">
            ← Back to Teleburn
          </a>
          <span className="mx-4">|</span>
          <a href="/verify" className="hover:text-matrix-red transition-colors">
            Verify a Teleburn →
          </a>
        </div>
      </footer>

      <style jsx>{`
        .terminal-window {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 0, 0, 0.3);
          border-radius: 8px;
          overflow: hidden;
        }

        .terminal-window-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.5);
          border-bottom: 1px solid rgba(255, 0, 0, 0.2);
        }

        .terminal-window-controls {
          display: flex;
          gap: 0.5rem;
        }

        .terminal-window-control {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .terminal-window-control.red { background: #ff5f56; }
        .terminal-window-control.yellow { background: #ffbd2e; }
        .terminal-window-control.green { background: #27ca40; }

        .terminal-window-title {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
          font-family: 'JetBrains Mono', monospace;
        }

        .terminal-window-content {
          padding: 1rem;
        }

        .terminal-output {
          font-family: 'JetBrains Mono', monospace;
        }

        @keyframes terminal-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .animate-terminal-blink {
          animation: terminal-blink 1s infinite;
        }

        /* Custom wallet button styling - red/orange theme */
        :global(.wallet-adapter-button) {
          background: rgba(255, 68, 0, 0.2) !important;
          border: 1px solid rgba(255, 100, 0, 0.5) !important;
          color: #ff6600 !important;
          font-family: 'JetBrains Mono', monospace !important;
        }

        :global(.wallet-adapter-button:hover) {
          background: rgba(255, 68, 0, 0.4) !important;
          border-color: #ff6600 !important;
          color: #ff8800 !important;
        }

        :global(.wallet-adapter-button-trigger) {
          background: rgba(255, 68, 0, 0.2) !important;
          border: 1px solid rgba(255, 100, 0, 0.5) !important;
          color: #ff6600 !important;
        }
      `}</style>
    </div>
  );
}

