/**
 * Inscription Verification Step Component
 * 
 * @description UI component for mandatory inscription verification gate.
 * Users CANNOT proceed to seal step until verification passes.
 * 
 * @version 0.1.1
 */

'use client';

import { useState, useEffect } from 'react';
import { InscriptionVerifier } from '@/lib/inscription-verifier';
import type { InscriptionVerificationResult } from '@/lib/types';
import { formatByteSize, getContentCategory } from '@/lib/inscription-verifier';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface InscriptionVerificationStepProps {
  /** Bitcoin inscription ID */
  inscriptionId: string;
  
  /** Expected SHA-256 hash of inscription content */
  expectedSha256: string;
  
  /** Callback when verification succeeds */
  onVerified: (result: InscriptionVerificationResult) => void;
  
  /** Optional: Auto-verify on mount */
  autoVerify?: boolean;
  
  /** Optional: Custom loading message */
  loadingMessage?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Inscription Verification Step - CRITICAL SAFETY GATE
 * 
 * This component:
 * 1. Fetches inscription content from ordinals.com
 * 2. Computes SHA-256 hash of content
 * 3. Compares against expected hash
 * 4. Blocks progression if verification fails
 * 
 * @example
 * ```tsx
 * <InscriptionVerificationStep
 *   inscriptionId="abc...i0"
 *   expectedSha256="a1b2c3..."
 *   onVerified={(result) => setStep('seal')}
 *   autoVerify={true}
 * />
 * ```
 */
export function InscriptionVerificationStep({
  inscriptionId,
  expectedSha256,
  onVerified,
  autoVerify = false,
  loadingMessage = 'Verifying inscription content...'
}: InscriptionVerificationStepProps) {
  // State management
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<InscriptionVerificationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-verify on mount if enabled
  useEffect(() => {
    if (autoVerify && !result && !verifying) {
      handleVerify();
    }
  }, [autoVerify]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle verification button click
   */
  const handleVerify = async () => {
    setVerifying(true);
    setResult(null);

    try {
      // Call verification service
      const verification = await InscriptionVerifier.verify(
        inscriptionId,
        expectedSha256
      );

      setResult(verification);

      // Trigger callback if verification passed
      if (verification.valid) {
        onVerified(verification);
      }
    } catch (error) {
      // This should never happen (verify() doesn't throw), but handle just in case
      setResult({
        valid: false,
        inscriptionId,
        fetchedHash: '',
        expectedHash: expectedSha256,
        error: error instanceof Error ? error.message : 'Unexpected error during verification'
      });
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Handle retry button click
   */
  const handleRetry = () => {
    setResult(null);
    handleVerify();
  };

  /**
   * Get content preview URL
   */
  const contentUrl = InscriptionVerifier.getContentUrl(inscriptionId);
  const explorerUrl = InscriptionVerifier.getExplorerUrl(inscriptionId);

  return (
    <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="text-3xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900">
            Inscription Verification Required
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Before sealing, we must verify the inscription content matches your expected hash.
            This ensures you&apos;re not sealing to a corrupted or incorrect inscription.
          </p>
        </div>
      </div>

      {/* Inscription Details */}
      <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">Inscription ID:</span>
          <code className="text-xs bg-white px-3 py-1.5 rounded border border-gray-300 font-mono break-all">
            {inscriptionId}
          </code>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">Expected SHA-256:</span>
          <code className="text-xs bg-white px-3 py-1.5 rounded border border-gray-300 font-mono break-all">
            {expectedSha256.slice(0, 32)}...
          </code>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            View on ordinals.com →
          </a>
        </div>
      </div>

      {/* Verification Button (only show if not verified or verifying) */}
      {!result && !verifying && (
        <button
          onClick={handleVerify}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Verify Inscription Content
        </button>
      )}

      {/* Loading State */}
      {verifying && (
        <div className="flex items-center justify-center gap-3 py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-700">{loadingMessage}</span>
        </div>
      )}

      {/* Verification Result */}
      {result && (
        <div
          className={`p-5 rounded-lg border-2 ${
            result.valid
              ? 'bg-green-50 border-green-400'
              : 'bg-red-50 border-red-400'
          }`}
        >
          {result.valid ? (
            // SUCCESS STATE
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✅</span>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-green-900">
                    Verification Successful
                  </h4>
                  <p className="text-sm text-green-700 mt-1">
                    Inscription content matches expected hash. Safe to proceed with sealing.
                  </p>
                </div>
              </div>

              {/* Content Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-green-200">
                {result.contentType && (
                  <div>
                    <div className="text-xs text-green-700 font-medium">Content Type</div>
                    <div className="text-sm text-green-900 mt-1">
                      {result.contentType}
                      <span className="ml-2 text-xs text-green-600">
                        ({getContentCategory(result.contentType)})
                      </span>
                    </div>
                  </div>
                )}
                
                {result.byteLength && (
                  <div>
                    <div className="text-xs text-green-700 font-medium">File Size</div>
                    <div className="text-sm text-green-900 mt-1">
                      {formatByteSize(result.byteLength)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-green-700 font-medium">Hash Match</div>
                  <div className="text-sm text-green-900 mt-1 flex items-center gap-1">
                    ✓ Confirmed
                  </div>
                </div>
              </div>

              {/* Content Preview */}
              {result.contentType?.startsWith('image/') && (
                <div className="pt-3 border-t border-green-200">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-sm text-green-700 hover:text-green-900 font-medium"
                  >
                    {showDetails ? '▼' : '►'} Preview Content
                  </button>
                  
                  {showDetails && (
                    <div className="mt-3 bg-white p-3 rounded border border-green-300">
                      <img
                        src={contentUrl}
                        alt="Inscription preview"
                        className="max-w-full h-auto rounded"
                        style={{ maxHeight: '300px', margin: '0 auto' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // FAILURE STATE
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">❌</span>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-red-900">
                    Verification Failed
                  </h4>
                  <p className="text-sm text-red-700 mt-1">
                    {result.error || 'Unknown error occurred during verification'}
                  </p>
                </div>
              </div>

              {/* Hash Comparison (if we got a hash) */}
              {result.fetchedHash && (
                <div className="pt-3 border-t border-red-200 space-y-2">
                  <div>
                    <div className="text-xs text-red-700 font-medium">Fetched Hash:</div>
                    <code className="text-xs text-red-900 bg-white px-2 py-1 rounded border border-red-300 font-mono block mt-1 break-all">
                      {result.fetchedHash}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs text-red-700 font-medium">Expected Hash:</div>
                    <code className="text-xs text-red-900 bg-white px-2 py-1 rounded border border-red-300 font-mono block mt-1 break-all">
                      {result.expectedHash}
                    </code>
                  </div>
                </div>
              )}

              {/* Warning Box */}
              <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                <div className="flex gap-2">
                  <span className="text-xl">⚠️</span>
                  <div className="flex-1 text-sm text-yellow-900">
                    <strong className="font-semibold">Do not proceed with sealing.</strong>
                    <br />
                    The inscription content does not match the expected hash. This could mean:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>The inscription failed or is corrupted</li>
                      <li>Wrong inscription ID was provided</li>
                      <li>The hash was computed incorrectly</li>
                      <li>ordinals.com is serving cached/incorrect data</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Retry Button */}
              <button
                onClick={handleRetry}
                className="w-full py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Retry Verification
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
        <p>
          ℹ️ <strong>Why verification is required:</strong> Sealing creates a permanent on-chain
          record linking your Solana NFT to a Bitcoin inscription. If the inscription content
          doesn&apos;t match, the teleburn will be invalid and your NFT could be lost.
        </p>
      </div>
    </div>
  );
}

export default InscriptionVerificationStep;

