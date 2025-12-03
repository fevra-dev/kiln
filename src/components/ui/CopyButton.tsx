'use client';

/**
 * Copy Button Component
 * 
 * Reusable button to copy text to clipboard with feedback.
 * 
 * @description Click-to-copy functionality with visual feedback
 * @version 0.1.1
 */

import { FC, useState, useCallback } from 'react';

interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string;
  /** Optional label to show (defaults to truncated text) */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
}

/**
 * Copy Button Component
 * 
 * Shows text with a copy icon. Clicking copies to clipboard.
 */
export const CopyButton: FC<CopyButtonProps> = ({ 
  text, 
  label,
  size = 'sm',
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  const displayText = label || (text.length > 20 
    ? `${text.slice(0, 8)}...${text.slice(-8)}` 
    : text);

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-1' 
    : 'text-sm px-3 py-1.5';

  return (
    <button
      onClick={handleCopy}
      className={`copy-button ${sizeClasses} ${className}`}
      title={copied ? 'Copied!' : `Click to copy: ${text}`}
    >
      <span className="copy-text">{displayText}</span>
      <span className="copy-icon">{copied ? '✓' : '⧉'}</span>

      <style jsx>{`
        .copy-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 0, 0, 0.2);
          color: var(--terminal-text);
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          transition: all 0.15s ease;
          border-radius: 2px;
        }

        .copy-button:hover {
          background: rgba(255, 0, 0, 0.1);
          border-color: rgba(255, 0, 0, 0.4);
        }

        .copy-button:active {
          transform: scale(0.98);
        }

        .copy-text {
          opacity: 0.9;
        }

        .copy-icon {
          opacity: 0.5;
          font-size: 0.9em;
        }

        .copy-button:hover .copy-icon {
          opacity: 1;
        }
      `}</style>
    </button>
  );
};

/**
 * Inline copy - just the text with copy on click
 */
export const CopyableText: FC<{
  text: string;
  truncate?: number;
  className?: string;
}> = ({ text, truncate, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  const displayText = truncate && text.length > truncate
    ? `${text.slice(0, Math.floor(truncate/2))}...${text.slice(-Math.floor(truncate/2))}`
    : text;

  return (
    <span 
      onClick={handleCopy}
      className={`copyable-text ${copied ? 'copied' : ''} ${className}`}
      title={copied ? 'Copied!' : `Click to copy`}
    >
      {displayText}
      {copied && <span className="copied-badge">✓</span>}

      <style jsx>{`
        .copyable-text {
          cursor: pointer;
          transition: opacity 0.15s;
          position: relative;
        }

        .copyable-text:hover {
          opacity: 0.8;
        }

        .copied-badge {
          position: absolute;
          right: -1.5rem;
          color: #0f0;
          font-size: 0.8em;
        }
      `}</style>
    </span>
  );
};

