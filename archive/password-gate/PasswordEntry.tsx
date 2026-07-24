/**
 * PasswordEntry — ARCHIVED access-code gate for the KILN landing page.
 *
 * Removed from `src/app/page.tsx` on 2026-07-23 for public/portfolio launch.
 * This was a soft "coming soon" wall, NOT real authentication: the access code
 * was compared client-side against `NEXT_PUBLIC_ACCESS_CODE` (default `iceland`),
 * which ships in the browser bundle and is trivially readable. Do not treat it
 * as a security control.
 *
 * See ./README.md for the exact wiring and restore instructions.
 */
import type { FormEvent } from 'react';

export function PasswordEntry({
  password,
  setPassword,
  onSubmit,
  error,
}: {
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: FormEvent) => void;
  error: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-matrix-red font-mono text-center space-y-4">
        <div className="text-6xl mb-8">ঌ</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="access code"
              className="bg-black border border-matrix-red/30 text-matrix-red px-3 py-2 font-mono text-center focus:outline-none focus:border-matrix-red focus:ring-1 focus:ring-matrix-red/50 w-48"
              autoFocus
            />
          </div>
          {error && <div className="text-red-500 text-xs">denied</div>}
        </form>
      </div>
    </div>
  );
}
