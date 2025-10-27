'use client';

/**
 * Public Verification Page
 * 
 * Allows anyone to verify the teleburn status of a Solana mint.
 * Shows proof details, confidence scoring, and transaction links.
 * 
 * @description Public verification interface
 * @version 0.1.1
 */

import { useState } from 'react';
import { isValidPublicKey } from '@/lib/schemas';

export default function VerifyPage() {
  const [mintAddress, setMintAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; mint: string; confidence: string; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPublicKey(mintAddress)) {
      setError('Invalid Solana public key format');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: mintAddress }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <a 
              href="/" 
              className="home-button text-4xl hover:text-matrix-red transition-colors duration-200"
              title="Return to KILN Home"
            >
              ঌ
            </a>
            <h1 className="text-4xl font-bold text-terminal-text glow-text">
              [ Kiln Teleburn Verification ]
            </h1>
          </div>
          <p className="text-lg text-matrix-red/80 mb-2">
            <span className="text-terminal-prompt">$</span> Verify KILN teleburn status for any Solana mint
          </p>
          <p className="text-sm text-matrix-red/60">
            Check the teleburn status of any Solana NFT using cryptographic verification
          </p>
        </div>

        {/* Verification Form */}
        <div className="terminal-window mb-6" style={{ animation: 'none' }}>
          <div className="terminal-window-header">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-matrix-red animate-pulse-red"></div>
              <div className="w-3 h-3 rounded-full bg-matrix-red/50"></div>
              <div className="w-3 h-3 rounded-full bg-matrix-red/30"></div>
            </div>
            <div className="text-xs opacity-50">
              VERIFY_STATUS // Public Lookup
            </div>
          </div>
          <div className="terminal-window-content p-8">
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <label htmlFor="mint" className="block mb-2 text-sm font-bold">
                  <span className="text-terminal-prompt">→</span> SOLANA MINT ADDRESS
                </label>
                <input
                  id="mint"
                  type="text"
                  value={mintAddress}
                  onChange={(e) => setMintAddress(e.target.value)}
                  placeholder="e.g., 7xKXy9H8P3ZYQEXxf5..."
                  className="w-full px-4 py-3 bg-black/60 border border-terminal-text/30 text-terminal-text font-mono focus:outline-none focus:border-terminal-text focus:shadow-glow-red"
                  disabled={loading}
                />
                {error && (
                  <div className="mt-2 text-sm text-matrix-red">
                    ⚠️ {error}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !mintAddress}
                className="terminal-button w-full py-3"
              >
                {loading ? '◆ VERIFYING...' : '🔍 VERIFY TELEBURN STATUS'}
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="terminal-window" style={{ animation: 'none' }}>
            <div className="terminal-window-header">
              <div className="text-sm font-bold">VERIFICATION RESULT</div>
            </div>
            <div className="terminal-window-content p-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-terminal-text/20">
                  <div className="text-lg font-bold">STATUS</div>
                  <div className="text-2xl">
                    {result.status === 'unknown' ? '❓' : '✓'}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-70">Mint:</span>
                    <span className="font-mono text-xs">{result.mint}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Status:</span>
                    <span className="font-bold uppercase">{result.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Confidence:</span>
                    <span className="font-bold uppercase">{result.confidence}</span>
                  </div>
                </div>

                {result.message && (
                  <div className="mt-6 p-4 bg-black/40 border border-terminal-text/20 text-xs">
                    {result.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-6 border border-terminal-text/20 bg-black/40">
          <div className="text-xs space-y-2 opacity-70">
            <p><strong>How Verification Works:</strong></p>
            <p>This endpoint checks on-chain state to determine if a Solana NFT has been teleburned:</p>
            <ul className="list-disc list-inside ml-4">
              <li>Checks derived owner ATA balance</li>
              <li>Checks incinerator ATA balance</li>
              <li>Verifies token supply</li>
              <li>Searches transaction history for KILN memos</li>
              <li>Cross-validates across multiple RPCs</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glow-text {
          text-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
        }

        .terminal-window {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid var(--terminal-text);
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);
          backdrop-filter: blur(10px);
        }

        .terminal-window-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid var(--terminal-text)/30;
          background: rgba(255, 0, 0, 0.05);
        }

        .terminal-button {
          background: transparent;
          border: 1px solid var(--terminal-text);
          color: var(--terminal-text);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);
          transition: all 0.2s;
          cursor: pointer;
        }

        .terminal-button:hover:not(:disabled) {
          background: var(--terminal-text);
          color: #000;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
        }

        .terminal-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}

