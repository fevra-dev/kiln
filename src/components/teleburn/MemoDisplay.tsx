'use client';

/**
 * Memo Display Component
 * 
 * Displays teleburn memo data in a clean, readable format.
 * Shows all relevant fields with proper formatting and labels.
 * 
 * @description Clean memo data visualization
 * @version 0.1.1
 */

import { FC } from 'react';

interface MemoData {
  standard: string;
  version: string;
  action: string;
  timestamp: number;
  block_height: number;
  inscription: {
    id: string;
  };
  solana: {
    mint: string;
  };
  media?: {
    sha256: string;
  };
  derived?: {
    owner: string;
    algorithm: string;
  };
}

interface MemoDisplayProps {
  memo: MemoData;
  title?: string;
}

/**
 * Memo Display Component
 * 
 * Renders memo data in a clean, terminal-style format.
 */
export const MemoDisplay: FC<MemoDisplayProps> = ({ memo, title = "TELEBURN MEMO" }) => {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toISOString();
  };

  const truncateAddress = (address: string, length: number = 8) => {
    return `${address.slice(0, length)}...${address.slice(-length)}`;
  };

  return (
    <div className="memo-display">
      <div className="memo-header">
        <div className="memo-title">{title}</div>
        <div className="memo-action">{memo.action.toUpperCase()}</div>
      </div>

      <div className="memo-content">
        {/* Protocol Info */}
        <div className="memo-section">
          <div className="section-label">PROTOCOL</div>
          <div className="section-content">
            <div className="field">
              <span className="field-label">Standard:</span>
              <span className="field-value protocol">{memo.standard}</span>
            </div>
            <div className="field">
              <span className="field-label">Version:</span>
              <span className="field-value">{memo.version}</span>
            </div>
          </div>
        </div>

        {/* Blockchain Info */}
        <div className="memo-section">
          <div className="section-label">BLOCKCHAIN</div>
          <div className="section-content">
            <div className="field">
              <span className="field-label">Source:</span>
              <span className="field-value">Solana Mainnet</span>
            </div>
            <div className="field">
              <span className="field-label">Target:</span>
              <span className="field-value">Bitcoin Mainnet</span>
            </div>
          </div>
        </div>

        {/* Inscription Info */}
        <div className="memo-section">
          <div className="section-label">INSCRIPTION</div>
          <div className="section-content">
            <div className="field">
              <span className="field-label">ID:</span>
              <span className="field-value inscription-id">
                {truncateAddress(memo.inscription.id, 12)}
              </span>
            </div>
            {memo.media && (
              <div className="field">
                <span className="field-label">SHA-256:</span>
                <span className="field-value hash">
                  {truncateAddress(memo.media.sha256, 12)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Solana Info */}
        <div className="memo-section">
          <div className="section-label">SOLANA</div>
          <div className="section-content">
            <div className="field">
              <span className="field-label">Mint:</span>
              <span className="field-value mint-address">
                {truncateAddress(memo.solana.mint, 8)}
              </span>
            </div>
          </div>
        </div>

        {/* Derived Address (for teleburn-derived) */}
        {memo.derived && (
          <div className="memo-section">
            <div className="section-label">DERIVED ADDRESS</div>
            <div className="section-content">
              <div className="field">
                <span className="field-label">Owner:</span>
                <span className="field-value derived-address">
                  {truncateAddress(memo.derived.owner, 8)}
                </span>
              </div>
              <div className="field">
                <span className="field-label">Algorithm:</span>
                <span className="field-value algorithm">{memo.derived.algorithm}</span>
              </div>
            </div>
          </div>
        )}

        {/* Timestamp Info */}
        <div className="memo-section">
          <div className="section-label">TIMESTAMP</div>
          <div className="section-content">
            <div className="field">
              <span className="field-label">Block Height:</span>
              <span className="field-value">{memo.block_height.toLocaleString()}</span>
            </div>
            <div className="field">
              <span className="field-label">Time:</span>
              <span className="field-value timestamp">
                {formatTimestamp(memo.timestamp)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .memo-display {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 0, 0, 0.3);
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          line-height: 1.4;
          overflow: hidden;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          table-layout: fixed;
        }

        .memo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 0, 0, 0.2);
          background: rgba(255, 0, 0, 0.05);
        }

        .memo-title {
          font-weight: bold;
          color: var(--terminal-text);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .memo-action {
          background: rgba(255, 0, 0, 0.2);
          color: var(--terminal-text);
          padding: 0.25rem 0.5rem;
          border-radius: 2px;
          font-size: 0.75rem;
          font-weight: bold;
        }

        .memo-content {
          padding: 1rem;
          width: 100%;
          box-sizing: border-box;
        }

        .memo-section {
          margin-bottom: 1.5rem;
        }

        .memo-section:last-child {
          margin-bottom: 0;
        }

        .section-label {
          color: rgba(255, 0, 0, 0.8);
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.5rem;
        }

        .section-content {
          padding-left: 1rem;
          width: 100%;
          box-sizing: border-box;
        }

        .field {
          display: flex;
          margin-bottom: 0.5rem;
          width: 100%;
          align-items: flex-start;
        }

        .field:last-child {
          margin-bottom: 0;
        }

        .field-label {
          color: rgba(255, 0, 0, 0.6);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex: 0 0 120px;
          margin-right: 0.5rem;
        }

        .field-value {
          color: var(--terminal-text);
          font-weight: 500;
          word-break: break-all;
          flex: 1;
          min-width: 0;
        }

        .field-value.protocol {
          color: rgba(255, 0, 0, 0.9);
          font-weight: bold;
        }

        .field-value.inscription-id,
        .field-value.mint-address,
        .field-value.derived-address {
          color: rgba(0, 255, 255, 0.8);
          font-family: monospace;
          word-break: break-all;
          overflow-wrap: break-word;
        }

        .field-value.hash {
          color: rgba(255, 255, 0, 0.8);
          font-family: monospace;
          word-break: break-all;
          overflow-wrap: break-word;
        }

        .field-value.algorithm {
          color: rgba(255, 200, 0, 0.8);
          font-family: monospace;
        }

        .field-value.timestamp {
          color: rgba(200, 200, 200, 0.8);
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
};
