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
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

export default function VerifyPage() {
  const { publicKey, signTransaction } = useWallet();
  const [mintAddress, setMintAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    mint: string;
    confidence: string;
    message?: string;
    inscriptionId?: string;
    sha256?: string;
    teleburnTimestamp?: number;
    blockTime?: number;
    sealSignature?: string;
    burnSignature?: string;
    supply?: string;
    isOfficialKilnBurn?: boolean;
    kilnMemo?: Record<string, unknown>;
    metadata?: {
      timestamp: string;
      protocol?: string;
      version?: string | null;
    };
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [updatingMetadata, setUpdatingMetadata] = useState(false);
  const [metadataUpdateCompleted, setMetadataUpdateCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper references for Kiln memo rendering
  const kilnMemoRecord = result?.kilnMemo
    ? (result.kilnMemo as Record<string, unknown>)
    : null;
  const kilnMemoMethodDisplay =
    kilnMemoRecord && kilnMemoRecord['method'] !== undefined && kilnMemoRecord['method'] !== null
      ? String(kilnMemoRecord['method'])
      : null;
  
  // Helper for timestamp display
  const kilnMemoTimestamp = kilnMemoRecord?.['timestamp'];
  const kilnMemoTimestampDisplay = kilnMemoTimestamp
    ? new Date(Number(kilnMemoTimestamp) * 1000).toLocaleString()
    : null;
  
  // Helper for nested objects
  const kilnMemoInscription = kilnMemoRecord?.['inscription'] as { id?: string } | null | undefined;
  const kilnMemoSolana = kilnMemoRecord?.['solana'] as { mint?: string } | null | undefined;
  const kilnMemoMedia = kilnMemoRecord?.['media'] as { sha256?: string } | null | undefined;

  /**
   * Copy text to clipboard with feedback
   */
  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  /**
   * Download the Kiln memo as JSON
   */
  const handleDownloadMemo = () => {
    if (!result?.kilnMemo) return;
    
    const memoWithMetadata = {
      ...result.kilnMemo,
      _verification: {
        verifiedAt: new Date().toISOString(),
        burnSignature: result.burnSignature,
        blockTime: result.blockTime,
        supply: result.supply,
      }
    };
    
    const blob = new Blob([JSON.stringify(memoWithMetadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiln-teleburn-${result.mint.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  /**
   * Handle metadata update transaction
   */
  const handleUpdateMetadata = async () => {
    if (!publicKey || !signTransaction || !result?.inscriptionId) {
      return;
    }

    setUpdatingMetadata(true);

    try {
      const connection = new Connection(
        process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      const metadataUpdateResponse = await fetch('/api/tx/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: mintAddress,
          updateAuthority: publicKey.toBase58(),
          inscriptionId: result.inscriptionId,
          priorityMicrolamports: 2_000,
        }),
      });

      if (!metadataUpdateResponse.ok) {
        const errorData = await metadataUpdateResponse.json();
        throw new Error(`Failed to build metadata update transaction: ${errorData.error || 'Unknown error'}`);
      }

      const metadataUpdateData = await metadataUpdateResponse.json();

      // Parse the transaction
      let metadataUpdateTx: Transaction | VersionedTransaction;
      const txBuffer = Buffer.from(metadataUpdateData.transaction, 'base64');

      if (metadataUpdateData.isVersioned) {
        metadataUpdateTx = VersionedTransaction.deserialize(txBuffer);
      } else {
        metadataUpdateTx = Transaction.from(txBuffer);
        if ('feePayer' in metadataUpdateTx && metadataUpdateTx.feePayer) {
          if (!metadataUpdateTx.feePayer.equals(publicKey)) {
            metadataUpdateTx.feePayer = publicKey;
          }
        }
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        metadataUpdateTx.recentBlockhash = blockhash;
      }

      // Sign and send
      const signedMetadataUpdateTx = await signTransaction(metadataUpdateTx);
      const serializedTx = signedMetadataUpdateTx.serialize();
      const metadataUpdateSig = await connection.sendRawTransaction(serializedTx);
      await connection.confirmTransaction(metadataUpdateSig, 'confirmed');

      setMetadataUpdateCompleted(true);
    } catch (error) {
      console.error('Metadata update error:', error);
      alert(`Metadata update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdatingMetadata(false);
    }
  };

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <a 
                href="/" 
                className="text-4xl text-terminal-text glow-text hover:text-matrix-red transition-colors"
                title="Return to Home"
              >
                ঌ
              </a>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-terminal-text glow-text whitespace-nowrap">
                [ Teleburn Verification ]
              </h1>
            </div>
            <div className="status-badge">
              <span>ONLINE</span>
            </div>
          </div>
          <p className="text-lg text-matrix-red/80 mb-2">
            <span className="text-terminal-prompt">$</span> verify_teleburn
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
                    🚨 {error}
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
              {result.isOfficialKilnBurn && (
                <div className="kiln-badge">
                  🔥 OFFICIAL KILN BURN
                </div>
              )}
            </div>
            <div className="terminal-window-content p-8">
              <div className="space-y-4">
                {/* Status Badge */}
                <div className={`status-banner ${result.isOfficialKilnBurn ? 'official' : result.status === 'burned' ? 'burned' : 'active'}`}>
                  <div className="status-icon">
                    {result.isOfficialKilnBurn ? '🔥' : result.status === 'burned' ? '🔥' : result.status === 'active' ? '✓' : '❓'}
                  </div>
                  <div className="status-text">
                    <div className="status-title">
                      {result.isOfficialKilnBurn 
                        ? 'OFFICIAL KILN TELEBURN' 
                        : result.status === 'burned' 
                          ? 'BURNED (NO KILN MEMO)' 
                          : result.status === 'active' 
                            ? 'ACTIVE (NOT BURNED)' 
                            : 'UNKNOWN STATUS'}
                    </div>
                    <div className="status-subtitle">
                      {result.isOfficialKilnBurn 
                        ? 'Kiln protocol memo found on-chain' 
                        : result.status === 'burned' 
                          ? 'Supply is zero but no Kiln memo detected'
                          : 'NFT is still active with positive supply'}
                    </div>
                  </div>
                </div>

                <div className="result-grid">
                  {/* Mint Address */}
                  <div className="result-row">
                    <span className="result-label">Mint Address</span>
                    <div className="result-value-group">
                      <span className="font-mono text-xs">{result.mint.slice(0, 16)}...{result.mint.slice(-8)}</span>
                      <button 
                        onClick={() => handleCopy(result.mint, 'mint')}
                        className="copy-btn"
                        title="Copy mint address"
                      >
                        {copyFeedback === 'mint' ? '✓' : '📋'}
                      </button>
                    </div>
                  </div>

                  {/* Supply */}
                  <div className="result-row">
                    <span className="result-label">Supply</span>
                    <span className={`font-bold ${result.supply === '0' ? 'text-orange-400' : 'text-terminal-green'}`}>
                      {result.supply || '0'}
                    </span>
                  </div>

                  {/* Inscription Link - Prominent */}
                  {result.inscriptionId && (
                    <div className="inscription-link-box">
                      <div className="inscription-header">
                        <span className="text-orange-400 font-bold">🔗 BITCOIN INSCRIPTION</span>
                      </div>
                      <a
                        href={`https://ordinals.com/inscription/${result.inscriptionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inscription-link"
                      >
                        <span className="font-mono text-sm">{result.inscriptionId}</span>
                        <span className="link-arrow">→</span>
                      </a>
                      <button 
                        onClick={() => handleCopy(result.inscriptionId!, 'inscription')}
                        className="copy-btn-inline"
                        title="Copy inscription ID"
                      >
                        {copyFeedback === 'inscription' ? '✓ Copied' : '📋 Copy ID'}
                      </button>
                    </div>
                  )}

                  {/* Timestamps */}
                  {result.teleburnTimestamp && (
                    <div className="result-row result-section">
                      <span className="result-label">Memo Timestamp</span>
                      <span className="font-mono text-xs">
                        {new Date(result.teleburnTimestamp * 1000).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {result.blockTime && (
                    <div className="result-row">
                      <span className="result-label">Block Time</span>
                      <span className="font-mono text-xs">
                        {new Date(result.blockTime * 1000).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* SHA-256 */}
                  {result.sha256 && (
                    <div className="result-row result-section">
                      <span className="result-label">SHA-256</span>
                      <div className="result-value-group">
                        <span className="font-mono text-xs">{result.sha256.slice(0, 16)}...{result.sha256.slice(-8)}</span>
                        <button 
                          onClick={() => handleCopy(result.sha256!, 'sha256')}
                          className="copy-btn"
                          title="Copy SHA-256"
                        >
                          {copyFeedback === 'sha256' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transaction Signatures */}
                  {result.burnSignature && (
                    <div className="result-row result-section">
                      <span className="result-label">Burn Tx</span>
                      <div className="result-value-group">
                        <a
                          href={`https://orb.helius.dev/tx/${result.burnSignature}?tab=instructions`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:text-orange-300 hover:underline font-mono"
                        >
                          {result.burnSignature.slice(0, 12)}...
                        </a>
                        <button 
                          onClick={() => handleCopy(result.burnSignature!, 'burnSig')}
                          className="copy-btn"
                          title="Copy signature"
                        >
                          {copyFeedback === 'burnSig' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  )}

                  {result.sealSignature && (
                    <div className="result-row">
                      <span className="result-label">Seal Tx</span>
                      <div className="result-value-group">
                        <a
                          href={`https://orb.helius.dev/tx/${result.sealSignature}?tab=instructions`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:text-orange-300 hover:underline font-mono"
                        >
                          {result.sealSignature.slice(0, 12)}...
                        </a>
                        <button 
                          onClick={() => handleCopy(result.sealSignature!, 'sealSig')}
                          className="copy-btn"
                          title="Copy signature"
                        >
                          {copyFeedback === 'sealSig' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Parsed Kiln Memo Display */}
                {result.kilnMemo && (
                  <div className="memo-display">
                    <div className="memo-header">
                      <span className="text-orange-400 font-bold">📜 KILN MEMO (ON-CHAIN)</span>
                    </div>
                    <div className="memo-grid">
                      <div className="memo-row">
                        <span className="memo-label">Standard</span>
                        <span className="memo-value">
                          {String((result.kilnMemo as Record<string, unknown>)?.['standard'] || 'Kiln')}
                        </span>
                      </div>
                      <div className="memo-row">
                        <span className="memo-label">Version</span>
                        <span className="memo-value">
                          {String((result.kilnMemo as Record<string, unknown>)?.['version'] || '-')}
                        </span>
                      </div>
                      <div className="memo-row">
                        <span className="memo-label">Action</span>
                        <span className="memo-value text-orange-400">
                          {String((result.kilnMemo as Record<string, unknown>)?.['action'] || '-')}
                        </span>
                      </div>
                      {kilnMemoMethodDisplay && (
                        <div className="memo-row">
                          <span className="memo-label">Method</span>
                          <span className="memo-value">{kilnMemoMethodDisplay}</span>
                        </div>
                      )}
                      {kilnMemoInscription?.id && (
                        <div className="memo-row">
                          <span className="memo-label">Inscription</span>
                          <a
                            href={`https://ordinals.com/inscription/${kilnMemoInscription.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="memo-value text-orange-400 hover:text-orange-300 hover:underline"
                          >
                            {kilnMemoInscription.id.slice(0, 24)}... →
                          </a>
                        </div>
                      )}
                      {kilnMemoSolana?.mint && (
                        <div className="memo-row">
                          <span className="memo-label">Solana Mint</span>
                          <span className="memo-value font-mono text-xs">
                            {kilnMemoSolana.mint.slice(0, 16)}...
                          </span>
                        </div>
                      )}
                      {kilnMemoMedia?.sha256 && (
                        <div className="memo-row">
                          <span className="memo-label">Media SHA-256</span>
                          <span className="memo-value font-mono text-xs">
                            {kilnMemoMedia.sha256.slice(0, 16)}...
                          </span>
                        </div>
                      )}
                      {kilnMemoTimestampDisplay && (
                        <div className="memo-row">
                          <span className="memo-label">Timestamp</span>
                          <span className="memo-value">
                            {kilnMemoTimestampDisplay}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Download Memo Button */}
                {result.kilnMemo && (
                  <div className="download-section">
                    <button
                      onClick={handleDownloadMemo}
                      className="download-btn"
                    >
                      📥 DOWNLOAD KILN MEMO (JSON)
                    </button>
                    <div className="text-xs opacity-60 mt-2">
                      Save the on-chain Kiln teleburn proof for your records
                    </div>
                  </div>
                )}


                {/* Optional Metadata Update (only if burned and inscription found) */}
                {result.status === 'burned' && result.inscriptionId && (
                  <div className="mt-6 p-4 bg-black/40 border border-terminal-text/20">
                    {publicKey && signTransaction ? (
                      <>
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={handleUpdateMetadata}
                            disabled={updatingMetadata || metadataUpdateCompleted}
                            className="terminal-button px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingMetadata ? 'UPDATING...' : metadataUpdateCompleted ? '✓ UPDATED' : 'UPDATE METADATA'}
                          </button>
                          <div className="flex-1">
                            <div className="font-bold mb-2">
                              Update NFT Metadata to Ordinals Link
                            </div>
                            <div className="text-xs space-y-2 opacity-80">
                              <p>Update this NFT&apos;s metadata image URL to point to the Ordinals content.</p>
                              <p className="font-mono text-xs break-all text-orange-400">
                                https://ordinals.com/content/{result.inscriptionId}
                              </p>
                              <p className="text-xs italic">
                                🚨 Requires: NFT must be mutable and you must be the update authority
                              </p>
                            </div>
                          </div>
                        </div>
                        {metadataUpdateCompleted && (
                          <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 text-xs">
                            ✓ Metadata update transaction confirmed
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs opacity-70 space-y-3">
                        <p className="font-bold mb-2">Connect Wallet to Update Metadata</p>
                        <p>Connect your wallet to update this NFT&apos;s metadata image URL to point to the Ordinals inscription.</p>
                        <div className="flex justify-start">
                          <WalletMultiButton className="!bg-black/60 !border-terminal-text/30 hover:!bg-black/80" />
                        </div>
                      </div>
                    )}
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
          border-bottom: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(255, 0, 0, 0.05);
        }

        .kiln-badge {
          background: linear-gradient(135deg, rgba(255, 100, 0, 0.3), rgba(255, 50, 0, 0.2));
          border: 1px solid rgba(255, 100, 0, 0.5);
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: bold;
          color: #ff6600;
          animation: pulse-badge 2s infinite;
        }

        @keyframes pulse-badge {
          0%, 100% { box-shadow: 0 0 5px rgba(255, 100, 0, 0.3); }
          50% { box-shadow: 0 0 15px rgba(255, 100, 0, 0.6); }
        }

        .status-banner {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          margin-bottom: 1rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
        }

        .status-banner.official {
          background: linear-gradient(135deg, rgba(255, 100, 0, 0.15), rgba(255, 50, 0, 0.1));
          border-color: rgba(255, 100, 0, 0.5);
        }

        .status-banner.burned {
          background: rgba(255, 150, 0, 0.1);
          border-color: rgba(255, 150, 0, 0.3);
        }

        .status-banner.active {
          background: rgba(0, 200, 0, 0.1);
          border-color: rgba(0, 200, 0, 0.3);
        }

        .status-icon {
          font-size: 2rem;
        }

        .status-title {
          font-weight: bold;
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }

        .status-subtitle {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .result-grid {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .result-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255, 0, 0, 0.1);
        }

        .result-row.result-section {
          margin-top: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 0, 0, 0.2);
        }

        .result-label {
          font-size: 0.75rem;
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          min-width: 120px;
        }

        .result-value-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .copy-btn {
          background: transparent;
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: var(--terminal-text);
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: rgba(255, 0, 0, 0.1);
          border-color: var(--terminal-text);
        }

        .download-section {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(255, 100, 0, 0.05);
          border: 1px solid rgba(255, 100, 0, 0.3);
          text-align: center;
        }

        .download-btn {
          background: transparent;
          border: 1px solid rgba(255, 100, 0, 0.5);
          color: #ff6600;
          padding: 0.75rem 1.5rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .download-btn:hover {
          background: rgba(255, 100, 0, 0.2);
          box-shadow: 0 0 15px rgba(255, 100, 0, 0.3);
        }

        .inscription-link-box {
          background: linear-gradient(135deg, rgba(255, 100, 0, 0.1), rgba(255, 50, 0, 0.05));
          border: 1px solid rgba(255, 100, 0, 0.4);
          padding: 1rem;
          margin: 1rem 0;
        }

        .inscription-header {
          margin-bottom: 0.75rem;
          font-size: 0.75rem;
        }

        .inscription-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 100, 0, 0.3);
          color: #ff9500;
          text-decoration: none;
          transition: all 0.2s;
          margin-bottom: 0.5rem;
          word-break: break-all;
        }

        .inscription-link:hover {
          background: rgba(255, 100, 0, 0.1);
          border-color: rgba(255, 100, 0, 0.6);
        }

        .link-arrow {
          margin-left: 0.5rem;
          flex-shrink: 0;
        }

        .copy-btn-inline {
          background: transparent;
          border: 1px solid rgba(255, 100, 0, 0.3);
          color: #ff9500;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-btn-inline:hover {
          background: rgba(255, 100, 0, 0.1);
        }

        .memo-display {
          background: rgba(255, 100, 0, 0.05);
          border: 1px solid rgba(255, 120, 0, 0.4);
          padding: 1rem;
          margin: 1rem 0;
        }

        .memo-header {
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255, 120, 0, 0.3);
          font-size: 0.875rem;
        }

        .memo-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .memo-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255, 120, 0, 0.15);
        }

        .memo-label {
          font-size: 0.75rem;
          opacity: 0.6;
          text-transform: uppercase;
          min-width: 100px;
        }

        .memo-value {
          font-size: 0.875rem;
          text-align: right;
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

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .result-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .result-label {
            min-width: auto;
          }

          .result-value-group {
            width: 100%;
            justify-content: space-between;
          }

          .memo-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }

          .memo-label {
            min-width: auto;
          }

          .memo-value {
            text-align: left;
            word-break: break-all;
          }

          .status-banner {
            flex-direction: column;
            text-align: center;
            padding: 1rem;
          }

          .status-icon {
            font-size: 1.5rem;
          }

          .status-title {
            font-size: 0.875rem;
          }

          .inscription-link {
            flex-direction: column;
            gap: 0.5rem;
          }

          .inscription-link span {
            font-size: 0.65rem;
            word-break: break-all;
          }

          .kiln-badge {
            font-size: 0.6rem;
            padding: 0.15rem 0.5rem;
          }

          .download-btn {
            font-size: 0.75rem;
            padding: 0.5rem 1rem;
          }
        }
      `}</style>
    </main>
  );
}

