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
        {/* Two-column grid layout for cleaner display */}
        <div className="memo-grid">
          {/* Left column - Labels */}
          <div className="memo-labels">
            <div className="section-group">
              <div className="section-title">PROTOCOL</div>
              <div className="label">Standard</div>
              <div className="label">Version</div>
            </div>
            
            <div className="section-group">
              <div className="section-title">CHAINS</div>
              <div className="label">From</div>
              <div className="label">To</div>
            </div>
            
            <div className="section-group">
              <div className="section-title">INSCRIPTION</div>
              <div className="label">ID</div>
              {memo.media && <div className="label">SHA-256</div>}
            </div>
            
            <div className="section-group">
              <div className="section-title">SOLANA</div>
              <div className="label">Mint</div>
            </div>
            
            {memo.derived && (
              <div className="section-group">
                <div className="section-title">DERIVED</div>
                <div className="label">Owner</div>
              </div>
            )}
            
            <div className="section-group">
              <div className="section-title">TIME</div>
              <div className="label">Block</div>
              <div className="label">UTC</div>
            </div>
          </div>
          
          {/* Right column - Values */}
          <div className="memo-values">
            <div className="section-group">
              <div className="section-spacer"></div>
              <div className="value highlight">{memo.standard}</div>
              <div className="value">{memo.version}</div>
            </div>
            
            <div className="section-group">
              <div className="section-spacer"></div>
              <div className="value">Solana</div>
              <div className="value">Bitcoin</div>
            </div>
            
            <div className="section-group">
              <div className="section-spacer"></div>
              <div className="value orange">{truncateAddress(memo.inscription.id, 10)}</div>
              {memo.media && <div className="value yellow">{truncateAddress(memo.media.sha256, 10)}</div>}
            </div>
            
            <div className="section-group">
              <div className="section-spacer"></div>
              <div className="value orange">{truncateAddress(memo.solana.mint, 8)}</div>
            </div>
            
            {memo.derived && (
              <div className="section-group">
                <div className="section-spacer"></div>
                <div className="value orange">{truncateAddress(memo.derived.owner, 8)}</div>
              </div>
            )}
            
            <div className="section-group">
              <div className="section-spacer"></div>
              <div className="value">{memo.block_height.toLocaleString()}</div>
              <div className="value dim">{formatTimestamp(memo.timestamp)}</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .memo-display {
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(255, 0, 0, 0.3);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          line-height: 1.5;
          overflow: hidden;
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
        }

        .memo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255, 0, 0, 0.2);
          background: rgba(255, 0, 0, 0.05);
        }

        .memo-title {
          font-weight: bold;
          color: var(--terminal-text);
          font-size: 0.75rem;
          letter-spacing: 0.1em;
        }

        .memo-action {
          background: rgba(255, 0, 0, 0.2);
          color: var(--terminal-text);
          padding: 0.2rem 0.5rem;
          font-size: 0.65rem;
          font-weight: bold;
        }

        .memo-content {
          padding: 1rem;
        }

        .memo-grid {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 0 1rem;
        }

        .section-group {
          margin-bottom: 0.75rem;
        }

        .section-group:last-child {
          margin-bottom: 0;
        }

        .section-title {
          color: rgba(255, 0, 0, 0.7);
          font-size: 0.65rem;
          font-weight: bold;
          letter-spacing: 0.1em;
          margin-bottom: 0.25rem;
          padding-bottom: 0.15rem;
          border-bottom: 1px solid rgba(255, 0, 0, 0.15);
        }

        .section-spacer {
          height: 1.1rem;
        }

        .label {
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.7rem;
          text-transform: uppercase;
          line-height: 1.6;
        }

        .value {
          color: var(--terminal-text);
          font-size: 0.75rem;
          line-height: 1.6;
          word-break: break-all;
        }

        .value.highlight {
          color: rgba(255, 0, 0, 0.9);
          font-weight: bold;
        }

        .value.orange {
          color: rgba(255, 150, 0, 0.9);
        }

        .value.yellow {
          color: rgba(255, 255, 0, 0.8);
        }

        .value.dim {
          color: rgba(200, 200, 200, 0.6);
          font-size: 0.7rem;
        }
      `}</style>
    </div>
  );
};
