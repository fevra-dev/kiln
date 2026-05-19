'use client';

import { FC, useState } from 'react';

export type OverrideKind = 'none' | 'checkbox' | 'typed-word';

interface OverrideControlsProps {
  kind: OverrideKind;
  label?: string;
  requiredWord?: string;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}

/**
 * Override widget scaled to risk severity.
 * - 'none': renders nothing; parent shouldn't disable the action.
 * - 'checkbox': single checkbox; emits true when checked.
 * - 'typed-word': text input; emits true when value === requiredWord exactly.
 *
 * Override state is local to this component; parent owns it via onAcknowledgedChange.
 */
export const OverrideControls: FC<OverrideControlsProps> = ({
  kind,
  label,
  requiredWord,
  onAcknowledgedChange,
}) => {
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState('');

  if (kind === 'none') return null;

  if (kind === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked);
            onAcknowledgedChange(e.target.checked);
          }}
          style={{ marginTop: 4 }}
        />
        <span>{label ?? 'I understand the risk and want to proceed.'}</span>
      </label>
    );
  }

  // typed-word
  const matched = typed === (requiredWord ?? '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 14 }}>
        {label ?? `Type ${requiredWord} (case-sensitive) to confirm:`}
      </label>
      <input
        type="text"
        value={typed}
        onChange={(e) => {
          const next = e.target.value;
          setTyped(next);
          onAcknowledgedChange(next === (requiredWord ?? ''));
        }}
        placeholder={requiredWord}
        style={{
          padding: '4px 8px',
          border: `1px solid ${matched ? 'currentColor' : 'red'}`,
          background: 'transparent',
          color: 'inherit',
          fontFamily: 'monospace',
        }}
      />
    </div>
  );
};
