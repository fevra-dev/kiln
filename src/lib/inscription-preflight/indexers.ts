/**
 * Indexer clients for the inscription pre-flight check.
 *
 * Two fetchers (ordinals.com, ordinalswallet) return a normalized IndexerResponse.
 * Each fetcher does its own metadata fetch + optional content fetch (for SHA-256).
 *
 * Endpoint paths verified against live responses 2026-05-18:
 *   ordinals.com: GET /r/inscription/<id>
 *     - field `height`         (plan assumed `genesis_height`)
 *     - field `timestamp`      (unix-s; plan assumed `genesis_block_time`)
 *     - field `charms: string[]` (encodes rarity + "cursed"; no dedicated fields)
 *     - no standalone `rarity` or `cursed` boolean
 *   ordinalswallet: GET turbo.ordinalswallet.com/inscription/<id>
 *     - fields: `genesis_height`, `created` (unix-s), `sat`, `charms`, `content_type`, `content_length`
 *     - `sat` may be null; default to 0
 *     - no public content endpoint; contentSha256 is always null for this indexer
 */

import { webcrypto } from 'crypto';

import type {
  IndexerError,
  IndexerName,
  IndexerResponse,
  IndexerResult,
  SatRarity,
} from './types';

// crypto.subtle is available in Node 19+ globals and modern browsers, but
// jsdom (used in Jest) provides a crypto stub without subtle. Fall back to
// the Node.js built-in webcrypto so tests work in jsdom test environments.
const subtleCrypto: SubtleCrypto =
  (typeof crypto !== 'undefined' && crypto.subtle)
    ? crypto.subtle
    : (webcrypto as unknown as Crypto).subtle;

const PER_INDEXER_TIMEOUT_MS = 5_000;
export const MAX_HASHABLE_BYTES = 5 * 1024 * 1024;

const ORDINALS_BASE = 'https://ordinals.com';
const ORDINALSWALLET_BASE = 'https://turbo.ordinalswallet.com';

function asError(
  source: IndexerName,
  status: IndexerError['status'],
  httpStatus?: number,
): IndexerError {
  return { ok: false, source, status, httpStatus };
}

function classifyHttp(status: number): IndexerError['status'] {
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return 'error';
}

async function safeFetch(
  url: string,
  signal: AbortSignal,
): Promise<Response | { __error: 'timeout' | 'network' }> {
  try {
    const res = await fetch(url, { signal });
    return res;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { __error: 'timeout' };
    return { __error: 'network' };
  }
}

async function sha256OfArrayBuffer(buf: ArrayBuffer): Promise<string> {
  const digest = await subtleCrypto.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

const VALID_RARITIES: SatRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

/**
 * Derive sat rarity from a charms array.
 * The charms array contains string entries such as "uncommon", "rare", "cursed", etc.
 * Returns the first entry that matches a known rarity name, or 'common'.
 * Shared by both fetchFromOrdinals and fetchFromOrdinalsWallet.
 */
function deriveRarityFromCharms(charms: unknown): SatRarity {
  if (!Array.isArray(charms)) return 'common';
  for (const charm of charms) {
    if (typeof charm === 'string' && (VALID_RARITIES as string[]).includes(charm)) {
      return charm as SatRarity;
    }
  }
  return 'common';
}

/**
 * Extract cursed flag from a charms array.
 * Pre-jubilee cursed inscriptions have "cursed" as a charm entry.
 * Shared by both fetchFromOrdinals and fetchFromOrdinalsWallet.
 */
function cursedFromCharms(charms: unknown): boolean {
  if (!Array.isArray(charms)) return false;
  return charms.includes('cursed');
}

async function fetchContentForHash(
  contentUrl: string,
  contentLength: number,
  signal: AbortSignal,
): Promise<string | null> {
  if (contentLength > MAX_HASHABLE_BYTES) return null;
  const res = await safeFetch(contentUrl, signal);
  if ('__error' in res || !res.ok) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_HASHABLE_BYTES) return null;
  return sha256OfArrayBuffer(buf);
}

// ---------------------------------------------------------------------------
// ordinals.com
// ---------------------------------------------------------------------------

/**
 * Real ordinals.com /r/inscription/<id> response shape (verified 2026-05-18).
 * Notable divergences from the original plan:
 *   - `height` (was assumed to be `genesis_height`)
 *   - `timestamp` (was assumed to be `genesis_block_time`)
 *   - `charms: string[]` instead of `rarity: string` + `cursed: boolean`
 */
interface OrdinalsMetadata {
  id?: string;
  sat?: number;
  height?: number | null;
  timestamp?: number | null;    // unix-seconds
  content_type?: string;
  content_length?: number;
  charms?: unknown[];           // string entries: rarity names, "cursed", etc.
  delegate?: string | null;
  // burned status is not surfaced by ordinals.com; treat as false
}

export async function fetchFromOrdinals(
  inscriptionId: string,
  bitcoinTipHeight: number,
): Promise<IndexerResult | IndexerError> {
  const source: IndexerName = 'ordinals.com';
  const signal = AbortSignal.timeout(PER_INDEXER_TIMEOUT_MS);
  const metaUrl = `${ORDINALS_BASE}/r/inscription/${inscriptionId}`;

  const metaRes = await safeFetch(metaUrl, signal);
  if ('__error' in metaRes) {
    return asError(source, metaRes.__error === 'timeout' ? 'timeout' : 'error');
  }
  if (!metaRes.ok) return asError(source, classifyHttp(metaRes.status), metaRes.status);

  let meta: OrdinalsMetadata;
  try {
    meta = (await metaRes.json()) as OrdinalsMetadata;
  } catch {
    return asError(source, 'error', metaRes.status);
  }

  const contentLength = typeof meta.content_length === 'number' ? meta.content_length : 0;
  const genesisBlockHeight = typeof meta.height === 'number' ? meta.height : null;
  const confirmations =
    genesisBlockHeight === null ? 0 : Math.max(0, bitcoinTipHeight - genesisBlockHeight + 1);

  const contentUrl = `${ORDINALS_BASE}/content/${inscriptionId}`;
  const contentSha256 = await fetchContentForHash(contentUrl, contentLength, signal);

  const data: IndexerResponse = {
    inscriptionId,
    sat: typeof meta.sat === 'number' ? meta.sat : 0,
    satRarity: deriveRarityFromCharms(meta.charms),
    genesisBlockHeight,
    genesisTimestamp: typeof meta.timestamp === 'number' ? meta.timestamp : null,
    confirmations,
    contentType: typeof meta.content_type === 'string' ? meta.content_type : 'application/octet-stream',
    contentLength,
    contentSha256,
    cursed: cursedFromCharms(meta.charms),
    burned: false, // ordinals.com does not surface burned status
  };

  return { ok: true, data, source };
}

// ---------------------------------------------------------------------------
// ordinalswallet (turbo.ordinalswallet.com)
// ---------------------------------------------------------------------------

/**
 * turbo.ordinalswallet.com/inscription/<id> response shape (verified live).
 * Notable: `created` is unix-seconds, `sat` may be null, `charms` same format as ordinals.com.
 * No public content endpoint exists; contentSha256 is skipped for this indexer.
 */
interface OrdinalsWalletMetadata {
  id?: string;
  sat?: number | null;
  genesis_height?: number | null;
  created?: number | null;     // unix-seconds
  content_type?: string;
  content_length?: number;
  charms?: string[];
}

export async function fetchFromOrdinalsWallet(
  inscriptionId: string,
  bitcoinTipHeight: number,
): Promise<IndexerResult | IndexerError> {
  const source: IndexerName = 'ordinalswallet';
  const signal = AbortSignal.timeout(PER_INDEXER_TIMEOUT_MS);
  const metaUrl = `${ORDINALSWALLET_BASE}/inscription/${inscriptionId}`;

  const metaRes = await safeFetch(metaUrl, signal);
  if ('__error' in metaRes) {
    return asError(source, metaRes.__error === 'timeout' ? 'timeout' : 'error');
  }
  if (!metaRes.ok) return asError(source, classifyHttp(metaRes.status), metaRes.status);

  let meta: OrdinalsWalletMetadata;
  try {
    meta = (await metaRes.json()) as OrdinalsWalletMetadata;
  } catch {
    return asError(source, 'error', metaRes.status);
  }

  const contentLength = typeof meta.content_length === 'number' ? meta.content_length : 0;
  const genesisBlockHeight =
    typeof meta.genesis_height === 'number' ? meta.genesis_height : null;
  const confirmations =
    genesisBlockHeight === null ? 0 : Math.max(0, bitcoinTipHeight - genesisBlockHeight + 1);

  // ordinalswallet has no public content endpoint — skip content fetch entirely
  const contentSha256: string | null = null;

  const data: IndexerResponse = {
    inscriptionId,
    sat: typeof meta.sat === 'number' ? meta.sat : 0,
    satRarity: deriveRarityFromCharms(meta.charms),
    genesisBlockHeight,
    genesisTimestamp: typeof meta.created === 'number' ? meta.created : null, // already unix-seconds
    confirmations,
    contentType:
      typeof meta.content_type === 'string' ? meta.content_type : 'application/octet-stream',
    contentLength,
    contentSha256,
    cursed: cursedFromCharms(meta.charms),
    burned: false, // ordinalswallet does not surface burned status
  };

  return { ok: true, data, source };
}

export function contentUrlFor(_source: IndexerName, inscriptionId: string): string {
  // Content is always served from ordinals.com regardless of which indexer
  // served the metadata. ordinalswallet has no public content endpoint.
  return `${ORDINALS_BASE}/content/${inscriptionId}`;
}
