'use client';

import { FC } from 'react';
import type { PreflightResponse } from '@/lib/inscription-preflight';

interface InscriptionStatusRowProps {
  state: 'idle' | 'loading' | 'success' | 'error';
  result: PreflightResponse | null;
  error: string | null;
}

/**
 * Compact one-line status under the inscription-ID input.
 * Three visual tiers: ✅ green, ⚠️ yellow, ⛔ red.
 */
export const InscriptionStatusRow: FC<InscriptionStatusRowProps> = ({ state, result, error }) => {
  if (state === 'idle') return null;
  if (state === 'loading') {
    return <div style={{ fontSize: 13, opacity: 0.7 }}>⏳ Checking Bitcoin…</div>;
  }
  if (state === 'error') {
    return <div style={{ fontSize: 13, color: '#d68910' }}>⚠️ Could not verify — {error ?? 'unknown error'}</div>;
  }
  if (!result) return null;

  if (!result.exists) {
    if (result.reason === 'not_found') {
      return (
        <div style={{ fontSize: 13, color: '#c0392b' }}>
          ⛔ Not found on Bitcoin · check for typos / wrong index
        </div>
      );
    }
    return (
      <div style={{ fontSize: 13, color: '#d68910' }}>
        ⚠️ Couldn&apos;t reach Bitcoin indexers · try again in a few seconds
      </div>
    );
  }

  const { confirmations, contentType, contentLength } = result;
  const sizeStr =
    contentLength > 1024 * 1024
      ? `${(contentLength / 1024 / 1024).toFixed(1)} MB`
      : `${(contentLength / 1024).toFixed(1)} KB`;

  if (confirmations >= 6) {
    return (
      <div style={{ fontSize: 13, color: '#2d7d2d' }}>
        ✅ Inscription confirmed · {confirmations} conf · {contentType} · {sizeStr}
      </div>
    );
  }
  if (confirmations >= 1) {
    return (
      <div style={{ fontSize: 13, color: '#d68910' }}>
        ⚠️ Recently inscribed · {confirmations} conf · reorg-vulnerable below 6
      </div>
    );
  }
  return (
    <div style={{ fontSize: 13, color: '#cc6328' }}>
      ⚠️ Not yet confirmed (mempool only) · burning now risks loss if dropped/RBF&apos;d
    </div>
  );
};
