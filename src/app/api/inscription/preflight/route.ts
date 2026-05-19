/**
 * API Route: GET /api/inscription/preflight?id=<inscriptionId>
 *
 * Bitcoin-side pre-flight check for the KILN burn flow.
 * See: docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md
 *
 * The orchestration function `preflight()` already emits one spec §7 log
 * line per terminal-state branch. This route only logs on the input-validation
 * error path (which never reaches the orchestration).
 */

import { NextRequest, NextResponse } from 'next/server';
import { preflight } from '@/lib/inscription-preflight';

export const maxDuration = 20; // seconds — covers worst-case timeout cascade
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'missing id param' }, { status: 400 });
  }

  try {
    const response = await preflight(id);
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    if (/invalid inscription id format/i.test(message)) {
      return NextResponse.json({ error: 'invalid inscription id format' }, { status: 400 });
    }
    console.error('[preflight] unexpected route error:', err);
    return NextResponse.json({ error: 'preflight failed' }, { status: 500 });
  }
}
