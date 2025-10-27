'use client';

/**
 * Step 2: Verify Inscription
 * 
 * Second step of teleburn wizard - inscription content verification.
 * Uses InscriptionVerifier from Phase 1 to validate inscription exists
 * and matches expected SHA-256 hash.
 * 
 * CRITICAL GATE: Cannot proceed to seal without verification passing.
 * 
 * @description Inscription verification gate
 * @version 0.1.1
 */

import { FC, useState } from 'react';
import { InscriptionVerifier } from '@/lib/inscription-verifier';
import { InscriptionVerificationResult } from '@/lib/types';

interface Step2VerifyProps {
  inscriptionId: string;
  expectedSha256: string;
  onComplete: (result: InscriptionVerificationResult) => void;
  onBack: () => void;
}

/**
 * Step 2: Inscription Verification
 * 
 * Mandatory verification gate before sealing.
 */
export const Step2Verify: FC<Step2VerifyProps> = ({
  inscriptionId,
  expectedSha256,
  onComplete,
  onBack,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<InscriptionVerificationResult | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setResult(null);

    try {
      const verification = await InscriptionVerifier.verify(inscriptionId, expectedSha256);
      setResult(verification);

      if (verification.valid) {
        // Auto-advance after brief delay
        setTimeout(() => {
          onComplete(verification);
        }, 1500);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setResult({
        valid: false,
        inscriptionId,
        fetchedHash: '',
        expectedHash: expectedSha256,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="step-verify space-y-6">
      {/* Terminal Prompt */}
      <div className="terminal-output mb-8">
        <div className="text-terminal-prompt mb-2">$ verify_inscription_content</div>
        <div className="text-terminal-text/70 text-sm mb-4">
          {`> Fetching inscription from Bitcoin network...`}<br />
          {`> Computing content SHA-256 hash...`}<br />
          {`> Validating against expected hash...`}<br />
          <span className="animate-terminal-blink">▊</span>
        </div>
      </div>

      {/* Verification Gate Notice */}
      <div className="alert alert-warning mb-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <div className="font-bold mb-1 text-matrix-red">CRITICAL VERIFICATION GATE</div>
            <div className="text-sm opacity-80">
              This step validates that your Bitcoin Ordinal inscription exists and matches
              the content you&apos;re teleburning. <strong className="text-terminal-text">You cannot proceed without passing this check.</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Inscription Details */}
      <div className="details-box space-y-4">
        <div className="text-xs font-bold text-terminal-prompt mb-3">
          [ INSCRIPTION DETAILS ]
        </div>

        <div className="detail-row">
          <div className="detail-label">Inscription ID:</div>
          <div className="detail-value font-mono text-xs break-all">
            {inscriptionId}
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-label">Expected SHA-256:</div>
          <div className="detail-value font-mono text-xs break-all">
            {expectedSha256}
          </div>
        </div>

        {result && (
          <>
            <div className="detail-row">
              <div className="detail-label">Fetched SHA-256:</div>
              <div className="detail-value font-mono text-xs break-all">
                {result.fetchedHash || 'N/A'}
              </div>
            </div>

            {result.contentType && (
              <div className="detail-row">
                <div className="detail-label">Content Type:</div>
                <div className="detail-value">{result.contentType}</div>
              </div>
            )}

            {result.byteLength && (
              <div className="detail-row">
                <div className="detail-label">Size:</div>
                <div className="detail-value">
                  {result.byteLength.toLocaleString()} bytes
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Verification Action */}
      {!result && (
        <div className="flex justify-center">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="terminal-button px-8 py-3"
          >
            {verifying ? (
              <>
                <span className="animate-pulse">◆</span> VERIFYING INSCRIPTION...
              </>
            ) : (
              <>⚡ VERIFY INSCRIPTION CONTENT</>
            )}
          </button>
        </div>
      )}

      {/* Verification Result */}
      {result && (
        <div className={`alert ${result.valid ? 'alert-success' : 'alert-error'}`}>
          <div className="flex items-start gap-3">
            <div className="text-2xl">
              {result.valid ? '✓' : '✗'}
            </div>
            <div className="flex-1">
              <div className="font-bold mb-2">
                {result.valid ? 'VERIFICATION SUCCESSFUL' : 'VERIFICATION FAILED'}
              </div>
              
              {result.valid ? (
                <div className="text-sm space-y-1">
                  <div>✓ Inscription exists on Bitcoin network</div>
                  <div>✓ Content SHA-256 hash matches expected value</div>
                  <div>✓ Content integrity confirmed</div>
                  <div className="mt-3 opacity-70">
                    {`> Proceeding to transaction preview...`}
                  </div>
                </div>
              ) : (
                <div className="text-sm space-y-2">
                  <div className="text-matrix-red font-bold">Error: {result.error}</div>
                  {result.fetchedHash && result.fetchedHash !== result.expectedHash && (
                    <div className="mt-2 p-2 bg-black/40 text-xs space-y-1">
                      <div>Hash Mismatch Detected:</div>
                      <div>Expected: {result.expectedHash}</div>
                      <div>Received: {result.fetchedHash}</div>
                    </div>
                  )}
                  <div className="mt-3">
                    <strong>⚠️ DO NOT PROCEED.</strong> The inscription content does not match
                    your expected hash. This could mean:
                  </div>
                  <ul className="list-disc list-inside text-xs opacity-80 space-y-1">
                    <li>Inscription failed or is incorrect</li>
                    <li>Wrong inscription ID provided</li>
                    <li>Hash computed incorrectly</li>
                    <li>Network error retrieving content</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-terminal-text/20">
        <button
          onClick={onBack}
          className="terminal-button-secondary px-6 py-2"
        >
          ← BACK
        </button>

        {result && !result.valid && (
          <button
            onClick={handleVerify}
            className="terminal-button px-6 py-2"
          >
            🔄 RETRY VERIFICATION
          </button>
        )}
      </div>

      <style jsx>{`
        .alert {
          padding: 1.5rem;
          border: 1px solid var(--terminal-text);
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(5px);
        }

        .alert-warning {
          border-color: rgba(255, 100, 0, 0.5);
          box-shadow: 0 0 15px rgba(255, 100, 0, 0.2);
        }

        .alert-success {
          border-color: var(--terminal-text);
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
          animation: pulse-success 2s infinite;
        }

        .alert-error {
          border-color: rgba(200, 0, 0, 0.8);
          box-shadow: 0 0 20px rgba(200, 0, 0, 0.4);
        }

        @keyframes pulse-success {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 0, 0, 0.6);
          }
        }

        .details-box {
          padding: 1.5rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.4);
        }

        .detail-row {
          display: flex;
          gap: 1rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255, 0, 0, 0.1);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          min-width: 150px;
          opacity: 0.7;
          font-size: 0.75rem;
        }

        .detail-value {
          flex: 1;
          font-size: 0.75rem;
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

