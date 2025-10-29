'use client';

/**
 * Step 3: Dry Run Preview
 * 
 * Third step of teleburn wizard - execute dry run simulation.
 * Shows complete transaction preview before execution.
 * User can download receipt and review all details.
 * 
 * @description Dry run simulation step with preview
 * @version 0.1.1
 */

import { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TeleburnFormData } from '../teleburn/TeleburnForm';
import { DryRunPreview } from '../teleburn/DryRunPreview';
import { DryRunReport } from '@/lib/dry-run';

interface Step3PreviewProps {
  formData: TeleburnFormData;
  onComplete: () => void;
  onBack: () => void;
}

/**
 * Step 3: Dry Run Preview
 * 
 * Executes dry run simulation and displays results.
 */
export const Step3Preview: FC<Step3PreviewProps> = ({
  formData,
  onComplete,
  onBack,
}) => {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeDryRun = useCallback(async () => {
    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }

    console.log('🚀 CLIENT: Starting dry run execution...');
    console.log('📋 CLIENT: Mint:', formData.mint);
    console.log('📋 CLIENT: Inscription ID:', formData.inscriptionId);

    setLoading(true);
    setError(null);

    try {
      // Call dry run API
      console.log('🌐 CLIENT: Calling /api/tx/simulate...');
      const response = await fetch('/api/tx/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer: publicKey.toBase58(),
          owner: publicKey.toBase58(),
          mint: formData.mint,
          inscriptionId: formData.inscriptionId,
          sha256: formData.sha256,
          method: formData.method,
          // Use Helius RPC for mainnet
          rpcUrl: process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Dry run simulation failed');
      }

      const data = await response.json();
      console.log('✅ CLIENT: Dry run completed successfully');
      console.log('📊 CLIENT: Report:', data.report);
      console.log('🔍 CLIENT: Debug info:', data.debug);
      
      // Log pNFT detection results specifically
      if (data.report?.debug?.pnftDetection) {
        console.log('🔍 CLIENT: pNFT Detection Results:', data.report.debug.pnftDetection);
      } else {
        console.log('❌ CLIENT: pNFT Detection Results: NOT FOUND in debug object');
        console.log('🔍 CLIENT: Available debug fields:', Object.keys(data.report?.debug || {}));
      }
      setReport(data.report);

    } catch (err) {
      console.error('Dry run error:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute dry run');
    } finally {
      setLoading(false);
    }
  }, [publicKey, formData.mint, formData.inscriptionId, formData.sha256, formData.method]);

  // Execute dry run on mount
  useEffect(() => {
    if (publicKey && !report && !loading) {
      executeDryRun();
    }
  }, [publicKey, executeDryRun, report, loading]);

  const handleDownloadReceipt = () => {
    if (!report) return;

    // Generate receipt JSON
    const receipt = {
      mode: 'dry-run',
      timestamp: report.timestamp,
      mint: report.mint,
      inscription: report.inscriptionId,
      method: report.method,
      steps: report.steps.map(step => ({
        name: step.name,
        description: step.description,
        fee_sol: step.estimatedFee / 1e9,
        success: step.simulation.success,
      })),
      total_fee_sol: report.totalEstimatedFee / 1e9,
      warnings: report.warnings,
      errors: report.errors,
      success: report.success,
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teleburn-rehearsal-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="step-preview space-y-6">
      {/* Terminal Header */}
      <div className="terminal-output mb-6">
        <div className="text-terminal-prompt mb-2">$ execute_dry_run_simulation</div>
        <div className="text-terminal-text/70 text-sm mb-4">
          {`> Building transactions...`}<br />
          {`> Simulating on-chain...`}<br />
          {`> Computing fees and warnings...`}<br />
          <span className="animate-terminal-blink">▊</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-box">
          <div className="flex items-center justify-center gap-4 py-12">
            <div className="spinner"></div>
            <div>
              <div className="font-bold mb-2">SIMULATING TELEBURN FLOW...</div>
              <div className="text-sm opacity-70">
                Building and simulating all transactions
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-box">
          <div className="flex items-start gap-3">
            <div className="text-2xl">✗</div>
            <div className="flex-1">
              <div className="font-bold mb-2 text-matrix-red">SIMULATION FAILED</div>
              <div className="text-sm mb-4">{error}</div>
              <button
                onClick={executeDryRun}
                className="terminal-button-secondary px-6 py-2"
              >
                🔄 RETRY SIMULATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success State - Show Report */}
      {report && (
        <>
          <DryRunPreview 
            report={report}
            onDownloadReceipt={handleDownloadReceipt}
          />

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t border-terminal-text/20">
            <button
              onClick={onBack}
              className="terminal-button-secondary px-6 py-2"
            >
              ← BACK
            </button>

            {report.success ? (
              <button
                onClick={onComplete}
                className="terminal-button px-8 py-3"
              >
                ⚡ PROCEED TO EXECUTION →
              </button>
            ) : (
              <div className="text-right">
                <div className="text-sm text-matrix-red mb-2">
                  Cannot proceed with errors
                </div>
                <button
                  onClick={onBack}
                  className="terminal-button-secondary px-6 py-2"
                >
                  EDIT PARAMETERS
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .loading-box, .error-box {
          padding: 2rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.6);
        }

        .error-box {
          border-color: rgba(200, 0, 0, 0.8);
          box-shadow: 0 0 20px rgba(200, 0, 0, 0.3);
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid rgba(255, 0, 0, 0.3);
          border-top-color: var(--terminal-text);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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

        .terminal-button:hover {
          background: var(--terminal-text);
          color: #000;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
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

        .terminal-button-secondary:hover {
          border-color: var(--terminal-text);
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);
        }

        .terminal-output {
          font-family: 'JetBrains Mono', monospace;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};

