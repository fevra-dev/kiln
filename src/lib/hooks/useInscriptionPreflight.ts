'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PreflightResponse } from '@/lib/inscription-preflight';

const DEBOUNCE_MS = 500;
const INSCRIPTION_REGEX = /^[a-f0-9]{64}i[0-9]+$/;

export type PreflightState = 'idle' | 'loading' | 'success' | 'error';

export interface UsePreflightResult {
  state: PreflightState;
  result: PreflightResponse | null;
  error: string | null;
  refetch: () => void;
}

/**
 * Reactive preflight hook.
 * - Pass null to disable.
 * - Pass a string to debounce 500ms then fetch.
 * - Aborts in-flight requests when the ID changes.
 * - Shows previous result while refetching (stale-while-revalidate).
 */
export function useInscriptionPreflight(inscriptionId: string | null): UsePreflightResult {
  const [state, setState] = useState<PreflightState>('idle');
  const [result, setResult] = useState<PreflightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIdRef = useRef<string | null>(null);

  const doFetch = useCallback(async (id: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState('loading');
    setError(null);
    try {
      const res = await fetch(`/api/inscription/preflight?id=${encodeURIComponent(id)}`, {
        signal: controller.signal,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
        setState('error');
        return;
      }
      setResult(body as PreflightResponse);
      setState('success');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'unknown error');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inscriptionId || !INSCRIPTION_REGEX.test(inscriptionId.toLowerCase())) {
      // Don't network on incomplete or invalid input; but keep prior result visible.
      setState('idle');
      lastIdRef.current = null;
      return;
    }
    const normalized = inscriptionId.toLowerCase();
    if (normalized === lastIdRef.current && state === 'success') return;
    lastIdRef.current = normalized;
    debounceRef.current = setTimeout(() => {
      void doFetch(normalized);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inscriptionId]);

  // Unmount cleanup: abort in-flight fetch and clear pending debounce.
  // Separate from the input-tracking effect above (which fires on every
  // inscriptionId change) so this only runs once at unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const refetch = useCallback(() => {
    if (lastIdRef.current) void doFetch(lastIdRef.current);
  }, [doFetch]);

  return { state, result, error, refetch };
}
