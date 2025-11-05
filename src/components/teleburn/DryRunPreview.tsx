'use client';

/**
 * Dry Run Preview Component
 * 
 * Displays dry run simulation results with expandable transaction details.
 * Terminal-style interface with red matrix theme.
 * Shows fees, warnings, errors, and allows receipt download.
 * 
 * @description Interactive dry run results viewer
 * @version 0.1.1
 */

import { FC, useState } from 'react';
import { DryRunReport } from '@/lib/dry-run';

interface DryRunPreviewProps {
  report: DryRunReport;
  onDownloadReceipt?: () => void;
}

/**
 * Dry Run Preview Component
 * 
 * Displays simulation results with expandable details.
 */
export const DryRunPreview: FC<DryRunPreviewProps> = ({ 
  report,
  onDownloadReceipt 
}) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const toggleStep = (stepName: string) => {
    setExpandedStep(expandedStep === stepName ? null : stepName);
  };

  return (
    <div className="dry-run-preview space-y-6">
      {/* Status Banner */}
      <div className={`status-banner ${report.success ? 'success' : 'error'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {report.success ? '✓' : '✗'}
            </div>
            <div>
              <div className="font-bold text-lg">
                {report.success ? 'READY TO TELEBURN' : 'SIMULATION FAILED'}
              </div>
              <div className="text-sm opacity-80">
                {report.success 
                  ? 'All systems verified. Your NFT is ready for teleburning!'
                  : 'Errors detected. Review issues before proceeding.'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70">Total Est. Fee</div>
            <div className="text-lg font-bold">
              {(report.totalEstimatedFee / 1e9).toFixed(4)} SOL
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="warnings-box">
          <div className="flex items-start gap-2 mb-3">
            <div className="text-xl">🚨</div>
            <div className="font-bold text-sm">WARNINGS ({report.warnings.length})</div>
          </div>
          <div className="space-y-1">
            {report.warnings.map((warning, i) => (
              <div key={i} className="text-xs opacity-80">
                • {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {report.errors.length > 0 && (
        <div className="errors-box">
          <div className="flex items-start gap-2 mb-3">
            <div className="text-xl">✗</div>
            <div className="font-bold text-sm text-matrix-red">ERRORS ({report.errors.length})</div>
          </div>
          <div className="space-y-1">
            {report.errors.map((error, i) => (
              <div key={i} className="text-xs text-matrix-red">
                • {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Steps */}
      <div className="steps-box">
        <div className="font-bold text-sm mb-4 text-terminal-prompt">
          [ TRANSACTION SEQUENCE ]
        </div>
        
        {report.steps.map((step, index) => (
          <div key={step.name} className="step-item mb-3">
            <button
              onClick={() => toggleStep(step.name)}
              className="step-header w-full"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`step-number ${step.simulation.success ? 'success' : 'error'}`}>
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{step.name.toUpperCase()}</div>
                    <div className="text-xs opacity-70">{step.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs opacity-70">Fee</div>
                    <div className="text-sm">{(step.estimatedFee / 1e9).toFixed(6)} SOL</div>
                  </div>
                  <div className="expand-icon">
                    {expandedStep === step.name ? '▼' : '▶'}
                  </div>
                </div>
              </div>
            </button>

            {expandedStep === step.name && (
              <div className="step-details">
                {/* Simulation Status */}
                <div className="detail-row">
                  <div className="detail-label">Simulation Status:</div>
                  <div className={step.simulation.success ? 'text-green-500' : 'text-matrix-red'}>
                    {step.simulation.success ? '✓ Success' : '✗ Failed'}
                  </div>
                </div>

                {step.simulation.error && (
                  <div className="detail-row">
                    <div className="detail-label">Error:</div>
                    <div className="text-matrix-red text-xs">{step.simulation.error}</div>
                  </div>
                )}

                {step.simulation.unitsConsumed && (
                  <div className="detail-row">
                    <div className="detail-label">Compute Units:</div>
                    <div>{step.simulation.unitsConsumed.toLocaleString()}</div>
                  </div>
                )}

                {/* Decoded Instructions */}
                <div className="detail-row">
                  <div className="detail-label">Instructions:</div>
                  <div className="text-xs space-y-1">
                    {step.decoded.instructions.map((ix, i) => (
                      <div key={i} className="instruction-item">
                        <div className="font-bold">{ix.instructionName}</div>
                        <div className="opacity-70">{ix.programName}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simulation Logs (if available) */}
                {step.simulation.logs && step.simulation.logs.length > 0 && (
                  <div className="detail-row">
                    <div className="detail-label">Logs:</div>
                    <div className="logs-container">
                      {step.simulation.logs.slice(0, 5).map((log, i) => (
                        <div key={i} className="log-line">{log}</div>
                      ))}
                      {step.simulation.logs.length > 5 && (
                        <div className="opacity-50 text-xs">
                          ... {step.simulation.logs.length - 5} more lines
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="summary-box">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs opacity-70 mb-1">Total Steps</div>
            <div className="text-xl font-bold">{report.steps.length}</div>
          </div>
          <div>
            <div className="text-xs opacity-70 mb-1">Compute Units</div>
            <div className="text-xl font-bold">{report.totalComputeUnits.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs opacity-70 mb-1">Total Fee</div>
            <div className="text-xl font-bold">{(report.totalEstimatedFee / 1e9).toFixed(4)} SOL</div>
          </div>
        </div>
      </div>

      {/* Download Receipt Button */}
      {onDownloadReceipt && (
        <div className="flex justify-center">
          <button
            onClick={onDownloadReceipt}
            className="terminal-button-secondary px-6 py-2"
          >
            💾 DOWNLOAD REHEARSAL RECEIPT
          </button>
        </div>
      )}

      <style jsx>{`
        .status-banner {
          padding: 1.5rem;
          border: 2px solid var(--terminal-text);
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(5px);
        }

        .status-banner.success {
          border-color: var(--terminal-text);
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
        }

        .status-banner.error {
          border-color: rgba(200, 0, 0, 0.8);
          box-shadow: 0 0 20px rgba(200, 0, 0, 0.4);
        }

        .warnings-box, .errors-box {
          padding: 1rem;
          border: 1px solid;
          background: rgba(0, 0, 0, 0.4);
        }

        .warnings-box {
          border-color: rgba(255, 100, 0, 0.5);
        }

        .errors-box {
          border-color: rgba(200, 0, 0, 0.5);
        }

        .steps-box {
          padding: 1.5rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.4);
        }

        .step-item {
          border: 1px solid rgba(255, 0, 0, 0.2);
          background: rgba(0, 0, 0, 0.3);
        }

        .step-header {
          padding: 1rem;
          width: 100%;
          text-align: left;
          transition: all 0.2s;
          cursor: pointer;
        }

        .step-header:hover {
          background: rgba(255, 0, 0, 0.05);
        }

        .step-number {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-bold;
          font-size: 0.875rem;
          border: 2px solid;
        }

        .step-number.success {
          border-color: var(--terminal-text);
          background: rgba(255, 0, 0, 0.1);
        }

        .step-number.error {
          border-color: rgba(200, 0, 0, 0.8);
          background: rgba(200, 0, 0, 0.1);
        }

        .expand-icon {
          font-size: 0.75rem;
          opacity: 0.5;
        }

        .step-details {
          padding: 1rem;
          border-top: 1px solid rgba(255, 0, 0, 0.1);
          background: rgba(0, 0, 0, 0.2);
          font-size: 0.75rem;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 1rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255, 0, 0, 0.1);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          opacity: 0.7;
          font-weight: bold;
        }

        .instruction-item {
          padding: 0.25rem 0;
        }

        .logs-container {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.625rem;
          background: rgba(0, 0, 0, 0.5);
          padding: 0.5rem;
          border-radius: 2px;
          max-height: 200px;
          overflow-y: auto;
        }

        .log-line {
          padding: 0.125rem 0;
          opacity: 0.8;
        }

        .summary-box {
          padding: 1.5rem;
          border: 1px solid var(--terminal-text);
          background: rgba(0, 0, 0, 0.6);
          box-shadow: 0 0 15px rgba(255, 0, 0, 0.3);
        }

        .terminal-button-secondary {
          background: transparent;
          border: 1px solid var(--terminal-text);
          color: var(--terminal-text);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: all 0.2s;
          cursor: pointer;
        }

        .terminal-button-secondary:hover {
          background: rgba(255, 0, 0, 0.1);
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
};

