// src/lib/dry-run.ts
/**
 * Dry run mode - simulates entire teleburn flow without signing or broadcasting
 */

import { Connection, Transaction } from '@solana/web3.js';
import { Sbt01Seal, Sbt01Retire } from './sbt01-schemas';

export interface DryRunStep {
  name: string;
  type: 'seal' | 'update-uri' | 'retire';
  transaction?: string;  // Base64 serialized
  simulation?: SimulationResult;
  decodedInstructions?: DecodedInstruction[];
  estimatedFee?: number;
  warnings?: string[];
}

export interface DecodedInstruction {
  programName: string;
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
    role?: string;
  }>;
  data?: string;
  parsed?: any;
}

export interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed?: number;
  error?: string;
}

export interface DryRunReport {
  steps: DryRunStep[];
  totalEstimatedFee: number;
  summary: {
    mint: string;
    inscriptionId: string;
    sha256: string;
    method: 'burn' | 'incinerate' | 'teleburn-derived';
    pointerUri?: string;
    sealPayload: Sbt01Seal;
    retirePayload: Sbt01Retire;
  };
  timestamp: string;
  warnings: string[];
}

export class DryRunService {
  constructor(private connection: Connection) {}

  /**
   * Execute complete dry run of teleburn flow
   */
  async executeDryRun(params: {
    feePayer: string;
    mint: string;
    inscriptionId: string;
    sha256: string;
    method: 'burn' | 'incinerate' | 'teleburn-derived';
    pointerUri?: string;
    updateMetadata?: boolean;
  }): Promise<DryRunReport> {
    const steps: DryRunStep[] = [];
    const warnings: string[] = [];
    let totalFee = 0;

    // Step 1: Seal transaction
    const sealStep = await this.dryRunSeal({
      feePayer: params.feePayer,
      mint: params.mint,
      inscriptionId: params.inscriptionId,
      sha256: params.sha256
    });
    steps.push(sealStep);
    totalFee += sealStep.estimatedFee || 0;

    if (!sealStep.simulation?.success) {
      warnings.push('Seal transaction simulation failed');
    }

    // Step 2: Update metadata URI (if requested)
    if (params.updateMetadata && params.pointerUri) {
      const updateStep = await this.dryRunUpdateUri({
        feePayer: params.feePayer,
        mint: params.mint,
        newUri: params.pointerUri
      });
      steps.push(updateStep);
      totalFee += updateStep.estimatedFee || 0;

      if (!updateStep.simulation?.success) {
        warnings.push('Metadata update simulation failed - metadata may be immutable');
      }
    }

    // Step 3: Retire transaction
    const retireStep = await this.dryRunRetire({
      feePayer: params.feePayer,
      mint: params.mint,
      inscriptionId: params.inscriptionId,
      sha256: params.sha256,
      method: params.method
    });
    steps.push(retireStep);
    totalFee += retireStep.estimatedFee || 0;

    if (!retireStep.simulation?.success) {
      warnings.push(`Retire transaction (${params.method}) simulation failed`);
    }

    // Build summary payloads
    const slot = await this.connection.getSlot('finalized');
    const timestamp = Math.floor(Date.now() / 1000);

    const sealPayload: Sbt01Seal = {
      standard: 'KILN',
      version: '0.1',
      network: 'solana-mainnet',
      action: 'seal',
      inscription: { id: params.inscriptionId, network: 'bitcoin-mainnet' },
      solana: { mint: params.mint, block_height: slot, timestamp },
      media: { sha256: params.sha256 }
    };

    const retirePayload: Sbt01Retire = {
      standard: 'KILN',
      version: '0.1',
      action: params.method,
      inscription: { id: params.inscriptionId },
      solana: { mint: params.mint, block_height: slot, timestamp },
      media: { sha256: params.sha256 }
    };

    return {
      steps,
      totalEstimatedFee: totalFee,
      summary: {
        mint: params.mint,
        inscriptionId: params.inscriptionId,
        sha256: params.sha256,
        method: params.method,
        pointerUri: params.pointerUri,
        sealPayload,
        retirePayload
      },
      timestamp: new Date().toISOString(),
      warnings
    };
  }

  /**
   * Dry run seal transaction
   */
  private async dryRunSeal(params: {
    feePayer: string;
    mint: string;
    inscriptionId: string;
    sha256: string;
  }): Promise<DryRunStep> {
    try {
      // Call API to build transaction
      const response = await fetch('/api/tx/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (!data.success) {
        return {
          name: 'Seal (Write Memo)',
          type: 'seal',
          warnings: [data.error || 'Failed to build transaction']
        };
      }

      // Decode transaction
      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const decoded = await this.decodeTransaction(tx);

      // Simulate transaction
      const simulation = await this.simulateTransaction(data.transaction);

      // Estimate fee
      const fee = await this.estimateFee(tx);

      return {
        name: 'Seal (Write Memo)',
        type: 'seal',
        transaction: data.transaction,
        decodedInstructions: decoded,
        simulation,
        estimatedFee: fee
      };

    } catch (error) {
      return {
        name: 'Seal (Write Memo)',
        type: 'seal',
        warnings: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Dry run metadata update
   */
  private async dryRunUpdateUri(params: {
    feePayer: string;
    mint: string;
    newUri: string;
  }): Promise<DryRunStep> {
    try {
      const response = await fetch('/api/tx/update-uri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (!data.success) {
        return {
          name: 'Update Metadata URI',
          type: 'update-uri',
          warnings: [data.error || 'Failed to build transaction']
        };
      }

      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const decoded = await this.decodeTransaction(tx);
      const simulation = await this.simulateTransaction(data.transaction);
      const fee = await this.estimateFee(tx);

      return {
        name: 'Update Metadata URI',
        type: 'update-uri',
        transaction: data.transaction,
        decodedInstructions: decoded,
        simulation,
        estimatedFee: fee
      };

    } catch (error) {
      return {
        name: 'Update Metadata URI',
        type: 'update-uri',
        warnings: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Dry run retire transaction
   */
  private async dryRunRetire(params: {
    feePayer: string;
    mint: string;
    inscriptionId: string;
    sha256: string;
    method: 'burn' | 'incinerate' | 'teleburn-derived';
  }): Promise<DryRunStep> {
    try {
      const endpoint = params.method === 'teleburn-derived' 
        ? '/api/tx/teleburn-derived'
        : '/api/tx/retire';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (!data.success) {
        return {
          name: `Retire (${params.method})`,
          type: 'retire',
          warnings: [data.error || 'Failed to build transaction']
        };
      }

      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const decoded = await this.decodeTransaction(tx);
      const simulation = await this.simulateTransaction(data.transaction);
      const fee = await this.estimateFee(tx);

      return {
        name: `Retire (${params.method})`,
        type: 'retire',
        transaction: data.transaction,
        decodedInstructions: decoded,
        simulation,
        estimatedFee: fee
      };

    } catch (error) {
      return {
        name: `Retire (${params.method})`,
        type: 'retire',
        warnings: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Decode transaction instructions
   */
  private async decodeTransaction(tx: Transaction): Promise<DecodedInstruction[]> {
    const decoded: DecodedInstruction[] = [];

    for (const ix of tx.instructions) {
      const programId = ix.programId.toBase58();
      let programName = 'Unknown Program';

      // Identify known programs
      if (programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
        programName = 'Memo Program';
      } else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        programName = 'Token Program';
      } else if (programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        programName = 'Token-2022 Program';
      } else if (programId === 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') {
        programName = 'Metaplex Token Metadata';
      }

      decoded.push({
        programName,
        programId,
        accounts: ix.keys.map((key, idx) => ({
          pubkey: key.pubkey.toBase58(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
          role: this.identifyAccountRole(programName, idx)
        })),
        data: ix.data.toString('hex')
      });
    }

    return decoded;
  }

  /**
   * Identify account role based on program and position
   */
  private identifyAccountRole(programName: string, index: number): string | undefined {
    if (programName === 'Token Program' || programName === 'Token-2022 Program') {
      const roles = ['Source Account', 'Mint', 'Destination', 'Authority'];
      return roles[index];
    }
    if (programName === 'Metaplex Token Metadata') {
      const roles = ['Metadata', 'Update Authority', 'Mint'];
      return roles[index];
    }
    return undefined;
  }

  /**
   * Simulate transaction
   */
  private async simulateTransaction(serializedTx: string): Promise<SimulationResult> {
    try {
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
      const simulation = await this.connection.simulateTransaction(tx);

      return {
        success: !simulation.value.err,
        logs: simulation.value.logs || [],
        unitsConsumed: simulation.value.unitsConsumed,
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined
      };
    } catch (error) {
      return {
        success: false,
        logs: [],
        error: error instanceof Error ? error.message : 'Simulation failed'
      };
    }
  }

  /**
   * Estimate transaction fee
   */
  private async estimateFee(tx: Transaction): Promise<number> {
    try {
      const feeCalculator = await this.connection.getRecentBlockhash();
      const message = tx.compileMessage();
      const fee = await this.connection.getFeeForMessage(message);
      return fee.value || 5000; // Fallback to 5000 lamports
    } catch (error) {
      return 5000;
    }
  }
}

// React Component for Dry Run UI
// src/components/DryRunMode.tsx

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { DryRunService, DryRunReport } from '@/lib/dry-run';

interface Props {
  mint: string;
  inscriptionId: string;
  sha256: string;
  method: 'burn' | 'incinerate' | 'teleburn-derived';
  pointerUri?: string;
  updateMetadata?: boolean;
  onComplete?: () => void;
}

export function DryRunMode({ 
  mint, 
  inscriptionId, 
  sha256, 
  method, 
  pointerUri, 
  updateMetadata,
  onComplete 
}: Props) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const executeDryRun = async () => {
    if (!publicKey) return;

    setRunning(true);
    const service = new DryRunService(connection);
    
    const result = await service.executeDryRun({
      feePayer: publicKey.toBase58(),
      mint,
      inscriptionId,
      sha256,
      method,
      pointerUri,
      updateMetadata
    });

    setReport(result);
    setRunning(false);
  };

  const downloadReport = () => {
    if (!report) return;
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dry-run-${mint.slice(0, 8)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg border-2 border-purple-300">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🔍</span>
        <div>
          <h2 className="text-xl font-bold text-purple-900">Dry Run Mode</h2>
          <p className="text-sm text-gray-600">
            Simulate the entire teleburn process without signing or broadcasting transactions
          </p>
        </div>
      </div>

      {!report && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded p-4 space-y-2 text-sm">
            <div className="font-medium text-purple-900">What will be tested:</div>
            <ul className="list-disc list-inside space-y-1 text-purple-800">
              <li>Build and decode all transactions</li>
              <li>Simulate each transaction on Solana</li>
              <li>Calculate total fees</li>
              <li>Identify any potential errors</li>
              <li>Generate complete execution report</li>
            </ul>
          </div>

          <button
            onClick={executeDryRun}
            disabled={running || !publicKey}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {running ? 'Running Simulation...' : 'Start Dry Run'}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-lg">Execution Summary</h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Total Steps:</span>
                <span className="ml-2 font-medium">{report.steps.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Fee:</span>
                <span className="ml-2 font-medium">
                  {(report.totalEstimatedFee / 1e9).toFixed(6)} SOL
                </span>
              </div>
              <div>
                <span className="text-gray-600">Method:</span>
                <span className="ml-2 font-medium capitalize">{method}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className={`ml-2 font-medium ${
                  report.warnings.length === 0 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {report.warnings.length === 0 ? '✓ All Clear' : '⚠ Warnings'}
                </span>
              </div>
            </div>

            {report.warnings.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
                <div className="font-medium text-yellow-900 mb-2">⚠️ Warnings:</div>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {report.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Step Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Transaction Steps</h3>
            
            {report.steps.map((step, idx) => (
              <div 
                key={idx}
                className="bg-white rounded-lg border overflow-hidden"
              >
                <button
                  onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {step.simulation?.success ? '✅' : '❌'}
                    </span>
                    <div className="text-left">
                      <div className="font-medium">{step.name}</div>
                      <div className="text-sm text-gray-600">
                        {step.estimatedFee 
                          ? `~${(step.estimatedFee / 1e9).toFixed(6)} SOL`
                          : 'Fee unknown'
                        }
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-400">
                    {expandedStep === idx ? '▼' : '▶'}
                  </span>
                </button>

                {expandedStep === idx && (
                  <div className="p-4 border-t bg-gray-50 space-y-4">
                    {/* Decoded Instructions */}
                    {step.decodedInstructions && step.decodedInstructions.length > 0 && (
                      <div>
                        <div className="font-medium mb-2">Instructions:</div>
                        {step.decodedInstructions.map((ix, ixIdx) => (
                          <div key={ixIdx} className="bg-white rounded p-3 mb-2 text-sm">
                            <div className="font-medium text-blue-900">{ix.programName}</div>
                            <div className="text-xs text-gray-600 mt-1">{ix.programId}</div>
                            <div className="mt-2 space-y-1">
                              {ix.accounts.map((acc, accIdx) => (
                                <div key={accIdx} className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-500">{acc.role || `Account ${accIdx}`}:</span>
                                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                                    {acc.pubkey.slice(0, 8)}...
                                  </code>
                                  {acc.isSigner && (
                                    <span className="text-orange-600 font-medium">SIGNER</span>
                                  )}
                                  {acc.isWritable && (
                                    <span className="text-purple-600 font-medium">WRITABLE</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Simulation Results */}
                    {step.simulation && (
                      <div>
                        <div className="font-medium mb-2">Simulation:</div>
                        <div className={`p-3 rounded ${
                          step.simulation.success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="text-sm space-y-1">
                            <div>
                              Status: <span className="font-medium">
                                {step.simulation.success ? 'Success' : 'Failed'}
                              </span>
                            </div>
                            {step.simulation.unitsConsumed && (
                              <div>
                                Compute Units: <span className="font-medium">
                                  {step.simulation.unitsConsumed.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {step.simulation.error && (
                              <div className="text-red-700 mt-2">
                                Error: {step.simulation.error}
                              </div>
                            )}
                          </div>
                          
                          {step.simulation.logs.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer text-gray-600">
                                View Logs ({step.simulation.logs.length})
                              </summary>
                              <pre className="mt-2 text-xs bg-black text-green-400 p-2 rounded 
                                            overflow-x-auto max-h-40">
                                {step.simulation.logs.join('\n')}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {step.warnings && step.warnings.length > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm">
                        <div className="font-medium text-yellow-900 mb-1">Warnings:</div>
                        <ul className="text-yellow-800 space-y-1">
                          {step.warnings.map((warning, wIdx) => (
                            <li key={wIdx}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={downloadReport}
              className="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              📥 Download Report
            </button>
            <button
              onClick={onComplete}
              disabled={report.warnings.length > 0}
              className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700
                       disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {report.warnings.length === 0 
                ? '✓ Proceed with Real Transactions' 
                : '⚠ Fix Warnings First'
              }
            </button>
          </div>

          {report.warnings.length === 0 && (
            <div className="p-4 bg-green-50 border border-green-300 rounded text-sm text-green-800">
              ✅ All simulations passed successfully. You can proceed with confidence.
            </div>
          )}
        </div>
      )}
    </div>
  );
} '