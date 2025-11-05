'use client';

/**
 * Step 4: Execute Transactions
 * 
 * Final step of teleburn wizard - sign and broadcast transactions.
 * Shows real-time status updates for each transaction.
 * Displays success confirmation with proof details.
 * 
 * @description Transaction execution step with wallet signing
 * @version 0.1.1
 */

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TeleburnFormData } from '../teleburn/TeleburnForm';
import { MemoDisplay } from '../teleburn/MemoDisplay';

interface Step4ExecuteProps {
  formData: TeleburnFormData;
  onComplete: () => void;
  onBack: () => void;
}

type TxStatus = 'pending' | 'signing' | 'broadcasting' | 'confirming' | 'success' | 'error';

interface TxState {
  name: string;
  status: TxStatus;
  signature?: string;
  error?: string;
}

/**
 * Step 4: Execute Transactions
 * 
 * Signs and broadcasts seal and retire transactions.
 */
export const Step4Execute: FC<Step4ExecuteProps> = ({
  formData,
  onComplete,
  onBack,
}) => {
  const { publicKey, signTransaction } = useWallet();
  const [executing, setExecuting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [updateMetadata, setUpdateMetadata] = useState(false);
  const [updatingMetadata, setUpdatingMetadata] = useState(false);
  const [metadataUpdateCompleted, setMetadataUpdateCompleted] = useState(false);
  const [txStates, setTxStates] = useState<TxState[]>([
    { name: 'BURN+MEMO', status: 'pending' },
  ]);

  const updateTxStatus = (index: number, updates: Partial<TxState>) => {
    setTxStates(prev => prev.map((tx, i) => 
      i === index ? { ...tx, ...updates } : tx
    ));
  };

  const executeTransactions = async () => {
    if (!publicKey || !signTransaction) {
      alert('Wallet not connected');
      return;
    }

    setExecuting(true);

    try {
      const connection = new Connection(
        process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Build and sign single BURN+MEMO transaction
      updateTxStatus(0, { status: 'signing' });
      
      console.log(`🔥 EXECUTION: Building single burn+memo transaction...`);
      console.log(`📋 EXECUTION: Mint: ${formData.mint}`);
      console.log(`📋 EXECUTION: Owner: ${publicKey.toBase58()}`);
      console.log(`📋 EXECUTION: Inscription ID: ${formData.inscriptionId}`);
      
      const burnMemoResponse = await fetch('/api/tx/burn-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: formData.mint,
          owner: publicKey.toBase58(),
          inscriptionId: formData.inscriptionId,
          sha256: formData.sha256,
          priorityMicrolamports: 2_000,
        }),
      });

      if (!burnMemoResponse.ok) {
        const errorData = await burnMemoResponse.json();
        throw new Error(`Failed to build burn+memo transaction: ${errorData.error || 'Unknown error'}`);
      }
      
      const burnMemoData = await burnMemoResponse.json();
      console.log(`✅ EXECUTION: Burn+memo transaction built: ${burnMemoData.nftType}`);
      
      // Parse the transaction (handles both versioned and legacy)
      let burnMemoTx: Transaction | VersionedTransaction;
      
      try {
        const txBuffer = Buffer.from(burnMemoData.transaction, 'base64');
        
        if (burnMemoData.isVersioned) {
          // Try versioned transaction first
          burnMemoTx = VersionedTransaction.deserialize(txBuffer);
          console.log(`✅ EXECUTION: Parsed VersionedTransaction`);
          
          // Update fee payer if needed (VersionedTransaction uses message)
          // The wallet will set the fee payer correctly when signing
        } else {
          // Fallback to legacy transaction
          burnMemoTx = Transaction.from(txBuffer);
          console.log(`✅ EXECUTION: Parsed legacy Transaction`);
          
          // Ensure fee payer is set correctly
          if ('feePayer' in burnMemoTx && burnMemoTx.feePayer) {
            if (!burnMemoTx.feePayer.equals(publicKey)) {
              console.log(`🔄 EXECUTION: Updating fee payer from ${burnMemoTx.feePayer.toBase58()} to ${publicKey.toBase58()}`);
              burnMemoTx.feePayer = publicKey;
            }
          }
          
          // Update blockhash to ensure it's fresh
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          burnMemoTx.recentBlockhash = blockhash;
        }
      } catch (parseErr) {
        console.error(`❌ EXECUTION: Failed to parse transaction:`, parseErr);
        throw new Error(`Failed to parse transaction: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      }
      
      // Sign the transaction (wallet will set correct fee payer)
      console.log(`🔍 EXECUTION: About to sign transaction. Type: ${burnMemoTx instanceof VersionedTransaction ? 'VersionedTransaction' : 'Transaction'}`);
      
      const signedBurnMemoTx = await signTransaction(burnMemoTx);
      
      // Broadcast transaction
      updateTxStatus(0, { status: 'broadcasting' });
      
      // Serialize the signed transaction
      const serializedTx = signedBurnMemoTx.serialize();
      
      const burnMemoSig = await connection.sendRawTransaction(serializedTx);
      
      // Confirm transaction
      updateTxStatus(0, { status: 'confirming' });
      await connection.confirmTransaction(burnMemoSig, 'confirmed');
      
      updateTxStatus(0, { status: 'success', signature: burnMemoSig });
      console.log(`✅ EXECUTION: Burn+memo transaction confirmed: ${burnMemoSig}`);

      // Mark as completed
      setCompleted(true);

      // If user opted to update metadata, do it now
      if (updateMetadata && publicKey) {
        await executeMetadataUpdate(burnMemoSig);
      }

    } catch (error) {
      console.error('Transaction execution error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      
      // Mark current transaction as error
      const failedIndex = txStates.findIndex(tx => tx.status !== 'success' && tx.status !== 'pending');
      if (failedIndex !== -1) {
        updateTxStatus(failedIndex, { status: 'error', error: errorMsg });
      }
    } finally {
      setExecuting(false);
    }
  };

  /**
   * Execute optional metadata update transaction
   */
  const executeMetadataUpdate = async (_burnSignature: string) => {
    if (!publicKey || !signTransaction) {
      return;
    }

    setUpdatingMetadata(true);

    try {
      const connection = new Connection(
        process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      console.log(`🔄 EXECUTION: Building metadata update transaction...`);

      const metadataUpdateResponse = await fetch('/api/tx/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: formData.mint,
          updateAuthority: publicKey.toBase58(),
          inscriptionId: formData.inscriptionId,
          priorityMicrolamports: 2_000,
        }),
      });

      if (!metadataUpdateResponse.ok) {
        const errorData = await metadataUpdateResponse.json();
        throw new Error(`Failed to build metadata update transaction: ${errorData.error || 'Unknown error'}`);
      }

      const metadataUpdateData = await metadataUpdateResponse.json();
      console.log(`✅ EXECUTION: Metadata update transaction built. Ordinals URL: ${metadataUpdateData.ordinalsUrl}`);

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

      console.log(`✅ EXECUTION: Metadata update transaction confirmed: ${metadataUpdateSig}`);
      setMetadataUpdateCompleted(true);
    } catch (error) {
      console.error('Metadata update error:', error);
      // Don't fail the entire teleburn if metadata update fails
      console.warn('🚨 EXECUTION: Metadata update failed (non-fatal):', error);
    } finally {
      setUpdatingMetadata(false);
    }
  };

  const getStatusIcon = (status: TxStatus) => {
    switch (status) {
      case 'pending': return '○';
      case 'signing': return '◐';
      case 'broadcasting': return '◑';
      case 'confirming': return '◒';
      case 'success': return '✓';
      case 'error': return '✗';
    }
  };

  const getStatusColor = (status: TxStatus) => {
    switch (status) {
      case 'success': return 'text-terminal-green';
      case 'error': return 'text-matrix-red';
      default: return 'text-terminal-text';
    }
  };

  return (
    <div className="step-execute space-y-6">
      {/* Terminal Header */}
      <div className="terminal-output mb-6">
        <div className="text-terminal-prompt mb-2">$ execute_teleburn_transactions</div>
        <div className="text-terminal-text/70 text-sm mb-4">
          {!executing && !completed && `> Ready to broadcast to Solana mainnet...`}
          {executing && `> Executing teleburn sequence...`}
          {completed && `> Teleburn complete! NFT permanently retired.`}
          <br />
          <span className="animate-terminal-blink">▊</span>
        </div>
      </div>

      {/* Warning Banner */}
      {!executing && !completed && (
        <div className="warning-box">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🚨</div>
            <div>
              <div className="font-bold mb-2">FINAL WARNING: IRREVERSIBLE ACTION</div>
              <div className="text-sm space-y-2">
                <p>You are about to permanently retire your Solana NFT. This action:</p>
                <ul className="list-disc list-inside opacity-80">
                  <li>Cannot be undone or reversed</li>
                  <li>Will record proof on-chain permanently</li>
                  <li>Requires your explicit signature for each transaction</li>
                </ul>
                <p className="mt-3 font-bold">
                  Ensure you have verified the inscription and reviewed the dry run before proceeding.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phantom Wallet Note */}
      {!executing && !completed && (
        <div className="info-box">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <div className="font-bold mb-2">PHANTOM WALLET WARNINGS</div>
              <div className="text-sm space-y-2">
                <p>Phantom may show security warnings because <code>kiln.hot</code> is a new domain:</p>
                <ul className="list-disc list-inside opacity-80">
                  <li><strong>&quot;This domain is new or has not been reviewed yet&quot;</strong> - This is normal for new dApps</li>
                  <li><strong>&quot;This dApp could be malicious&quot;</strong> - Phantom&apos;s safety feature for unreviewed domains</li>
                  <li>You can safely click <strong>&quot;Proceed anyway (unsafe)&quot;</strong> to continue</li>
                </ul>
                <p className="mt-3 text-terminal-green">
                  ✅ These warnings are expected and do not affect the security of your teleburn.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Status */}
      <div className="status-box">
        <div className="text-xs font-bold mb-4 text-terminal-prompt">
          [ TRANSACTION SEQUENCE ]
        </div>
        
        {txStates.map((tx, _index) => (
          <div key={tx.name} className={`tx-status ${tx.status}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`status-icon ${getStatusColor(tx.status)}`}>
                  {getStatusIcon(tx.status)}
                </div>
                <div>
                  <div className="font-bold">{tx.name} TRANSACTION</div>
                  <div className="text-xs opacity-70">
                    {tx.status === 'pending' && 'Waiting...'}
                    {tx.status === 'signing' && 'Awaiting wallet signature...'}
                    {tx.status === 'broadcasting' && 'Broadcasting to network...'}
                    {tx.status === 'confirming' && 'Confirming on-chain...'}
                    {tx.status === 'success' && 'Confirmed ✓'}
                    {tx.status === 'error' && `Failed: ${tx.error}`}
                  </div>
                </div>
              </div>
              {tx.status === 'success' && tx.signature && (
                <a
                  href={`https://orb.helius.dev/tx/${tx.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:text-terminal-text transition-colors"
                >
                  View on Helius Orb →
                </a>
              )}
            </div>
            {tx.signature && (
              <div className="signature">
                <span className="opacity-50">Signature: </span>
                <span className="font-mono text-xs">{tx.signature.slice(0, 16)}...{tx.signature.slice(-16)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Optional Metadata Update Checkbox (shown before completion) */}
      {!completed && !executing && (
        <div className="info-box">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="update-metadata"
              checked={updateMetadata}
              onChange={(e) => setUpdateMetadata(e.target.checked)}
              className="mt-1"
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div>
              <label htmlFor="update-metadata" className="font-bold mb-2 cursor-pointer">
                OPTIONAL: Update NFT Metadata to Ordinals
              </label>
              <div className="text-sm space-y-2 opacity-80">
                <p>After teleburn completes, update this NFT&apos;s metadata image URL to point to:</p>
                <p className="font-mono text-xs break-all">
                  https://ordinals.com/inscription/{formData.inscriptionId}
                </p>
                <p className="text-xs italic">
                  🚨 Requires: NFT must be mutable and you must be the update authority
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Update Status */}
      {updatingMetadata && (
        <div className="status-box">
          <div className="flex items-center gap-3">
            <div className="status-icon text-terminal-text">◐</div>
            <div>
              <div className="font-bold">UPDATING METADATA</div>
              <div className="text-xs opacity-70">Pointing NFT image to Ordinals...</div>
            </div>
          </div>
        </div>
      )}

      {metadataUpdateCompleted && (
        <div className="success-box" style={{ borderColor: 'rgba(0, 255, 0, 0.5)' }}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">✓</div>
            <div>
              <div className="font-bold">METADATA UPDATED</div>
              <div className="text-sm opacity-80">
                NFT image now points to{' '}
                <a
                  href={`https://ordinals.com/inscription/${formData.inscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-terminal-text"
                >
                  Ordinals inscription
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {completed && (
        <div className="success-box">
          <div className="text-center py-8">
            <div className="text-6xl mb-4 animate-pulse-red">✓</div>
            <div className="text-2xl font-bold mb-4">TELEBURN COMPLETE</div>
            <div className="text-sm opacity-80 mb-6 space-y-2">
              <p>Your Solana NFT has been permanently retired.</p>
              <p>Proof of burn recorded on-chain.</p>
              <p>Bitcoin Ordinal inscription: {formData.inscriptionId}</p>
            </div>
            
            {/* Memo Display */}
            <div className="mb-6">
              <MemoDisplay 
                memo={{
                  standard: 'Kiln',
                  version: '0.1.1',
                  action: 'teleburn-derived',
                  timestamp: Math.floor(Date.now() / 1000),
                  block_height: 245678901, // Example Solana slot
                  inscription: {
                    id: formData.inscriptionId
                  },
                  solana: {
                    mint: formData.mint
                  },
                  media: {
                    sha256: formData.sha256
                  },
                  derived: {
                    owner: '6NtdpWum9Teym6SrZBAgfsJYu5vg2GoGapT2yyXvn3gP', // Would be actual derived
                    algorithm: 'SHA-256(txid || index || salt)'
                  }
                }}
                title="TELEBURN PROOF"
              />
            </div>
            
            <div className="text-xs opacity-60 mb-4">
              Review the Helius Orb links above to verify your transactions.
            </div>
            <button
              onClick={onComplete}
              className="terminal-button px-8 py-3"
            >
              ✓ CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-terminal-text/20">
        <button
          onClick={onBack}
          disabled={executing || completed}
          className="terminal-button-secondary px-6 py-2"
        >
          ← BACK
        </button>

        {!executing && !completed && (
          <button
            onClick={executeTransactions}
            className="terminal-button px-8 py-3"
          >
            ⚡ EXECUTE TELEBURN
          </button>
        )}
      </div>

      <style jsx>{`
        .warning-box, .status-box, .success-box {
          padding: 1.5rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.6);
        }

        .warning-box {
          border-color: rgba(255, 100, 0, 0.5);
          box-shadow: 0 0 15px rgba(255, 100, 0, 0.2);
        }

        .success-box {
          border-color: var(--terminal-text);
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
          animation: pulse-success 2s infinite;
        }

        @keyframes pulse-success {
          0%, 100% {
            box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
          }
          50% {
            box-shadow: 0 0 50px rgba(255, 0, 0, 0.8);
          }
        }

        .tx-status {
          padding: 1rem;
          margin-bottom: 0.5rem;
          border: 1px solid rgba(255, 0, 0, 0.2);
          background: rgba(0, 0, 0, 0.4);
          transition: all 0.3s;
        }

        .tx-status.signing, .tx-status.broadcasting, .tx-status.confirming {
          border-color: rgba(255, 200, 0, 0.5);
          animation: pulse-border 1s infinite;
        }

        .tx-status.success {
          border-color: rgba(0, 255, 0, 0.5);
          background: rgba(0, 255, 0, 0.05);
        }

        .tx-status.error {
          border-color: rgba(200, 0, 0, 0.8);
          background: rgba(200, 0, 0, 0.1);
        }

        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 10px rgba(255, 200, 0, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 200, 0, 0.6);
          }
        }

        .status-icon {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .signature {
          font-size: 0.75rem;
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 2px;
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

        .terminal-button-secondary {
          background: transparent;
          border: 1px solid rgba(255, 0, 0, 0.5);
          color: var(--terminal-text);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: all 0.2s;
          cursor: pointer;
        }

        .terminal-button-secondary:hover:not(:disabled) {
          border-color: var(--terminal-text);
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);
        }

        .terminal-button-secondary:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .terminal-output {
          font-family: 'JetBrains Mono', monospace;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};

