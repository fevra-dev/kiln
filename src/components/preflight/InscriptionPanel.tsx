'use client';

import { FC, useEffect, type ReactNode } from 'react';
import type { PreflightResponse } from '@/lib/inscription-preflight';
import { ContentRenderer } from './ContentRenderer';
import { OverrideControls, type OverrideKind } from './OverrideControls';

interface InscriptionPanelProps {
  state: 'idle' | 'loading' | 'success' | 'error';
  result: PreflightResponse | null;
  error: string | null;
  /** Notify parent whether the user has acknowledged the necessary override (if any). */
  onAcknowledgedChange: (acknowledged: boolean) => void;
  /** Trigger a refetch (used for retry button on error / all_unreachable). */
  onRetry: () => void;
}

function getOverrideKind(result: PreflightResponse | null): OverrideKind {
  if (!result) return 'none';
  if (!result.exists) {
    return result.reason === 'all_unreachable' ? 'checkbox' : 'none';
  }
  if (result.confirmations >= 6) return 'none';
  if (result.confirmations >= 1) return 'checkbox';
  return 'typed-word'; // mempool
}

/**
 * Full preview panel for Step 3.
 * Renders content + metadata + SHA-256 + an override widget if applicable.
 * The override emits up via onAcknowledgedChange; parent gates the proceed button.
 */
export const InscriptionPanel: FC<InscriptionPanelProps> = ({
  state,
  result,
  error,
  onAcknowledgedChange,
  onRetry,
}) => {
  const overrideKind = getOverrideKind(result);
  // Auto-acknowledge the happy path: confirmed ≥6 needs no user action.
  const autoAcknowledge = result?.exists === true && result.confirmations >= 6;

  // Drive the parent's acknowledgement state:
  // - overrideKind 'none' + autoAck: parent gets true (happy path proceed)
  // - overrideKind 'none' + !autoAck: parent gets false (not_found has no proceed path)
  // - overrideKind != 'none': parent gets false initially; OverrideControls flips it
  //   to true when the user ticks/types correctly.
  useEffect(() => {
    if (overrideKind === 'none') {
      onAcknowledgedChange(autoAcknowledge);
    } else {
      onAcknowledgedChange(false);
    }
  }, [result?.inscriptionId, result?.exists, overrideKind, autoAcknowledge, onAcknowledgedChange]);

  if (state === 'loading' || state === 'idle') {
    return (
      <div style={panelStyle}>
        <div style={{ opacity: 0.7 }}>Checking inscription on Bitcoin…</div>
      </div>
    );
  }

  if (state === 'error' || (result && !result.exists && result.reason === 'all_unreachable')) {
    return (
      <div style={{ ...panelStyle, borderColor: '#d68910' }}>
        <div style={{ fontWeight: 600, color: '#d68910', marginBottom: 8 }}>
          ⚠️ Couldn&apos;t reach Bitcoin indexers
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          {error ?? 'Both ordinals.com and the fallback indexer were unreachable. The inscription may still be valid; we just can\'t verify right now.'}
        </div>
        <button onClick={onRetry} style={buttonStyle}>Retry</button>
        <div style={{ marginTop: 12 }}>
          <OverrideControls
            kind="checkbox"
            label="I have independently verified this inscription exists on Bitcoin."
            onAcknowledgedChange={onAcknowledgedChange}
          />
        </div>
      </div>
    );
  }

  if (!result) return null;

  if (!result.exists) {
    // not_found — no override
    return (
      <div style={{ ...panelStyle, borderColor: '#c0392b' }}>
        <div style={{ fontWeight: 600, color: '#c0392b', marginBottom: 8 }}>
          ⛔ Inscription not found on Bitcoin
        </div>
        <div style={{ fontSize: 13 }}>
          Both indexers returned 404. Check the ID for typos or wrong index
          (most commonly <code>i0</code> vs <code>i1</code>).
        </div>
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
          ID: <code>{result.inscriptionId}</code>
        </div>
      </div>
    );
  }

  // Success — render the rich preview.
  const sizeStr =
    result.contentLength > 1024 * 1024
      ? `${(result.contentLength / 1024 / 1024).toFixed(1)} MB`
      : `${(result.contentLength / 1024).toFixed(1)} KB`;

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>BITCOIN INSCRIPTION</div>
      <div style={{ display: 'grid', gridTemplateColumns: '256px 1fr', gap: 16 }}>
        <div>
          <ContentRenderer
            contentType={result.contentType}
            contentUrl={result.contentUrl}
            contentLength={result.contentLength}
            inscriptionId={result.inscriptionId}
          />
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <Field label="ID" value={<code style={{ fontSize: 12, wordBreak: 'break-all' }}>{result.inscriptionId}</code>} />
          <Field label="Type" value={result.contentType} />
          <Field label="Size" value={sizeStr} />
          {result.contentSha256 ? (
            <Field label="SHA-256" value={<code style={{ fontSize: 11, wordBreak: 'break-all' }}>{result.contentSha256}</code>} />
          ) : (
            <Field label="SHA-256" value={<span style={{ opacity: 0.6 }}>(too large to hash, or fallback indexer)</span>} />
          )}
          <Field label="Sat" value={`${result.sat.toLocaleString()} (${result.satRarity})`} />
          <Field
            label="Block"
            value={
              result.genesisBlockHeight === null
                ? <span style={{ color: '#cc6328' }}>mempool (0 conf)</span>
                : <>{result.genesisBlockHeight.toLocaleString()} · <strong>{result.confirmations} conf</strong></>
            }
          />
          {result.cursed && <Field label="Note" value="Cursed inscription (pre-jubilee)" />}
          {result.burned && <Field label="Note" value="Bitcoin inscription has been burned" />}
        </div>
      </div>

      {/* Override widget — only renders when overrideKind != 'none' */}
      {overrideKind !== 'none' && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid currentColor', borderRadius: 4 }}>
          {overrideKind === 'checkbox' && (
            <OverrideControls
              kind="checkbox"
              label={
                result.exists && result.confirmations >= 1
                  ? `I understand this inscription has only ${result.confirmations} confirmation${result.confirmations === 1 ? '' : 's'} and is reorg-vulnerable below 6.`
                  : 'I have independently verified this inscription exists on Bitcoin.'
              }
              onAcknowledgedChange={onAcknowledgedChange}
            />
          )}
          {overrideKind === 'typed-word' && (
            <OverrideControls
              kind="typed-word"
              label="This inscription is not yet confirmed by Bitcoin. Burning now risks loss if it is dropped or RBF'd. Type MEMPOOL (case-sensitive) to confirm you accept this risk:"
              requiredWord="MEMPOOL"
              onAcknowledgedChange={onAcknowledgedChange}
            />
          )}
        </div>
      )}
    </div>
  );
};

const Field: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
    <span style={{ minWidth: 72, opacity: 0.7 }}>{label}</span>
    <span>{value}</span>
  </div>
);

const panelStyle = {
  padding: 16,
  border: '1px solid currentColor',
  borderRadius: 4,
  marginBottom: 16,
} as const;

const buttonStyle = {
  padding: '4px 12px',
  background: 'transparent',
  border: '1px solid currentColor',
  color: 'inherit',
  cursor: 'pointer',
} as const;
