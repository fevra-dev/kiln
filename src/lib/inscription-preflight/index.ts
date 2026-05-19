/**
 * Orchestration entrypoint for the pre-burn inscription pre-flight check.
 *
 * Flow:
 *  1. Validate inscription ID format (regex, lowercase normalization)
 *  2. Cache lookup → return immediately if hit (mark cached: true)
 *  3. Fetch current BTC tip height (mempool.space)
 *  4. Try ordinals.com first; on failure, try ordinalswallet
 *  5. Normalize → cache with TTL → return
 */

import { preflightCache, PreflightCache } from './cache';
import { fetchFromOrdinals, fetchFromOrdinalsWallet, contentUrlFor } from './indexers';
import type {
  IndexerCheck,
  IndexerError,
  IndexerResult,
  PreflightNotFound,
  PreflightResponse,
  PreflightSuccess,
} from './types';

const INSCRIPTION_REGEX = /^[a-f0-9]{64}i[0-9]+$/;
const TIP_HEIGHT_TIMEOUT_MS = 3_000;

const TTL_CONFIRMED_DEEP = Infinity;
const TTL_CONFIRMED_SHALLOW = 30_000;
const TTL_NOT_FOUND = 30_000;
const TTL_UNREACHABLE = 5_000;

export async function preflight(rawId: string): Promise<PreflightResponse> {
  const inscriptionId = rawId.toLowerCase();
  if (!INSCRIPTION_REGEX.test(inscriptionId)) {
    throw new Error('invalid inscription id format');
  }

  const cached = preflightCache.get<PreflightResponse>(inscriptionId);
  if (cached) {
    return { ...cached, cached: true } as PreflightResponse;
  }

  const tipHeight = await fetchBitcoinTipHeight();
  if (tipHeight === null) {
    const response: PreflightNotFound = {
      exists: false,
      inscriptionId,
      reason: 'all_unreachable',
      indexersChecked: [
        { name: 'ordinals.com', status: 'error' },
        { name: 'ordinalswallet', status: 'error' },
      ],
      checkedAt: Date.now(),
    };
    preflightCache.set(inscriptionId, response, TTL_UNREACHABLE);
    return response;
  }

  const indexersChecked: IndexerCheck[] = [];
  let final: IndexerResult | null = null;

  const ordRes = await fetchFromOrdinals(inscriptionId, tipHeight);
  if (ordRes.ok) {
    final = ordRes;
  } else {
    indexersChecked.push(toIndexerCheck(ordRes));
  }

  if (!final) {
    const owRes = await fetchFromOrdinalsWallet(inscriptionId, tipHeight);
    if (owRes.ok) {
      final = owRes;
    } else {
      indexersChecked.push(toIndexerCheck(owRes));
    }
  }

  if (final) {
    const response = buildSuccess(final);
    const ttl = response.confirmations >= 6 ? TTL_CONFIRMED_DEEP : TTL_CONFIRMED_SHALLOW;
    preflightCache.set(inscriptionId, response, ttl);
    return response;
  }

  const reason: PreflightNotFound['reason'] = indexersChecked.every((c) => c.status === 'not_found')
    ? 'not_found'
    : 'all_unreachable';
  const response: PreflightNotFound = {
    exists: false,
    inscriptionId,
    reason,
    indexersChecked,
    checkedAt: Date.now(),
  };
  preflightCache.set(inscriptionId, response, reason === 'not_found' ? TTL_NOT_FOUND : TTL_UNREACHABLE);
  return response;
}

function buildSuccess(result: IndexerResult): PreflightSuccess {
  const { data, source } = result;
  return {
    exists: true,
    inscriptionId: data.inscriptionId,
    confirmations: data.confirmations,
    genesisBlockHeight: data.genesisBlockHeight,
    genesisTimestamp: data.genesisTimestamp,
    contentType: data.contentType,
    contentLength: data.contentLength,
    contentSha256: data.contentSha256,
    contentUrl: contentUrlFor(source, data.inscriptionId),
    sat: data.sat,
    satRarity: data.satRarity,
    cursed: data.cursed,
    burned: data.burned,
    indexerUsed: source,
    cached: false,
    checkedAt: Date.now(),
  };
}

function toIndexerCheck(err: IndexerError): IndexerCheck {
  return {
    name: err.source,
    status: err.status,
    ...(err.httpStatus !== undefined ? { httpStatus: err.httpStatus } : {}),
  };
}

async function fetchBitcoinTipHeight(): Promise<number | null> {
  try {
    const signal = AbortSignal.timeout(TIP_HEIGHT_TIMEOUT_MS);
    const res = await fetch('https://mempool.space/api/blocks/tip/height', { signal });
    if (!res.ok) return null;
    const text = await res.text();
    const n = Number.parseInt(text.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function __resetCacheForTests(): void {
  preflightCache.__resetCache();
}

export type { PreflightResponse, PreflightSuccess, PreflightNotFound };
export { preflightCache, PreflightCache };
