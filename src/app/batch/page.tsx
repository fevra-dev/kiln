'use client';

/**
 * Batch Teleburn Page
 * 
 * Allows users to teleburn multiple NFTs in a single session.
 * Each NFT is processed sequentially.
 * 
 * @description Batch teleburn feature for multiple NFTs
 * @version 0.1.1
 */

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { isValidInscriptionId, isValidPublicKey } from '@/lib/schemas';
import { InscriptionVerifier } from '@/lib/inscription-verifier';
import { KilnEventLogger } from '@/lib/event-logger';

// Single teleburn item in the batch
interface BatchItem {
  id: string;
  mint: string;
  inscriptionId: string;
  sha256: string;
  status: 'pending' | 'validating' | 'ready' | 'burning' | 'success' | 'error';
  error?: string;
  signature?: string;
}

export default function BatchTeleburnPage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [newMint, setNewMint] = useState('');
  const [newInscriptionId, setNewInscriptionId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  /**
   * Add a new item to the batch
   */
  const addItem = useCallback(async () => {
    if (!newMint || !newInscriptionId) return;

    // Validate inputs
    if (!isValidPublicKey(newMint)) {
      alert('Invalid Solana mint address');
      return;
    }
    if (!isValidInscriptionId(newInscriptionId)) {
      alert('Invalid inscription ID format');
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: BatchItem = {
      id,
      mint: newMint,
      inscriptionId: newInscriptionId,
      sha256: '',
      status: 'validating',
    };

    setItems(prev => [...prev, newItem]);
    setNewMint('');
    setNewInscriptionId('');

    // Fetch SHA-256 for the inscription
    try {
      const result = await InscriptionVerifier.fetchAndHash(newInscriptionId);
      if (result.success && result.actualSha256) {
        setItems(prev => prev.map(item => 
          item.id === id 
            ? { ...item, sha256: result.actualSha256 || '', status: 'ready' }
            : item
        ));
      } else {
        setItems(prev => prev.map(item => 
          item.id === id 
            ? { ...item, status: 'error', error: result.error || 'Could not fetch inscription' }
            : item
        ));
      }
    } catch (error) {
      setItems(prev => prev.map(item => 
        item.id === id 
          ? { ...item, status: 'error', error: 'Failed to validate inscription' }
          : item
      ));
    }

    KilnEventLogger.log('batch_item_added', { mint: newMint, inscriptionId: newInscriptionId });
  }, [newMint, newInscriptionId]);

  /**
   * Remove an item from the batch
   */
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  /**
   * Execute all ready teleburns
   */
  const executeBatch = useCallback(async () => {
    if (!publicKey || !signTransaction) return;

    const readyItems = items.filter(item => item.status === 'ready');
    if (readyItems.length === 0) {
      alert('No items ready to burn');
      return;
    }

    setProcessing(true);
    KilnEventLogger.log('batch_burn_started', { count: readyItems.length });

    const rpcUrl = process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i];
      if (!item) continue; // TypeScript guard
      
      setCurrentIndex(i);

      // Update status to burning
      setItems(prev => prev.map(it => 
        it.id === item.id ? { ...it, status: 'burning' } : it
      ));

      try {
        // Build the burn+memo transaction
        const response = await fetch('/api/tx/burn-memo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mint: item.mint,
            owner: publicKey.toBase58(),
            inscriptionId: item.inscriptionId,
            sha256: item.sha256,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to build transaction');
        }

        const { transaction: txBase64 } = await response.json();

        // Deserialize and sign
        const txBuffer = Buffer.from(txBase64, 'base64');
        const tx = VersionedTransaction.deserialize(txBuffer);
        const signedTx = await signTransaction(tx);

        // Send transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        // Update status to success
        setItems(prev => prev.map(it => 
          it.id === item.id ? { ...it, status: 'success', signature } : it
        ));

        KilnEventLogger.log('batch_item_success', { mint: item.mint, signature });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setItems(prev => prev.map(it => 
          it.id === item.id ? { ...it, status: 'error', error: errorMessage } : it
        ));

        KilnEventLogger.log('batch_item_error', { mint: item.mint, error: errorMessage });
      }

      // Small delay between burns
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setProcessing(false);
    setCurrentIndex(-1);
    KilnEventLogger.log('batch_burn_completed', { 
      total: readyItems.length,
      success: items.filter(i => i.status === 'success').length,
    });
  }, [items, publicKey, signTransaction]);

  const readyCount = items.filter(i => i.status === 'ready').length;
  const successCount = items.filter(i => i.status === 'success').length;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono">
      {/* Header */}
      <header className="border-b border-matrix-red/30 bg-matrix-black/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <a 
                href="/" 
                className="text-4xl hover:text-matrix-red transition-colors duration-200"
                title="Return to Home"
              >
                ঌ
              </a>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-terminal-text glow-text whitespace-nowrap">
                [ Batch Teleburn ]
              </h1>
            </div>
            <div className="status-badge">
              <span>ONLINE</span>
            </div>
          </div>
          <p className="text-lg text-matrix-red/80 mb-2">
            <span className="text-terminal-prompt">$</span> batch_teleburn --multi
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Terminal Header */}
        <div className="terminal-output mb-6">
          <div className="text-terminal-text/70 text-sm">
            {`> Add multiple NFTs to teleburn in a single session`}
            <span className="animate-terminal-blink ml-1">▊</span>
          </div>
        </div>

        {/* Not Connected State */}
        {!connected && (
          <div className="terminal-window mb-6">
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
                Connect your Solana wallet to use batch teleburn.
              </div>
              <WalletMultiButton />
            </div>
          </div>
        )}

        {connected && (
          <>
            {/* Add New Item */}
            <div className="terminal-window mb-6">
              <div className="terminal-window-header">
                <div className="terminal-window-controls">
                  <div className="terminal-window-control red" />
                  <div className="terminal-window-control yellow" />
                  <div className="terminal-window-control green" />
                </div>
                <div className="terminal-window-title">add_to_batch</div>
              </div>
              <div className="terminal-window-content p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold mb-2 text-terminal-prompt">
                      SOLANA MINT ADDRESS
                    </label>
                    <input
                      type="text"
                      value={newMint}
                      onChange={(e) => setNewMint(e.target.value)}
                      className="w-full p-2 bg-black/50 border border-terminal-text/30 text-terminal-text font-mono text-sm"
                      placeholder="e.g., 7xKXy9H8P3ZY..."
                      disabled={processing}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 text-terminal-prompt">
                      BITCOIN INSCRIPTION ID
                    </label>
                    <input
                      type="text"
                      value={newInscriptionId}
                      onChange={(e) => setNewInscriptionId(e.target.value)}
                      className="w-full p-2 bg-black/50 border border-terminal-text/30 text-terminal-text font-mono text-sm"
                      placeholder="e.g., abc123...i0"
                      disabled={processing}
                    />
                  </div>
                </div>
                <button
                  onClick={addItem}
                  disabled={processing || !newMint || !newInscriptionId}
                  className="px-4 py-2 border border-terminal-text/50 hover:border-terminal-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + ADD TO BATCH
                </button>
              </div>
            </div>

            {/* Batch Items List */}
            {items.length > 0 && (
              <div className="terminal-window mb-6">
                <div className="terminal-window-header">
                  <div className="terminal-window-controls">
                    <div className="terminal-window-control red" />
                    <div className="terminal-window-control yellow" />
                    <div className="terminal-window-control green" />
                  </div>
                  <div className="terminal-window-title">
                    batch_queue ({items.length} items, {readyCount} ready, {successCount} complete)
                  </div>
                </div>
                <div className="terminal-window-content p-4">
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div 
                        key={item.id} 
                        className={`p-3 border ${
                          item.status === 'success' ? 'border-green-500/50 bg-green-500/10' :
                          item.status === 'error' ? 'border-red-500/50 bg-red-500/10' :
                          item.status === 'burning' ? 'border-orange-500/50 bg-orange-500/10 animate-pulse' :
                          item.status === 'ready' ? 'border-terminal-text/30' :
                          'border-terminal-text/20 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold">#{index + 1}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                item.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                item.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                item.status === 'burning' ? 'bg-orange-500/20 text-orange-400' :
                                item.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {item.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-terminal-text/70">
                              <span className="text-terminal-prompt">Mint:</span> {item.mint.slice(0, 16)}...
                            </div>
                            <div className="font-mono text-xs text-terminal-text/70">
                              <span className="text-orange-400">Inscription:</span> {item.inscriptionId.slice(0, 16)}...
                            </div>
                            {item.error && (
                              <div className="text-xs text-red-400 mt-1">🚨 {item.error}</div>
                            )}
                            {item.signature && (
                              <div className="text-xs text-green-400 mt-1">
                                ✓ <a 
                                  href={`https://orb.helius.dev/tx/${item.signature}?tab=instructions`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                >
                                  View Transaction →
                                </a>
                              </div>
                            )}
                          </div>
                          {item.status !== 'burning' && item.status !== 'success' && (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-400 hover:text-red-300 text-sm px-2"
                              disabled={processing}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Execute Button */}
            {items.length > 0 && (
              <div className="text-center">
                <button
                  onClick={executeBatch}
                  disabled={processing || readyCount === 0}
                  className={`px-8 py-3 font-bold text-lg ${
                    processing || readyCount === 0
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-matrix-red hover:bg-red-500 text-black'
                  } transition-colors`}
                >
                  {processing 
                    ? `🔥 BURNING ${currentIndex + 1} OF ${items.filter(i => i.status === 'ready' || i.status === 'burning').length}...`
                    : `🔥 EXECUTE BATCH (${readyCount} ITEMS)`
                  }
                </button>
                {processing && (
                  <div className="text-sm text-terminal-text/60 mt-2">
                    Do not close this page while burning...
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

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

