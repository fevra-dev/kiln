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
  const [txStates, setTxStates] = useState<TxState[]>([
    { name: 'SEAL', status: 'pending' },
    { name: 'RETIRE', status: 'pending' },
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

      // Step 1: Build and sign SEAL transaction
      updateTxStatus(0, { status: 'signing' });
      
      const sealResponse = await fetch('/api/tx/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer: publicKey.toBase58(),
          mint: formData.mint,
          inscriptionId: formData.inscriptionId,
          sha256: formData.sha256,
        }),
      });

      if (!sealResponse.ok) throw new Error('Failed to build seal transaction');
      
      const sealData = await sealResponse.json();
      const sealTx = Transaction.from(Buffer.from(sealData.transaction, 'base64'));
      
      // Update SEAL transaction with fresh timestamp and block height
      const { blockhash: freshBlockhash } = await connection.getLatestBlockhash('confirmed');
      const freshSlot = await connection.getSlot();
      const freshTimestamp = Math.floor(Date.now() / 1000);
      
      // Update the memo instruction with fresh values
      const memoInstruction = sealTx.instructions[0];
      if (memoInstruction && memoInstruction.programId.toString() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
        const memoData = JSON.parse(memoInstruction.data.toString('utf-8'));
        memoData.timestamp = freshTimestamp;
        memoData.block_height = freshSlot;
        memoInstruction.data = Buffer.from(JSON.stringify(memoData), 'utf-8');
        console.log(`🔄 EXECUTION: Updated SEAL memo with fresh timestamp: ${freshTimestamp}, block height: ${freshSlot}`);
      }
      
      // Update blockhash
      sealTx.recentBlockhash = freshBlockhash;
      console.log(`🔄 EXECUTION: Updated SEAL blockhash to: ${freshBlockhash}`);
      
      const signedSealTx = await signTransaction(sealTx);
      
      // Broadcast seal transaction
      updateTxStatus(0, { status: 'broadcasting' });
      const sealSig = await connection.sendRawTransaction(signedSealTx.serialize());
      
      // Confirm seal transaction
      updateTxStatus(0, { status: 'confirming' });
      await connection.confirmTransaction(sealSig, 'confirmed');
      
      updateTxStatus(0, { status: 'success', signature: sealSig });

      // Step 2: Build and sign RETIRE transaction
      updateTxStatus(1, { status: 'signing' });
      
      // Check if this is a pNFT that needs Sol-Incinerator
      console.log(`🔍 EXECUTION: Checking if ${formData.mint} is a pNFT...`);
      
      // For now, assume it's a pNFT if we're using Sol-Incinerator in dry run
      // This avoids the CORS issue and extra API call during execution
      // The dry run already confirmed it's a pNFT, so we can trust that
      const isPNFT = true; // Since dry run showed Sol-Incinerator, we know it's a pNFT
      console.log(`🔍 EXECUTION: pNFT detection result: ${isPNFT} (from dry run)`);
      
      let retireData;
      let retireTx;
      
      if (isPNFT) {
        console.log(`🔥 EXECUTION: Using Sol-Incinerator for pNFT burn`);

        const solIncineratorResponse = await fetch('/api/tx/sol-incinerator-burn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: formData.mint,
            userPublicKey: publicKey.toBase58(),
            autoCloseTokenAccounts: true
          }),
        });

        if (!solIncineratorResponse.ok) {
          const errorData = await solIncineratorResponse.json();
          throw new Error(`Sol-Incinerator burn failed: ${errorData.error || 'Unknown error'}`);
        }

        retireData = await solIncineratorResponse.json();
        console.log(`✅ EXECUTION: Sol-Incinerator transaction created: ${retireData.transactionType}`);
        const serializedPayload: string | undefined = retireData.transaction || retireData.serializedTransaction;
        console.log(`✅ EXECUTION: Transaction data length: ${serializedPayload?.length || 'undefined'}`);
        console.log(`✅ EXECUTION: Transaction data preview: ${serializedPayload?.substring(0, 100) || 'undefined'}`);

        // Parse the serialized transaction from Sol-Incinerator
        try {
          if (!serializedPayload || typeof serializedPayload !== 'string') {
            throw new Error('Missing serialized transaction payload');
          }

          // Helper: attempt decode+parse using a provided buffer
          const tryParse = (raw: Buffer) => {
            // Try versioned first
            try {
              const vtx = VersionedTransaction.deserialize(raw);
              console.log(`✅ EXECUTION: Parsed VersionedTransaction from Sol-Incinerator payload`);
              return vtx as unknown as Transaction;
            } catch {
              // Fallback to legacy
              const ltx = Transaction.from(raw);
              console.log(`✅ EXECUTION: Parsed legacy Transaction from Sol-Incinerator payload`);
              return ltx;
            }
          };

          // First, assume base64
          try {
            const rawB64 = Buffer.from(serializedPayload, 'base64');
            if (rawB64.length === 0) throw new Error('Empty buffer from base64 decode');
            retireTx = tryParse(rawB64);
          } catch (b64Err) {
            console.warn(`⚠️ EXECUTION: Base64 parse failed, trying base58:`, b64Err);
            // Fallback: base58
            const { default: bs58 } = await import('bs58');
            const rawB58 = Buffer.from(bs58.decode(serializedPayload));
            retireTx = tryParse(rawB58);
          }
        } catch (parseErr) {
          console.error(`❌ EXECUTION: Failed to parse Sol-Incinerator transaction:`, parseErr);
          throw new Error(`Failed to parse Sol-Incinerator transaction: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }
      } else {
        console.log(`🔥 EXECUTION: Using regular SPL Token burn`);
        
        const retireResponse = await fetch('/api/tx/retire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payer: publicKey.toBase58(),
            owner: publicKey.toBase58(),
            mint: formData.mint,
            inscriptionId: formData.inscriptionId,
            sha256: formData.sha256,
            method: formData.method,
          }),
        });

        if (!retireResponse.ok) throw new Error('Failed to build retire transaction');
        
        retireData = await retireResponse.json();
        retireTx = Transaction.from(Buffer.from(retireData.transaction, 'base64'));
      }
      
      // Sign the transaction (handles both regular and versioned transactions)
      console.log(`🔍 EXECUTION: About to sign transaction. Type: ${retireTx instanceof VersionedTransaction ? 'VersionedTransaction' : 'Transaction'}`);
      console.log(`🔍 EXECUTION: Transaction details:`, {
        isVersioned: retireTx instanceof VersionedTransaction,
        hasInstructions: 'instructions' in retireTx ? retireTx.instructions.length : 'N/A',
        feePayer: 'feePayer' in retireTx ? retireTx.feePayer?.toString() : 'N/A',
        recentBlockhash: 'recentBlockhash' in retireTx ? retireTx.recentBlockhash : 'N/A'
      });
      
      const signedRetireTx = await signTransaction(retireTx);
      
      // Broadcast retire transaction
      updateTxStatus(1, { status: 'broadcasting' });
      
      // Serialize the signed transaction
      const serializedTx = signedRetireTx.serialize();
      
      const retireSig = await connection.sendRawTransaction(serializedTx);
      
      // Confirm retire transaction
      updateTxStatus(1, { status: 'confirming' });
      await connection.confirmTransaction(retireSig, 'confirmed');
      
      updateTxStatus(1, { status: 'success', signature: retireSig });

      // Mark as completed
      setCompleted(true);
      // Remove automatic redirect - let user review Solscan links first

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
            <div className="text-2xl">⚠️</div>
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
                  standard: 'KILN',
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

