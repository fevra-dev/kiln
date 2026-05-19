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
// Tighter timeout for mempool.space (small endpoint, ~50-byte text response)
// vs. PER_INDEXER_TIMEOUT_MS for indexer queries (larger JSON payloads).
const TIP_HEIGHT_TIMEOUT_MS = 3_000;
const BITCOIN_TIP_URL = 'https://mempool.space/api/blocks/tip/height';

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
    const result: PreflightResponse = { ...cached, cached: true };
    console.log(
      `[preflight] id=${inscriptionId} result=${result.exists ? 'exists' : result.reason} indexer=${result.exists ? result.indexerUsed : 'none'} ms=0 cached=true`,
    );
    return result;
  }

  const startTime = Date.now();
  const tipHeight = await fetchBitcoinTipHeight();
  if (tipHeight === null) {
    const response: PreflightNotFound = {
      exists: false,
      inscriptionId,
      reason: 'all_unreachable',
      indexersChecked: [], // empty: indexers were never tried
      cached: false,
      checkedAt: Date.now(),
    };
    preflightCache.set(inscriptionId, response, TTL_UNREACHABLE);
    const ms = Date.now() - startTime;
    console.log(
      `[preflight] id=${inscriptionId} result=${response.reason} indexer=none ms=${ms} cached=false`,
    );
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
    const ms = Date.now() - startTime;
    console.log(
      `[preflight] id=${inscriptionId} result=exists indexer=${response.indexerUsed} ms=${ms} cached=false`,
    );
    return response;
  }

  // Unanimity required: a single indexer asserting not_found is insufficient
  // to claim non-existence — the other might be silently rate-limited or
  // timed out. Conservative: any mixed status → all_unreachable, prompting a
  // retry rather than a false "doesn't exist" gate.
  const reason: PreflightNotFound['reason'] = indexersChecked.every((c) => c.status === 'not_found')
    ? 'not_found'
    : 'all_unreachable';
  const response: PreflightNotFound = {
    exists: false,
    inscriptionId,
    reason,
    indexersChecked,
    cached: false,
    checkedAt: Date.now(),
  };
  preflightCache.set(inscriptionId, response, reason === 'not_found' ? TTL_NOT_FOUND : TTL_UNREACHABLE);
  const ms = Date.now() - startTime;
  console.log(
    `[preflight] id=${inscriptionId} result=${response.reason} indexer=none ms=${ms} cached=false`,
  );
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
    const res = await fetch(BITCOIN_TIP_URL, { signal });
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
