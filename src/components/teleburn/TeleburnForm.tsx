'use client';

/**
 * Teleburn Form Component
 * 
 * User input form for teleburn parameters:
 * - Solana mint address
 * - Bitcoin inscription ID
 * - Content SHA-256 hash
 * - Retire method: teleburn-derived (fixed)
 * 
 * @description Main input form for teleburn wizard
 * @version 0.1.1
 */

import { FC, useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TeleburnMethod } from '@/lib/transaction-builder';
import { isValidInscriptionId, isValidPublicKey, isValidSha256 } from '@/lib/schemas';
import { InscriptionVerifier } from '@/lib/inscription-verifier';

export interface TeleburnFormData {
  mint: string;
  inscriptionId: string;
  sha256: string;
  method: TeleburnMethod;
}

interface TeleburnFormProps {
  onSubmit: (data: TeleburnFormData) => void;
  onBack?: () => void;
  initialData?: Partial<TeleburnFormData>;
}

/**
 * Teleburn Form Component
 * 
 * Collects user input for teleburn parameters with validation.
 */
export const TeleburnForm: FC<TeleburnFormProps> = ({ 
  onSubmit, 
  onBack,
  initialData 
}) => {
  const [formData, setFormData] = useState<TeleburnFormData>({
    mint: initialData?.mint || '',
    inscriptionId: initialData?.inscriptionId || '',
    sha256: initialData?.sha256 || '',
    method: initialData?.method || 'teleburn-derived',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof TeleburnFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof TeleburnFormData, boolean>>>({});
  const [fetchingHash, setFetchingHash] = useState(false);
  const [hashFetchStatus, setHashFetchStatus] = useState<string>('');

  const handleChange = (field: keyof TeleburnFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Auto-fetch SHA-256 when inscription ID changes
  useEffect(() => {
    const fetchHash = async () => {
      // Only fetch if inscription ID is valid and SHA-256 is empty
      if (formData.inscriptionId && isValidInscriptionId(formData.inscriptionId) && !formData.sha256) {
        setFetchingHash(true);
        setHashFetchStatus('🔍 Fetching inscription content...');

        try {
          const result = await InscriptionVerifier.fetchAndHash(formData.inscriptionId);
          
          if (result.success && result.actualSha256) {
            setFormData(prev => ({ ...prev, sha256: result.actualSha256 || '' }));
            setHashFetchStatus(`✓ Auto-filled SHA-256 from inscription ${result.contentType ? `(${result.contentType})` : ''}`);
            
            // Clear status after 3 seconds
            setTimeout(() => setHashFetchStatus(''), 3000);
          } else {
            setHashFetchStatus(`⚠️ ${result.error || 'Could not fetch inscription'}`);
            setTimeout(() => setHashFetchStatus(''), 3000);
          }
        } catch (error) {
          console.error('Error fetching inscription:', error);
          setHashFetchStatus('⚠️ Error fetching inscription');
          setTimeout(() => setHashFetchStatus(''), 3000);
        } finally {
          setFetchingHash(false);
        }
      }
    };

    // Debounce the fetch
    const timer = setTimeout(() => {
      fetchHash();
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.inscriptionId, formData.sha256]);

  const handleBlur = (field: keyof TeleburnFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const validateField = (field: keyof TeleburnFormData, value: string): boolean => {
    let error: string | undefined;

    switch (field) {
      case 'mint':
        if (!value) {
          error = 'Mint address is required';
        } else if (!isValidPublicKey(value)) {
          error = 'Invalid Solana public key format';
        } else {
          try {
            new PublicKey(value);
          } catch {
            error = 'Invalid Solana address';
          }
        }
        break;

      case 'inscriptionId':
        if (!value) {
          error = 'Inscription ID is required';
        } else if (!isValidInscriptionId(value)) {
          error = 'Invalid format. Expected: <64-hex-txid>i<number>';
        }
        break;

      case 'sha256':
        if (!value) {
          error = 'SHA-256 hash is required';
        } else if (!isValidSha256(value)) {
          error = 'Invalid SHA-256. Expected: 64 character hex string';
        }
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  };

  const validateAll = (): boolean => {
    const fields: (keyof TeleburnFormData)[] = ['mint', 'inscriptionId', 'sha256'];
    const results = fields.map(field => validateField(field, formData[field]));
    setTouched({ mint: true, inscriptionId: true, sha256: true });
    return results.every(r => r);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateAll()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="teleburn-form space-y-6">
      {/* Terminal Header */}
      <div className="terminal-output mb-6">
        <div className="text-terminal-prompt mb-2">$ configure_teleburn_parameters</div>
        <div className="text-terminal-text/70 text-sm mb-4">
          {`> Enter your Solana NFT and Bitcoin Ordinal details...`}
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Mint Address */}
        <div className="form-field">
          <label htmlFor="mint" className="form-label">
            <span className="text-terminal-prompt">→</span> SOLANA MINT ADDRESS
          </label>
          <input
            id="mint"
            type="text"
            value={formData.mint}
            onChange={(e) => handleChange('mint', e.target.value)}
            onBlur={() => handleBlur('mint')}
            className={`form-input ${touched.mint && errors.mint ? 'error' : ''}`}
            placeholder="e.g., 7xKXy9H8P3ZYQEXxf5..."
          />
          {touched.mint && errors.mint && (
            <div className="form-error">⚠️ {errors.mint}</div>
          )}
          <div className="form-hint">
            The Solana NFT you want to teleburn to Bitcoin
          </div>
        </div>

        {/* Inscription ID */}
        <div className="form-field">
          <label htmlFor="inscriptionId" className="form-label">
            <span className="text-terminal-prompt">→</span> BITCOIN INSCRIPTION ID
          </label>
          <input
            id="inscriptionId"
            type="text"
            value={formData.inscriptionId}
            onChange={(e) => handleChange('inscriptionId', e.target.value)}
            onBlur={() => handleBlur('inscriptionId')}
            className={`form-input ${touched.inscriptionId && errors.inscriptionId ? 'error' : ''}`}
            placeholder="e.g., abc123...def789i0"
          />
          {touched.inscriptionId && errors.inscriptionId && (
            <div className="form-error">⚠️ {errors.inscriptionId}</div>
          )}
          <div className="form-hint">
            Format: {'<64-hex-txid>i<index>'} (from ordinals.com)
          </div>
        </div>

        {/* SHA-256 Hash */}
        <div className="form-field">
          <label htmlFor="sha256" className="form-label">
            <span className="text-terminal-prompt">→</span> CONTENT SHA-256 HASH
            {fetchingHash && (
              <span className="ml-2 text-xs opacity-70 animate-pulse">⟳ Fetching...</span>
            )}
          </label>
          <input
            id="sha256"
            type="text"
            value={formData.sha256}
            onChange={(e) => handleChange('sha256', e.target.value)}
            onBlur={() => handleBlur('sha256')}
            className={`form-input ${touched.sha256 && errors.sha256 ? 'error' : ''}`}
            placeholder="e.g., a1b2c3d4e5f6... (auto-filled from inscription)"
            disabled={fetchingHash}
          />
          {touched.sha256 && errors.sha256 && (
            <div className="form-error">⚠️ {errors.sha256}</div>
          )}
          {hashFetchStatus && (
            <div className="form-hint text-terminal-green">
              {hashFetchStatus}
            </div>
          )}
          {!hashFetchStatus && (
            <div className="form-hint">
              Auto-filled from inscription or enter manually (64-character hex)
            </div>
          )}
        </div>

        {/* Retire Method - Fixed to teleburn-derived */}
        <div className="method-info">
          <div className="text-xs font-bold mb-3 text-terminal-prompt">
            [ RETIRE METHOD: TELEBURN-DERIVED ]
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex gap-2">
              <div className="text-terminal-green">✓</div>
              <div>
                <strong>Cryptographically linked to Bitcoin inscription</strong><br />
                Derives deterministic off-curve address from inscription ID
              </div>
            </div>
            <div className="flex gap-2">
              <div className="text-terminal-green">✓</div>
              <div>
                <strong>Provably unspendable</strong><br />
                No private key exists for the derived address
              </div>
            </div>
            <div className="flex gap-2">
              <div className="text-terminal-green">✓</div>
              <div>
                <strong>Verifiable on-chain</strong><br />
                Anyone can verify the burn is linked to your inscription
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-terminal-text/20">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="terminal-button-secondary px-6 py-2"
          >
            ← BACK
          </button>
        )}
        <button
          type="submit"
          className="terminal-button px-8 py-3 ml-auto"
        >
          ⚡ CONTINUE TO VERIFICATION
        </button>
      </div>

      <style jsx>{`
        .form-field {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--terminal-text);
        }

        .form-input, .form-select {
          width: 100%;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: var(--terminal-text);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: var(--terminal-text);
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);
        }

        .form-input.error {
          border-color: rgba(200, 0, 0, 0.8);
          box-shadow: 0 0 10px rgba(200, 0, 0, 0.3);
        }

        .form-error {
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: #ff3333;
        }

        .form-hint {
          margin-top: 0.5rem;
          font-size: 0.75rem;
          opacity: 0.6;
        }

        .method-info {
          padding: 1rem;
          border: 1px solid rgba(255, 0, 0, 0.2);
          background: rgba(0, 0, 0, 0.3);
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
    </form>
  );
};

