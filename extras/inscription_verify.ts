// src/lib/inscription-verifier.ts
/**
 * Verifies inscription content before sealing
 * Fetches content from ordinals.com and validates SHA-256 match
 */

export interface InscriptionVerificationResult {
  valid: boolean;
  inscriptionId: string;
  fetchedHash: string;
  expectedHash: string;
  contentType?: string;
  byteLength?: number;
  error?: string;
}

export class InscriptionVerifier {
  private static readonly ORDINALS_API = 'https://ordinals.com';
  private static readonly TIMEOUT_MS = 30000;
  
  /**
   * Verify inscription exists and matches expected content hash
   */
  static async verify(
    inscriptionId: string,
    expectedSha256: string
  ): Promise<InscriptionVerificationResult> {
    try {
      // Validate inscription ID format
      if (!this.isValidInscriptionId(inscriptionId)) {
        return {
          valid: false,
          inscriptionId,
          fetchedHash: '',
          expectedHash: expectedSha256,
          error: 'Invalid inscription ID format (expected: <txid>i<index>)'
        };
      }

      // Fetch inscription content with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(
        `${this.ORDINALS_API}/content/${inscriptionId}`,
        { 
          signal: controller.signal,
          headers: {
            'Accept': '*/*'
          }
        }
      );
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          valid: false,
          inscriptionId,
          fetchedHash: '',
          expectedHash: expectedSha256,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Get content as ArrayBuffer for accurate hashing
      const contentBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || undefined;
      
      // Compute SHA-256 of fetched content
      const hashBuffer = await crypto.subtle.digest('SHA-256', contentBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fetchedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const valid = fetchedHash.toLowerCase() === expectedSha256.toLowerCase();

      return {
        valid,
        inscriptionId,
        fetchedHash,
        expectedHash: expectedSha256,
        contentType,
        byteLength: contentBuffer.byteLength,
        error: valid ? undefined : 'SHA-256 hash mismatch'
      };

    } catch (error) {
      return {
        valid: false,
        inscriptionId,
        fetchedHash: '',
        expectedHash: expectedSha256,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate inscription ID format
   */
  private static isValidInscriptionId(id: string): boolean {
    // Format: <64-char-hex-txid>i<number>
    const pattern = /^[0-9a-f]{64}i\d+$/i;
    return pattern.test(id);
  }

  /**
   * Fetch inscription metadata (if available)
   */
  static async fetchMetadata(inscriptionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.ORDINALS_API}/inscription/${inscriptionId}`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch inscription metadata:', error);
    }
    return null;
  }
}

// React Component for UI
// src/components/InscriptionVerificationStep.tsx

import { useState } from 'react';
import { InscriptionVerifier, InscriptionVerificationResult } from '@/lib/inscription-verifier';

interface Props {
  inscriptionId: string;
  expectedSha256: string;
  onVerified: (result: InscriptionVerificationResult) => void;
}

export function InscriptionVerificationStep({ inscriptionId, expectedSha256, onVerified }: Props) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<InscriptionVerificationResult | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    const verification = await InscriptionVerifier.verify(inscriptionId, expectedSha256);
    setResult(verification);
    setVerifying(false);
    
    if (verification.valid) {
      onVerified(verification);
    }
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold">⚠️ Verify Inscription Before Sealing</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Inscription ID:</span>
          <code className="bg-white px-2 py-1 rounded">{inscriptionId}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Expected SHA-256:</span>
          <code className="bg-white px-2 py-1 rounded text-xs">{expectedSha256.slice(0, 16)}...</code>
        </div>
      </div>

      {!result && (
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {verifying ? 'Verifying Inscription...' : 'Verify Inscription Content'}
        </button>
      )}

      {result && (
        <div className={`p-4 rounded ${result.valid ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'} border`}>
          {result.valid ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <span className="font-semibold text-green-800">Verification Successful</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <div>Content Type: {result.contentType}</div>
                <div>Size: {result.byteLength?.toLocaleString()} bytes</div>
                <div>Hash Match: ✓ Confirmed</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">❌</span>
                <span className="font-semibold text-red-800">Verification Failed</span>
              </div>
              <div className="text-sm text-red-700">
                <div className="font-medium">Error:</div>
                <div>{result.error}</div>
                {result.fetchedHash && (
                  <div className="mt-2">
                    <div>Fetched Hash: <code>{result.fetchedHash}</code></div>
                    <div>Expected Hash: <code>{result.expectedHash}</code></div>
                  </div>
                )}
              </div>
              <button
                onClick={handleVerify}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry Verification
              </button>
            </div>
          )}
        </div>
      )}

      {result && !result.valid && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm">
          <strong>⚠️ Do not proceed with sealing.</strong> The inscription content does not match 
          the expected hash. This could mean the inscription failed, contains wrong data, or the 
          hash was computed incorrectly.
        </div>
      )}
    </div>
  );
}