# Pre-Burn Inscription Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bitcoin-side inscription pre-flight check that gates the KILN burn flow — eliminate the silent, irreversible failure mode where a user with a typo'd or non-existent inscription ID can permanently burn their Solana NFT into nothing.

> **Updated 2026-05-18 (in-flight):** During implementation, Hiro's public Ordinals API (`api.hiro.so/ordinals/v1`) was found to be deprecated (HTTP 410 Gone). The fallback indexer was swapped to `turbo.ordinalswallet.com` (commit `511e2d6`). All references to `hiro.so`, `fetchFromHiro`, and `HIRO_BASE` in this plan reflect the as-built `ordinalswallet` equivalents. Task 3 fixture field names are updated to match the real live response shapes (ordinals.com uses `height`/`timestamp`/`charms[]`; ordinalswallet uses `genesis_height`/`created`/`charms[]` with no content endpoint).

**Architecture:** New Next.js route `/api/inscription/preflight` proxies a two-indexer fallback chain (ordinals.com → ordinalswallet) with an in-memory LRU cache keyed by inscription ID. A `useInscriptionPreflight` client hook drives a compact status row in the entry form (debounced as the user types) and a full rich-content preview panel in Step 3. Three escalating override mechanics (no-override / checkbox / typed-word) gate the burn based on confirmation count and indexer state. Reuses existing Web Crypto API for SHA-256; reuses existing `jest` + `tests/setup.ts` infra.

**Tech Stack:** Next.js App Router, TypeScript, React, Web Crypto API (`crypto.subtle.digest`), Jest with `ts-jest`, jsdom test env. No new runtime dependencies.

**Source spec:** `docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md`

---

## File structure

### Created files

| Path | Responsibility |
|---|---|
| `src/lib/inscription-preflight/types.ts` | `PreflightSuccess`, `PreflightNotFound`, `PreflightResponse` discriminated union; indexer status enum |
| `src/lib/inscription-preflight/cache.ts` | In-memory `Map`-based LRU with per-entry TTL; `get` / `set` / `__resetCache` |
| `src/lib/inscription-preflight/indexers.ts` | Two fetcher functions (`fetchFromOrdinals`, `fetchFromOrdinalsWallet`) returning a shared normalized `IndexerResponse` shape; per-fetch 5s timeout via `AbortSignal.timeout`; content fetch + SHA-256 over fetched bytes (ordinalswallet has no content endpoint; always returns `contentSha256: null`) |
| `src/lib/inscription-preflight/index.ts` | `preflight(inscriptionId)` orchestration: validate → cache lookup → primary → fallback → cache write → return |
| `src/app/api/inscription/preflight/route.ts` | `GET` handler; reads `id` query param; calls `preflight()`; returns JSON |
| `src/lib/hooks/useInscriptionPreflight.ts` | Client hook: 500ms debounce + AbortController + stale-while-revalidate |
| `src/components/preflight/ContentRenderer.tsx` | Renders inscription content by `content-type`: `<img>`, `<pre>`, sandboxed `<iframe>`, fallback download link |
| `src/components/preflight/OverrideControls.tsx` | Checkbox + typed-word override widgets; emits `acknowledged: boolean` |
| `src/components/preflight/InscriptionStatusRow.tsx` | Compact one-line status (✅ / ⚠️ / ⛔) for the entry form |
| `src/components/preflight/InscriptionPanel.tsx` | Full preview panel for Step 3: content + metadata + SHA-256 + override |
| `tests/unit/inscription-preflight-cache.test.ts` | Cache TTL, LRU eviction, mixed-case key normalization |
| `tests/unit/inscription-preflight-indexers.test.ts` | Mocked `fetch` — success, 404, timeout, 429, malformed JSON |
| `tests/unit/inscription-preflight-orchestration.test.ts` | Fallback chain, cache hit/miss, content size cap, response shape |
| `tests/unit/inscription-preflight-route.test.ts` | Route handler: valid ID, invalid format (400), missing param (400), result shape |

### Modified files

| Path | Lines (approx) | Change |
|---|---|---|
| `jest.config.js` | 12 | Fix `transformIgnorePatterns` to handle pnpm's `.pnpm/<pkg>/` path layout |
| `src/components/teleburn/TeleburnForm.tsx` | 150–170 area | Add `InscriptionStatusRow` under the inscription-ID input; gate Submit button on preflight result |
| `src/components/wizard/Step3Preview.tsx` | 190–227 area | Add `InscriptionPanel` above the simulation results; replace the bare "PROCEED TO EXECUTION" button with a gated version that requires preflight override when applicable |

### Deleted files (cleanup)

| Path | Reason |
|---|---|
| `src/components/wizard/InscriptionVerificationStep.tsx` | Orphaned v0.x verifier (no importers in src/ after the new preflight ships). Replaced by `InscriptionPanel`. |

---

## Pre-flight environment notes for the engineer

You have zero context, so:

- **Project uses pnpm**, not npm. All commands below use `pnpm`.
- **Tests run via `pnpm jest <path>` or `pnpm test`** (which runs all tests). Jest is configured with `ts-jest`, `jsdom` env, fetch mocked in `tests/setup.ts`.
- **The codebase already polyfills `crypto.subtle`** via `webcrypto` in `tests/setup.ts`, so SHA-256 tests work without extra setup.
- **NextRequest / NextResponse are mocked** at `tests/__mocks__/next-server.js` and aliased via `jest.config.js`. Route handler tests should import from `next/server` normally; the mock kicks in transparently.
- **TypeScript strict mode is on.** Use `unknown` over `any`; prefer narrow types; null-check everything.
- **Existing inscription-fetching code lives in `src/lib/inscription-resilience.ts` and `src/lib/inscription-verifier.ts`**, but it's tied to v0.x SHA-256 verification and a different response shape. **Do not refactor or reuse it.** Build the new preflight module fresh; a future cleanup spec will consolidate.
- **Helius DAS is not relevant to this spec.** The preflight is pure Bitcoin indexer logic.

---

## Task 0: Fix Jest infra for pnpm — prerequisite

**Files:**
- Modify: `jest.config.js`

This change is required because the existing `transformIgnorePatterns` regex doesn't match pnpm's `.pnpm/<pkg>@<version>/node_modules/<pkg>/` directory layout, breaking ts-jest on any test that transitively imports `@solana/web3.js`. The preflight tests in this plan don't import Solana, so they would run today — but landing this fix unblocks all other future testing work and is a 5-minute change.

- [ ] **Step 0.1: Confirm the current regex breaks Solana imports**

Run: `pnpm jest tests/unit/transaction-utils.test.ts 2>&1 | head -20`

Expected: Stack trace ending with `SyntaxError: Unexpected token 'export'` originating from `node_modules/.pnpm/uuid@8.3.2/...` This is the bug we're about to fix.

If this test already passes, the fix has already been applied; skip to Task 1.

- [ ] **Step 0.2: Apply the pnpm-aware transform pattern**

Edit `jest.config.js`, replace this line:

```js
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@noble|@solana|jayson)/)',
  ],
```

with:

```js
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/)?(uuid|@noble|@solana|jayson)(@[^/]+)?/)',
  ],
```

The new pattern matches both flat npm layouts (`node_modules/uuid/`) and pnpm's nested layout (`node_modules/.pnpm/uuid@8.3.2/`).

- [ ] **Step 0.3: Confirm the fix works**

Run: `pnpm jest tests/unit/transaction-utils.test.ts 2>&1 | tail -10`

Expected: tests now load (may pass or have other unrelated issues, but the pnpm/uuid SyntaxError is gone).

- [ ] **Step 0.4: Confirm no regressions**

Run: `pnpm jest tests/unit/schemas.test.ts 2>&1 | tail -5`

Expected: `Tests: 39 passed, 39 total` (this previously-working test should still pass).

- [ ] **Step 0.5: Commit**

```bash
git add jest.config.js
git commit -m "fix(jest): match pnpm .pnpm/<pkg>@<ver>/ paths in transformIgnorePatterns

Fixes ts-jest failing on any test that transitively imports @solana/web3.js
(via uuid → jayson → web3). Pre-existing infra blocker; unblocks tests for
the inscription-preflight module landing in this PR's siblings.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 1: Preflight types module

**Files:**
- Create: `src/lib/inscription-preflight/types.ts`

This is pure types — no test (TypeScript catches issues at compile time).

- [ ] **Step 1.1: Write the types file**

Create `src/lib/inscription-preflight/types.ts`:

```ts
/**
 * Type contracts for the pre-burn inscription pre-flight check.
 * See: docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md §4.2
 */

export type SatRarity =
  | 'common' | 'uncommon' | 'rare'
  | 'epic' | 'legendary' | 'mythic';

export type IndexerName = 'ordinals.com' | 'ordinalswallet';

export type IndexerCheckStatus =
  | 'not_found'
  | 'timeout'
  | 'error'
  | 'rate_limited';

export interface IndexerCheck {
  name: IndexerName;
  status: IndexerCheckStatus;
  httpStatus?: number;
}

export interface PreflightSuccess {
  exists: true;
  inscriptionId: string;
  confirmations: number;
  genesisBlockHeight: number | null;
  genesisTimestamp: number | null;
  contentType: string;
  contentLength: number;
  contentSha256: string | null;
  contentUrl: string;
  sat: number;
  satRarity: SatRarity;
  cursed: boolean;
  burned: boolean;
  indexerUsed: IndexerName;
  cached: boolean;
  checkedAt: number;
}

export interface PreflightNotFound {
  exists: false;
  inscriptionId: string;
  reason: 'not_found' | 'all_unreachable';
  indexersChecked: IndexerCheck[];
  checkedAt: number;
}

export type PreflightResponse = PreflightSuccess | PreflightNotFound;

/**
 * Intermediate normalized shape returned by individual indexer clients.
 * Orchestration layer transforms this into PreflightResponse.
 */
export interface IndexerResponse {
  inscriptionId: string;
  sat: number;
  satRarity: SatRarity;
  genesisBlockHeight: number | null;
  genesisTimestamp: number | null;
  confirmations: number;
  contentType: string;
  contentLength: number;
  contentSha256: string | null;
  cursed: boolean;
  burned: boolean;
}

export interface IndexerResult {
  ok: true;
  data: IndexerResponse;
  source: IndexerName;
}

export interface IndexerError {
  ok: false;
  source: IndexerName;
  status: IndexerCheckStatus;
  httpStatus?: number;
}
```

- [ ] **Step 1.2: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "src/lib/inscription-preflight" | head -5`

Expected: no output (no errors in the new file).

- [ ] **Step 1.3: Commit**

```bash
git add src/lib/inscription-preflight/types.ts
git commit -m "feat(preflight): type contracts for inscription pre-flight

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: LRU cache utility with per-entry TTL

**Files:**
- Create: `src/lib/inscription-preflight/cache.ts`
- Create: `tests/unit/inscription-preflight-cache.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/inscription-preflight-cache.test.ts`:

```ts
/**
 * Tests for src/lib/inscription-preflight/cache.ts
 */

import { PreflightCache } from '@/lib/inscription-preflight/cache';

describe('PreflightCache', () => {
  let cache: PreflightCache;

  beforeEach(() => {
    cache = new PreflightCache({ maxEntries: 3 });
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves a value within TTL', () => {
    cache.set('a', { v: 1 }, 1000);
    expect(cache.get('a')).toEqual({ v: 1 });
  });

  it('expires entries past TTL', () => {
    jest.useFakeTimers();
    cache.set('a', { v: 1 }, 100);
    jest.advanceTimersByTime(101);
    expect(cache.get('a')).toBeUndefined();
    jest.useRealTimers();
  });

  it('treats TTL of Infinity as never-expiring', () => {
    jest.useFakeTimers();
    cache.set('a', { v: 1 }, Infinity);
    jest.advanceTimersByTime(1_000_000_000);
    expect(cache.get('a')).toEqual({ v: 1 });
    jest.useRealTimers();
  });

  it('evicts oldest when exceeding maxEntries', () => {
    cache.set('a', 1, Infinity);
    cache.set('b', 2, Infinity);
    cache.set('c', 3, Infinity);
    cache.set('d', 4, Infinity); // forces eviction of 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('updates LRU order on get (touching keeps the entry alive)', () => {
    cache.set('a', 1, Infinity);
    cache.set('b', 2, Infinity);
    cache.set('c', 3, Infinity);
    cache.get('a'); // touches 'a'
    cache.set('d', 4, Infinity); // should evict 'b' (now the oldest)
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('__resetCache wipes all entries', () => {
    cache.set('a', 1, Infinity);
    cache.__resetCache();
    expect(cache.get('a')).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm jest tests/unit/inscription-preflight-cache.test.ts 2>&1 | tail -10`

Expected: `Cannot find module '@/lib/inscription-preflight/cache'` (the module doesn't exist yet).

- [ ] **Step 2.3: Write minimal implementation**

Create `src/lib/inscription-preflight/cache.ts`:

```ts
/**
 * In-memory LRU cache with per-entry TTL.
 * Per-instance only (Vercel serverless); no cross-instance sharing.
 *
 * Use Infinity as TTL for permanent entries (e.g. confirmed-≥6 results).
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number; // epoch-ms or Infinity
}

export interface PreflightCacheOptions {
  maxEntries: number;
}

export class PreflightCache {
  private map: Map<string, CacheEntry<unknown>>;
  private readonly maxEntries: number;

  constructor(options: PreflightCacheOptions = { maxEntries: 10_000 }) {
    this.map = new Map();
    this.maxEntries = options.maxEntries;
  }

  get<V>(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== Infinity && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // LRU touch: re-insert to move to end of Map iteration order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value as V;
  }

  set<V>(key: string, value: V, ttlMs: number): void {
    const expiresAt = ttlMs === Infinity ? Infinity : Date.now() + ttlMs;
    this.map.delete(key); // ensure new position is end-of-order
    this.map.set(key, { value, expiresAt });
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  __resetCache(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

/** Singleton cache instance for use by the preflight module. */
export const preflightCache = new PreflightCache({ maxEntries: 10_000 });
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `pnpm jest tests/unit/inscription-preflight-cache.test.ts 2>&1 | tail -10`

Expected: `Tests: 7 passed, 7 total`.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/inscription-preflight/cache.ts tests/unit/inscription-preflight-cache.test.ts
git commit -m "feat(preflight): in-memory LRU cache with per-entry TTL

Per-instance only; matches Vercel serverless model. Map-based with O(1)
get/set; supports Infinity TTL for permanent caching of confirmed-deep
inscriptions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Indexer client functions

**Files:**
- Create: `src/lib/inscription-preflight/indexers.ts`
- Create: `tests/unit/inscription-preflight-indexers.test.ts`

This task builds the two fetchers (ordinals.com, ordinalswallet) that translate raw indexer responses into the normalized `IndexerResult | IndexerError` shape.

**Note on endpoint paths (as-built):** The URLs below reflect the live shapes verified on 2026-05-18. ordinals.com uses `height`/`timestamp`/`charms[]` (not `genesis_height`/`genesis_block_time`/`rarity`). ordinalswallet uses `genesis_height`/`created`/`charms[]` and has no public content endpoint. **As your first step, fetch one known inscription from each indexer with `curl` and confirm the field names still match.**

Known-good inscription for verification: `6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0`.

- [ ] **Step 3.1: Verify real indexer response shapes**

Run:

```bash
curl -s -H "Accept: application/json" "https://ordinals.com/r/inscription/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0" | head -50
curl -s "https://turbo.ordinalswallet.com/inscription/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0" | head -50
```

Expected (as-built): ordinals.com returns `id`, `sat`, `height`, `timestamp`, `content_type`, `content_length`, `charms: string[]`. ordinalswallet returns `id`, `sat`, `genesis_height`, `created`, `content_type`, `content_length`, `charms: string[]`. Note the actual field names — update both the indexer client and the test mocks if they differ.

- [ ] **Step 3.2: Write the failing test**

Create `tests/unit/inscription-preflight-indexers.test.ts`:

```ts
import { fetchFromOrdinals, fetchFromOrdinalsWallet } from '@/lib/inscription-preflight/indexers';

const VALID_ID = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';

// Real field shapes verified against live indexers 2026-05-18.
const ORDINALS_OK_BODY = {
  id: VALID_ID,
  sat: 425639728,
  height: 875432,          // ordinals.com uses `height`, not `genesis_height`
  timestamp: 1764732009,   // ordinals.com uses `timestamp` (unix-s), not `genesis_block_time`
  content_type: 'image/png',
  content_length: 87234,
  charms: ['uncommon'],    // rarity + cursed/burned are entries in `charms[]`, not standalone fields
};

const ORDINALSWALLET_OK_BODY = {
  id: VALID_ID,
  sat: 425639728,
  genesis_height: 875432,  // ordinalswallet uses `genesis_height`
  created: 1764732009,     // ordinalswallet uses `created` (unix-s)
  content_type: 'image/png',
  content_length: 87234,
  charms: ['uncommon'],
  // no content endpoint — contentSha256 will be null for this indexer
};

const fetchMock = global.fetch as jest.Mock;

function mockFetchSequence(...responses: Array<{ status: number; body: unknown; contentLength?: number; bytes?: Uint8Array }>) {
  fetchMock.mockReset();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: new Headers({
        'content-type': typeof r.body === 'object' ? 'application/json' : 'application/octet-stream',
        'content-length': String(r.contentLength ?? (r.bytes ? r.bytes.byteLength : 0)),
      }),
      json: async () => r.body,
      arrayBuffer: async () => (r.bytes ?? new Uint8Array(0)).buffer,
      text: async () => JSON.stringify(r.body),
    });
  }
}

describe('fetchFromOrdinals', () => {
  it('returns ok result on 200 with valid JSON + content', async () => {
    mockFetchSequence(
      { status: 200, body: ORDINALS_OK_BODY },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.inscriptionId).toBe(VALID_ID);
      expect(result.data.confirmations).toBe(875440 - 875432 + 1);
      expect(result.data.contentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.data.sat).toBe(425639728);
      expect(result.source).toBe('ordinals.com');
    }
  });

  it('returns not_found on metadata 404', async () => {
    mockFetchSequence({ status: 404, body: { error: 'not found' } });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('not_found');
      expect(result.httpStatus).toBe(404);
    }
  });

  it('returns rate_limited on metadata 429', async () => {
    mockFetchSequence({ status: 429, body: {} });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('rate_limited');
  });

  it('returns error on 5xx', async () => {
    mockFetchSequence({ status: 502, body: {} });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('error');
  });

  it('returns error on malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      json: async () => { throw new SyntaxError('not json'); },
    });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('error');
  });

  it('returns content_length-only when content exceeds MAX_HASHABLE_BYTES', async () => {
    const bigSize = 6 * 1024 * 1024;
    mockFetchSequence(
      { status: 200, body: { ...ORDINALS_OK_BODY, content_length: bigSize } },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentSha256).toBeNull();
      expect(result.data.contentLength).toBe(bigSize);
    }
  });

  it('marks confirmations=0 for mempool (height null)', async () => {
    mockFetchSequence(
      { status: 200, body: { ...ORDINALS_OK_BODY, height: null } },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.confirmations).toBe(0);
      expect(result.data.genesisBlockHeight).toBeNull();
    }
  });
});

describe('fetchFromOrdinalsWallet', () => {
  it('returns ok result on 200 (contentSha256 always null — no content endpoint)', async () => {
    mockFetchSequence(
      { status: 200, body: ORDINALSWALLET_OK_BODY },
      // no second fetch — ordinalswallet has no content endpoint
    );
    const result = await fetchFromOrdinalsWallet(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('ordinalswallet');
      expect(result.data.confirmations).toBe(875440 - 875432 + 1);
      expect(result.data.contentSha256).toBeNull();
    }
  });

  it('returns not_found on 404', async () => {
    mockFetchSequence({ status: 404, body: { error: 'not found' } });
    const result = await fetchFromOrdinalsWallet(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('not_found');
  });
});
```

- [ ] **Step 3.3: Run test to verify it fails**

Run: `pnpm jest tests/unit/inscription-preflight-indexers.test.ts 2>&1 | tail -10`

Expected: `Cannot find module '@/lib/inscription-preflight/indexers'`.

- [ ] **Step 3.4: Write minimal implementation**

Create `src/lib/inscription-preflight/indexers.ts`:

```ts
/**
 * Indexer clients for the inscription pre-flight check.
 *
 * Two fetchers (ordinals.com, ordinalswallet) return a normalized IndexerResponse.
 * Each fetcher does its own metadata fetch + optional content fetch (for SHA-256).
 * Endpoint paths verified against live responses 2026-05-18:
 *   ordinals.com: GET /r/inscription/<id>  (fields: height, timestamp, charms[])
 *   ordinalswallet: GET turbo.ordinalswallet.com/inscription/<id>  (fields: genesis_height, created, charms[])
 *   Note: ordinalswallet has no public content endpoint; contentSha256 is always null for that path.
 */

import type {
  IndexerError,
  IndexerName,
  IndexerResponse,
  IndexerResult,
  SatRarity,
} from './types';

const PER_INDEXER_TIMEOUT_MS = 5_000;
export const MAX_HASHABLE_BYTES = 5 * 1024 * 1024;

const ORDINALS_BASE = 'https://ordinals.com';
const ORDINALSWALLET_BASE = 'https://turbo.ordinalswallet.com';

function asError(source: IndexerName, status: IndexerError['status'], httpStatus?: number): IndexerError {
  return { ok: false, source, status, httpStatus };
}

function classifyHttp(status: number): IndexerError['status'] {
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return 'error';
}

async function safeFetch(url: string, signal: AbortSignal): Promise<Response | { __error: 'timeout' | 'network' }> {
  try {
    const res = await fetch(url, { signal });
    return res;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { __error: 'timeout' };
    return { __error: 'network' };
  }
}

async function sha256OfArrayBuffer(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

const VALID_RARITIES: SatRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

/** Returns the first valid rarity string in `charms`, or 'common' if none. */
function deriveRarityFromCharms(charms: unknown): SatRarity {
  if (!Array.isArray(charms)) return 'common';
  for (const charm of charms) {
    if (typeof charm === 'string' && (VALID_RARITIES as string[]).includes(charm)) return charm as SatRarity;
  }
  return 'common';
}

/** Pre-jubilee cursed inscriptions have "cursed" as a charm entry. */
function cursedFromCharms(charms: unknown): boolean {
  if (!Array.isArray(charms)) return false;
  return charms.includes('cursed');
}

/** Inscriptions on OP_RETURN outputs have "burned" as a charm entry. */
function burnedFromCharms(charms: unknown): boolean {
  if (!Array.isArray(charms)) return false;
  return charms.includes('burned');
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

interface OrdinalsMetadata {
  id?: string;
  sat?: number;
  height?: number | null;          // genesis block height (real field name, not genesis_height)
  timestamp?: number | null;       // unix-seconds (real field name, not genesis_block_time)
  content_type?: string;
  content_length?: number;
  charms?: unknown[];              // string entries: rarity names ('uncommon' etc), 'cursed', 'burned'
  delegate?: string | null;
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
  const genesisBlockHeight = typeof meta.height === 'number' ? meta.height : null; // real field: `height`
  const confirmations = genesisBlockHeight === null ? 0 : Math.max(0, bitcoinTipHeight - genesisBlockHeight + 1);

  const contentUrl = `${ORDINALS_BASE}/content/${inscriptionId}`;
  const contentSha256 = await fetchContentForHash(contentUrl, contentLength, signal);

  const data: IndexerResponse = {
    inscriptionId,
    sat: typeof meta.sat === 'number' ? meta.sat : 0,
    satRarity: deriveRarityFromCharms(meta.charms),    // rarity derived from charms[]
    genesisBlockHeight,
    genesisTimestamp: typeof meta.timestamp === 'number' ? meta.timestamp : null, // real field: `timestamp` (unix-s)
    confirmations,
    contentType: typeof meta.content_type === 'string' ? meta.content_type : 'application/octet-stream',
    contentLength,
    contentSha256,
    cursed: cursedFromCharms(meta.charms),             // derived from charms[]
    burned: burnedFromCharms(meta.charms),             // derived from charms[]
  };

  return { ok: true, data, source };
}

// ---------------------------------------------------------------------------
// ordinalswallet (turbo.ordinalswallet.com)
// ---------------------------------------------------------------------------

interface OrdinalsWalletMetadata {
  id?: string;
  sat?: number | null;
  genesis_height?: number | null;  // ordinalswallet uses genesis_height (unlike ordinals.com which uses height)
  created?: number | null;         // unix-seconds (ordinalswallet-specific field)
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
  const genesisBlockHeight = typeof meta.genesis_height === 'number' ? meta.genesis_height : null;
  const confirmations = genesisBlockHeight === null ? 0 : Math.max(0, bitcoinTipHeight - genesisBlockHeight + 1);

  // ordinalswallet has no public content endpoint — skip content fetch entirely
  const contentSha256: string | null = null;

  const data: IndexerResponse = {
    inscriptionId,
    sat: typeof meta.sat === 'number' ? meta.sat : 0,
    satRarity: deriveRarityFromCharms(meta.charms),
    genesisBlockHeight,
    genesisTimestamp: typeof meta.created === 'number' ? meta.created : null, // already unix-seconds
    confirmations,
    contentType: typeof meta.content_type === 'string' ? meta.content_type : 'application/octet-stream',
    contentLength,
    contentSha256,
    cursed: cursedFromCharms(meta.charms),
    burned: burnedFromCharms(meta.charms),
  };

  return { ok: true, data, source };
}

export function contentUrlFor(_source: IndexerName, inscriptionId: string): string {
  // Content is always served from ordinals.com regardless of which indexer
  // served the metadata. ordinalswallet has no public content endpoint.
  return `${ORDINALS_BASE}/content/${inscriptionId}`;
}
```

- [ ] **Step 3.5: Run test to verify it passes**

Run: `pnpm jest tests/unit/inscription-preflight-indexers.test.ts 2>&1 | tail -10`

Expected: `Tests: 9 passed, 9 total`. If any fail, the actual response shape from Step 3.1 differs from `ORDINALS_OK_BODY`/`HIRO_OK_BODY` in the test — update both the test fixtures and the metadata-parsing logic to match the live responses.

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/inscription-preflight/indexers.ts tests/unit/inscription-preflight-indexers.test.ts
git commit -m "feat(preflight): ordinals.com + ordinalswallet indexer clients

5s per-request timeout, normalized IndexerResponse shape, content SHA-256
computation gated by MAX_HASHABLE_BYTES (5 MB). ordinalswallet has no
content endpoint; contentSha256 is always null for that indexer path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Orchestration — preflight() main function

**Files:**
- Create: `src/lib/inscription-preflight/index.ts`
- Create: `tests/unit/inscription-preflight-orchestration.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `tests/unit/inscription-preflight-orchestration.test.ts`:

```ts
import { preflight, __resetCacheForTests } from '@/lib/inscription-preflight';
import { preflightCache } from '@/lib/inscription-preflight/cache';

const VALID_ID = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';
const TIP_HEIGHT = 875_440;

const fetchMock = global.fetch as jest.Mock;

// Helpers to set up indexer responses without depending on raw URLs.
function setupOrdinalsOk(opts: { genesisHeight?: number | null; bytes?: Uint8Array; contentLength?: number } = {}) {
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (url.startsWith('https://ordinals.com/r/inscription/')) {
      return {
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: VALID_ID,
          sat: 425639728,
          height: opts.genesisHeight === undefined ? 875432 : opts.genesisHeight, // real field: height
          timestamp: 1764732009,  // real field: timestamp (unix-s)
          content_type: 'image/png',
          content_length: opts.contentLength ?? 3,
          charms: ['uncommon'],   // rarity + cursed/burned encoded in charms[]
        }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (url.startsWith('https://ordinals.com/content/')) {
      return {
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'image/png', 'content-length': String(opts.bytes?.byteLength ?? 3) }),
        arrayBuffer: async () => (opts.bytes ?? new Uint8Array([1, 2, 3])).buffer,
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}

function setupOrdinals404() {
  fetchMock.mockImplementationOnce(async () => ({
    ok: false, status: 404,
    headers: new Headers(),
    json: async () => ({ error: 'not found' }),
  }));
}

function setupOrdinalsWalletOk() {
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (url.includes('ordinalswallet.com')) {
      return {
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: VALID_ID,
          sat: 425639728,
          genesis_height: 875432,  // ordinalswallet uses genesis_height
          created: 1764732009,     // ordinalswallet uses created (unix-s)
          content_type: 'image/png',
          content_length: 3,
          charms: ['uncommon'],
        }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  // ordinalswallet has no content endpoint — no second fetch mock needed
}

function setupOrdinalsWallet404() {
  fetchMock.mockImplementationOnce(async () => ({
    ok: false, status: 404, headers: new Headers(),
    json: async () => ({ error: 'not found' }),
  }));
}

function setupTipHeightFetch() {
  // The orchestration fetches the current BTC tip height; mock it first.
  fetchMock.mockImplementationOnce(async () => ({
    ok: true, status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => TIP_HEIGHT,
  }));
}

describe('preflight()', () => {
  beforeEach(() => {
    __resetCacheForTests();
    fetchMock.mockReset();
  });

  it('rejects invalid inscription ID format', async () => {
    await expect(preflight('not-an-inscription')).rejects.toThrow(/invalid inscription id format/i);
  });

  it('normalizes mixed-case input to lowercase', async () => {
    setupTipHeightFetch();
    setupOrdinalsOk();
    const upperId = VALID_ID.toUpperCase();
    const result = await preflight(upperId);
    expect(result.inscriptionId).toBe(VALID_ID);
  });

  it('returns success with confirmations on ordinals.com 200', async () => {
    setupTipHeightFetch();
    setupOrdinalsOk();
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(true);
    if (result.exists) {
      expect(result.confirmations).toBe(TIP_HEIGHT - 875432 + 1);
      expect(result.indexerUsed).toBe('ordinals.com');
      expect(result.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('falls back to ordinalswallet on ordinals 404', async () => {
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWalletOk();
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(true);
    if (result.exists) expect(result.indexerUsed).toBe('ordinalswallet');
  });

  it('returns not_found when both indexers 404', async () => {
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWallet404();
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(false);
    if (!result.exists) {
      expect(result.reason).toBe('not_found');
      expect(result.indexersChecked).toHaveLength(2);
    }
  });

  it('returns all_unreachable on network errors from both indexers', async () => {
    setupTipHeightFetch();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(false);
    if (!result.exists) expect(result.reason).toBe('all_unreachable');
  });

  it('caches successful results indefinitely when confirmations >= 6', async () => {
    setupTipHeightFetch();
    setupOrdinalsOk();
    await preflight(VALID_ID);

    // Second call should hit cache; no new fetches.
    const before = fetchMock.mock.calls.length;
    const result2 = await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBe(before);
    if (result2.exists) expect(result2.cached).toBe(true);
  });

  it('caches successful results 30s when confirmations < 6', async () => {
    jest.useFakeTimers();
    setupTipHeightFetch();
    setupOrdinalsOk({ genesisHeight: TIP_HEIGHT - 1 }); // 2 confirmations

    await preflight(VALID_ID);
    jest.advanceTimersByTime(35_000);

    // Cache should be expired; should re-fetch.
    setupTipHeightFetch();
    setupOrdinalsOk({ genesisHeight: TIP_HEIGHT - 1 });
    const callsBefore = fetchMock.mock.calls.length;
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    jest.useRealTimers();
  });

  it('caches not_found for 30s', async () => {
    jest.useFakeTimers();
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWallet404();
    await preflight(VALID_ID);

    // Within 30s, second call hits cache (no fetch).
    const before = fetchMock.mock.calls.length;
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBe(before);

    // After 35s, cache expired, retries.
    jest.advanceTimersByTime(35_000);
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWallet404();
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    jest.useRealTimers();
  });

  it('caches all_unreachable for 5s', async () => {
    jest.useFakeTimers();
    setupTipHeightFetch();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await preflight(VALID_ID);

    // After 6s, cache should be expired.
    jest.advanceTimersByTime(6_000);
    setupTipHeightFetch();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await preflight(VALID_ID);
    // 2 tip-height fetches + 4 indexer attempts = 6 fetch calls
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(6);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `pnpm jest tests/unit/inscription-preflight-orchestration.test.ts 2>&1 | tail -10`

Expected: `Cannot find module '@/lib/inscription-preflight'`.

- [ ] **Step 4.3: Write the orchestration**

Create `src/lib/inscription-preflight/index.ts`:

```ts
/**
 * Orchestration entrypoint for the pre-burn inscription pre-flight check.
 *
 * Flow:
 *  1. Validate inscription ID format (regex, lowercase normalization)
 *  2. Cache lookup → return immediately if hit (mark cached: true)
 *  3. Fetch current BTC tip height (small public endpoint)
 *  4. Try ordinals.com first; on failure (404/timeout/error/rate-limit), try ordinalswallet
 *  5. Normalize → cache with appropriate TTL → return
 */

import {
  preflightCache,
  PreflightCache,
} from './cache';
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

const TTL_CONFIRMED_DEEP = Infinity;        // >= 6 conf
const TTL_CONFIRMED_SHALLOW = 30_000;       // 1..5 conf or mempool
const TTL_NOT_FOUND = 30_000;
const TTL_UNREACHABLE = 5_000;

/**
 * Public entry point. May throw on invalid format (caller's bug).
 * Never throws on indexer failure — returns PreflightNotFound instead.
 */
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

  // Try ordinals.com first.
  const ordRes = await fetchFromOrdinals(inscriptionId, tipHeight);
  if (ordRes.ok) {
    final = ordRes;
  } else {
    indexersChecked.push(toIndexerCheck(ordRes));
  }

  // Fall back to ordinalswallet if needed.
  if (!final) {
    const walletRes = await fetchFromOrdinalsWallet(inscriptionId, tipHeight);
    if (walletRes.ok) {
      final = walletRes;
    } else {
      indexersChecked.push(toIndexerCheck(walletRes));
    }
  }

  if (final) {
    const response = buildSuccess(final);
    const ttl = response.confirmations >= 6 ? TTL_CONFIRMED_DEEP : TTL_CONFIRMED_SHALLOW;
    preflightCache.set(inscriptionId, response, ttl);
    return response;
  }

  // Both failed — distinguish not_found from all_unreachable by inspecting statuses.
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

/**
 * Fetch current Bitcoin tip height. Returns null on any failure
 * (caller treats null as a network-level outage for confirmation math).
 */
async function fetchBitcoinTipHeight(): Promise<number | null> {
  try {
    const signal = AbortSignal.timeout(TIP_HEIGHT_TIMEOUT_MS);
    // mempool.space is a stable, free, no-auth endpoint that returns the
    // current tip height as a plain integer.
    const res = await fetch('https://mempool.space/api/blocks/tip/height', { signal });
    if (!res.ok) return null;
    const text = await res.text();
    const n = Number.parseInt(text.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Test-only helper. */
export function __resetCacheForTests(): void {
  preflightCache.__resetCache();
}

export type { PreflightResponse, PreflightSuccess, PreflightNotFound };
export { preflightCache, PreflightCache };
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `pnpm jest tests/unit/inscription-preflight-orchestration.test.ts 2>&1 | tail -10`

Expected: `Tests: 10 passed, 10 total`. If the tip-height fetch test fails, the orchestration may not be mocking it properly — check that `setupTipHeightFetch()` is being called before each indexer call sequence in the test, and that `fetch` is reset between tests.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/inscription-preflight/index.ts tests/unit/inscription-preflight-orchestration.test.ts
git commit -m "feat(preflight): orchestration with fallback chain + TTL-aware caching

Ordinals.com primary, ordinalswallet fallback. BTC tip height fetched from
mempool.space for confirmation math. Cache TTLs:
  - >=6 conf: Infinity
  - 0..5 conf: 30s
  - not_found: 30s
  - all_unreachable: 5s

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: API route handler

**Files:**
- Create: `src/app/api/inscription/preflight/route.ts`
- Create: `tests/unit/inscription-preflight-route.test.ts`

- [ ] **Step 5.1: Write the failing test**

Create `tests/unit/inscription-preflight-route.test.ts`:

```ts
import { GET } from '@/app/api/inscription/preflight/route';
import { __resetCacheForTests } from '@/lib/inscription-preflight';
import { NextRequest } from 'next/server';

const VALID_ID = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';

const fetchMock = global.fetch as jest.Mock;

function setupMinimalSuccessFlow() {
  // tip height
  fetchMock.mockResolvedValueOnce({
    ok: true, status: 200, headers: new Headers(),
    text: async () => '875440',
  });
  // ordinals metadata
  fetchMock.mockResolvedValueOnce({
    ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({
      id: VALID_ID,
      sat: 425639728,
      rarity: 'uncommon',
      genesis_height: 875432,
      genesis_block_time: 1764732009,
      content_type: 'image/png',
      content_length: 3,
      cursed: false,
    }),
  });
  // ordinals content
  fetchMock.mockResolvedValueOnce({
    ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-length': '3' }),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
}

describe('GET /api/inscription/preflight', () => {
  beforeEach(() => {
    __resetCacheForTests();
    fetchMock.mockReset();
  });

  it('returns 400 on missing id param', async () => {
    const req = new NextRequest('http://localhost/api/inscription/preflight');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 on invalid id format', async () => {
    const req = new NextRequest('http://localhost/api/inscription/preflight?id=not-real');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 200 with success response on valid id', async () => {
    setupMinimalSuccessFlow();
    const req = new NextRequest(`http://localhost/api/inscription/preflight?id=${VALID_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
    expect(body.inscriptionId).toBe(VALID_ID);
    expect(body.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes uppercase ID to lowercase in response', async () => {
    setupMinimalSuccessFlow();
    const upper = VALID_ID.toUpperCase();
    const req = new NextRequest(`http://localhost/api/inscription/preflight?id=${upper}`);
    const res = await GET(req);
    const body = await res.json();
    expect(body.inscriptionId).toBe(VALID_ID);
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `pnpm jest tests/unit/inscription-preflight-route.test.ts 2>&1 | tail -10`

Expected: `Cannot find module '@/app/api/inscription/preflight/route'`.

- [ ] **Step 5.3: Write the route handler**

Create `src/app/api/inscription/preflight/route.ts`:

```ts
/**
 * API Route: GET /api/inscription/preflight?id=<inscriptionId>
 *
 * Bitcoin-side pre-flight check for the KILN burn flow.
 * See: docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md
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
    const start = Date.now();
    const response = await preflight(id);
    const ms = Date.now() - start;
    const resultLabel = response.exists
      ? `exists`
      : response.reason;
    const indexerLabel = response.exists ? response.indexerUsed : 'none';
    const cachedLabel = response.exists ? response.cached : false;
    console.log(`[preflight] id=${id} result=${resultLabel} indexer=${indexerLabel} ms=${ms} cached=${cachedLabel}`);
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    if (/invalid inscription id format/i.test(message)) {
      return NextResponse.json({ error: 'invalid inscription id format' }, { status: 400 });
    }
    console.error('[preflight] unexpected error:', err);
    return NextResponse.json({ error: 'preflight failed' }, { status: 500 });
  }
}
```

- [ ] **Step 5.4: Run test to verify it passes**

Run: `pnpm jest tests/unit/inscription-preflight-route.test.ts 2>&1 | tail -10`

Expected: `Tests: 4 passed, 4 total`.

- [ ] **Step 5.5: Run all preflight tests together**

Run: `pnpm jest tests/unit/inscription-preflight 2>&1 | tail -10`

Expected: `Tests: 30 passed, 30 total` (7 cache + 9 indexers + 10 orchestration + 4 route).

- [ ] **Step 5.6: Smoke test the live endpoint**

Run the dev server in another terminal: `pnpm dev`

Then in this terminal:

```bash
curl -s "http://localhost:3000/api/inscription/preflight?id=6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0" | head -50
```

Expected: JSON response with `"exists": true` and inscription metadata.

```bash
curl -s "http://localhost:3000/api/inscription/preflight?id=0000000000000000000000000000000000000000000000000000000000000000i999999" | head -10
```

Expected: JSON response with `"exists": false, "reason": "not_found"`.

```bash
curl -s -i "http://localhost:3000/api/inscription/preflight?id=garbage" | head -5
```

Expected: `HTTP/1.1 400` with `{"error":"invalid inscription id format"}`.

- [ ] **Step 5.7: Commit**

```bash
git add src/app/api/inscription/preflight/route.ts tests/unit/inscription-preflight-route.test.ts
git commit -m "feat(preflight): /api/inscription/preflight route handler

Validates input, calls preflight orchestration, normalizes errors.
maxDuration=20s covers worst-case timeout cascade. Logs one-liner per
call for grep-style monitoring.

Closes PR 2 of the pre-burn inscription check work (see spec
docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

This concludes PR 2 (server-side preflight). The next three tasks are PR 3 (wizard integration).

---

## Task 6: Client hook — useInscriptionPreflight

**Files:**
- Create: `src/lib/hooks/useInscriptionPreflight.ts`

No hook unit tests in this plan — React Testing Library isn't installed, and the hook is small enough that the wizard's manual test plan covers it. Adding RTL is its own setup task that's out of scope.

- [ ] **Step 6.1: Write the hook**

Create `src/lib/hooks/useInscriptionPreflight.ts`:

```ts
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

  const refetch = useCallback(() => {
    if (lastIdRef.current) void doFetch(lastIdRef.current);
  }, [doFetch]);

  return { state, result, error, refetch };
}
```

- [ ] **Step 6.2: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "src/lib/hooks" | head -5`

Expected: no output.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/hooks/useInscriptionPreflight.ts
git commit -m "feat(preflight): useInscriptionPreflight hook

Debounced 500ms, aborts in-flight on input change, stale-while-revalidate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: ContentRenderer component

**Files:**
- Create: `src/components/preflight/ContentRenderer.tsx`

- [ ] **Step 7.1: Write the component**

Create `src/components/preflight/ContentRenderer.tsx`:

```tsx
'use client';

import { FC } from 'react';

interface ContentRendererProps {
  contentType: string;
  contentUrl: string;
  contentLength: number;
  inscriptionId: string;
}

const MAX_TEXT_PREVIEW_BYTES = 4 * 1024;

/**
 * Renders inscription content by content-type.
 * - image/*: <img>
 * - text/* and application/json: <pre> (fetched client-side, truncated to 4 KB)
 * - text/html: sandboxed <iframe>
 * - everything else: download link
 */
export const ContentRenderer: FC<ContentRendererProps> = ({
  contentType,
  contentUrl,
  contentLength,
  inscriptionId,
}) => {
  const externalUrl = `https://ordinals.com/inscription/${inscriptionId}`;

  if (contentType.startsWith('image/')) {
    return (
      <img
        src={contentUrl}
        alt={`Inscription ${inscriptionId}`}
        style={{ maxWidth: 256, maxHeight: 256, objectFit: 'contain', display: 'block' }}
      />
    );
  }

  if (contentType === 'text/html') {
    return (
      <div>
        <iframe
          src={contentUrl}
          sandbox=""
          style={{ width: '100%', height: 256, border: '1px solid currentColor' }}
          title={`Inscription ${inscriptionId}`}
        />
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
          HTML inscription — preview disabled for safety.{' '}
          <a href={externalUrl} target="_blank" rel="noopener noreferrer">
            Open externally →
          </a>
        </div>
      </div>
    );
  }

  if (contentType.startsWith('text/') || contentType === 'application/json') {
    return <TextPreview contentUrl={contentUrl} />;
  }

  if (contentType.startsWith('video/')) {
    return (
      <video controls preload="metadata" style={{ maxWidth: 256, maxHeight: 256 }}>
        <source src={contentUrl} type={contentType} />
      </video>
    );
  }

  if (contentType.startsWith('audio/')) {
    return <audio controls preload="metadata" src={contentUrl} />;
  }

  return (
    <div style={{ fontSize: 12, opacity: 0.8 }}>
      <div>{contentType}</div>
      <div>{contentLength.toLocaleString()} bytes</div>
      <a href={contentUrl} target="_blank" rel="noopener noreferrer" download>
        Download →
      </a>
    </div>
  );
};

const TextPreview: FC<{ contentUrl: string }> = ({ contentUrl }) => {
  // We rely on browser caching here; the content URL is already proxied to a public indexer.
  // For now, embed via <object> with text fallback or use a small fetch on mount.
  // Simplest reliable approach: <iframe> sandboxed (text/plain renders inline).
  return (
    <iframe
      src={contentUrl}
      sandbox=""
      style={{ width: '100%', height: 256, border: '1px solid currentColor', background: 'transparent' }}
      title="inscription text preview"
    />
  );
};
```

- [ ] **Step 7.2: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "src/components/preflight" | head -5`

Expected: no output.

- [ ] **Step 7.3: Commit**

```bash
git add src/components/preflight/ContentRenderer.tsx
git commit -m "feat(preflight): ContentRenderer by content-type

image/* via <img>, text/html via sandboxed <iframe>, text/* and JSON
via sandboxed iframe, video/audio with native controls, fallback to
download link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: OverrideControls component

**Files:**
- Create: `src/components/preflight/OverrideControls.tsx`

- [ ] **Step 8.1: Write the component**

Create `src/components/preflight/OverrideControls.tsx`:

```tsx
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
```

- [ ] **Step 8.2: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "src/components/preflight" | head -5`

Expected: no output.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/preflight/OverrideControls.tsx
git commit -m "feat(preflight): OverrideControls (none/checkbox/typed-word)

Emits acknowledged: boolean as the user interacts. Parent owns the
visible action gating.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: InscriptionStatusRow component (compact)

**Files:**
- Create: `src/components/preflight/InscriptionStatusRow.tsx`

- [ ] **Step 9.1: Write the component**

Create `src/components/preflight/InscriptionStatusRow.tsx`:

```tsx
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
```

- [ ] **Step 9.2: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "src/components/preflight" | head -5`

Expected: no output.

- [ ] **Step 9.3: Commit**

```bash
git add src/components/preflight/InscriptionStatusRow.tsx
git commit -m "feat(preflight): InscriptionStatusRow compact status display

One-line status under the ID input with three visual tiers (green / yellow / red).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: InscriptionPanel component (full)

**Files:**
- Create: `src/components/preflight/InscriptionPanel.tsx`

- [ ] **Step 10.1: Write the component**

Create `src/components/preflight/InscriptionPanel.tsx`:

```tsx
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
          {error ?? 'Both ordinals.com and ordinalswallet were unreachable. The inscription may still be valid; we just can\'t verify right now.'}
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
          Both ordinals.com and ordinalswallet returned 404. Check the ID for typos
          or wrong index (most commonly <code>i0</code> vs <code>i1</code>).
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
            <Field label="SHA-256" value={<span style={{ opacity: 0.6 }}>(too large to hash)</span>} />
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
```

- [ ] **Step 10.2: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "src/components/preflight/InscriptionPanel" | head -5`

Expected: no output.

- [ ] **Step 10.3: Commit**

```bash
git add src/components/preflight/InscriptionPanel.tsx
git commit -m "feat(preflight): InscriptionPanel full preview with override

Renders content + metadata + SHA-256 + override widget scaled to risk
severity. Emits acknowledged state up to parent for proceed-gating.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Wire TeleburnForm — compact status row + gate Submit

**Files:**
- Modify: `src/components/teleburn/TeleburnForm.tsx`

The form already validates the inscription-ID regex synchronously. This task adds an async pre-flight check on top: as soon as the user types a valid-looking ID, fire the preflight (debounced inside the hook) and show the status row. Disable the Submit button if the preflight indicates `not_found` (typo).

- [ ] **Step 11.1: Read the form to identify the inscription-ID input section**

Run: `pnpm exec grep -n "inscriptionId\|handleSubmit\|isFormValid\|form-submit" src/components/teleburn/TeleburnForm.tsx | head -20`

Note the line range around `<label htmlFor="inscriptionId">` and the submit button. You'll insert the status row directly under the inscription input, and gate the submit button on the preflight result.

- [ ] **Step 11.2: Add the preflight integration**

Edit `src/components/teleburn/TeleburnForm.tsx`. At the top of the file, add the import:

```ts
import { useInscriptionPreflight } from '@/lib/hooks/useInscriptionPreflight';
import { InscriptionStatusRow } from '@/components/preflight/InscriptionStatusRow';
```

Inside the component function (after the existing `useState` calls for formData/errors/touched), add:

```ts
const preflight = useInscriptionPreflight(formData.inscriptionId || null);
const preflightBlocksSubmit =
  preflight.state === 'success' &&
  preflight.result !== null &&
  !preflight.result.exists &&
  preflight.result.reason === 'not_found';
```

In the JSX, directly under the existing inscription-ID input's error display (`{touched.inscriptionId && errors.inscriptionId && (...)}`), add:

```tsx
{touched.inscriptionId && !errors.inscriptionId && (
  <InscriptionStatusRow
    state={preflight.state}
    result={preflight.result}
    error={preflight.error}
  />
)}
```

Find the form's submit button (search for `type="submit"` or the submit handler). Disable it when `preflightBlocksSubmit` is true:

```tsx
<button
  type="submit"
  disabled={!isFormValid /* existing check */ || preflightBlocksSubmit}
  // ... rest of props
>
  // ... button content
</button>
```

Add a small note next to the disabled state when blocked:

```tsx
{preflightBlocksSubmit && (
  <div style={{ fontSize: 12, color: '#c0392b', marginTop: 4 }}>
    Inscription not found on Bitcoin — fix the ID before continuing.
  </div>
)}
```

- [ ] **Step 11.3: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "TeleburnForm" | head -5`

Expected: no output.

- [ ] **Step 11.4: Manual smoke**

Start dev server: `pnpm dev`

In browser:
1. Connect wallet at `/teleburn`
2. Enter a real mint address
3. Paste valid known-good inscription ID `6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0` → expect green status row "Inscription confirmed · N conf · image/png · KB"
4. Paste typo `6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i999` (changed `i0` → `i999`) → expect red row "Not found on Bitcoin"; expect Submit button disabled
5. Replace with valid ID again → Submit re-enables

- [ ] **Step 11.5: Commit**

```bash
git add src/components/teleburn/TeleburnForm.tsx
git commit -m "feat(preflight): wire status row + submit gating into TeleburnForm

Debounced preflight check fires as user types the inscription ID.
Submit button disabled when preflight returns not_found.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Wire Step3Preview — full panel + override + proceed gate

**Files:**
- Modify: `src/components/wizard/Step3Preview.tsx`

The current Step3Preview renders the simulation result and an unconditional "PROCEED TO EXECUTION →" button. This task inserts the `InscriptionPanel` above the simulation results and gates the proceed button on both the simulation success AND the inscription override acknowledgement.

- [ ] **Step 12.1: Add imports and state at top of component**

Edit `src/components/wizard/Step3Preview.tsx`. At the top of the file (with the other imports):

```ts
import { useInscriptionPreflight } from '@/lib/hooks/useInscriptionPreflight';
import { InscriptionPanel } from '@/components/preflight/InscriptionPanel';
```

Inside `Step3Preview` component (with the other `useState` calls):

```ts
const preflight = useInscriptionPreflight(formData.inscriptionId);
const [inscriptionAcknowledged, setInscriptionAcknowledged] = useState(false);
```

- [ ] **Step 12.2: Render the panel above the simulation results**

Find the section that renders the report (`{report && (...)}`). Insert the panel above the `<DryRunPreview ... />` line:

```tsx
{report && (
  <>
    <InscriptionPanel
      state={preflight.state}
      result={preflight.result}
      error={preflight.error}
      onAcknowledgedChange={setInscriptionAcknowledged}
      onRetry={preflight.refetch}
    />

    <DryRunPreview
      report={report}
      onDownloadReceipt={handleDownloadReceipt}
    />
    {/* existing proceed/back buttons below */}
  </>
)}
```

- [ ] **Step 12.3: Gate the proceed button**

Find the existing proceed button (search for `PROCEED TO EXECUTION`). Update its disabled prop and click guard:

```tsx
{report.success ? (
  <button
    onClick={onComplete}
    disabled={!inscriptionAcknowledged}
    className="terminal-button px-8 py-3"
    style={{ opacity: inscriptionAcknowledged ? 1 : 0.5, cursor: inscriptionAcknowledged ? 'pointer' : 'not-allowed' }}
    title={inscriptionAcknowledged ? '' : 'Complete the inscription pre-flight before proceeding'}
  >
    ⚡ PROCEED TO EXECUTION →
  </button>
) : (
  // ... existing error branch unchanged
)}
```

Note: when the inscription is `confirmations >= 6`, the `InscriptionPanel` auto-acknowledges via `useNotifyAck`, so `inscriptionAcknowledged` flips to `true` automatically — the user doesn't see any extra friction in the happy path.

- [ ] **Step 12.4: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "Step3Preview" | head -5`

Expected: no output.

- [ ] **Step 12.5: Manual smoke**

Start dev server: `pnpm dev`

1. Connect wallet, enter a valid mint + good inscription ID, advance to Step 3
2. Expect: simulation runs, InscriptionPanel renders above with green ≥6-conf status, image preview visible, "PROCEED TO EXECUTION" button is enabled (auto-acknowledged)
3. Go back, change inscription ID to a recent-mempool inscription (or simulate by editing the URL bar with `&conf=0`)
4. Expect: Panel shows mempool warning, PROCEED disabled until you type `MEMPOOL` in the confirmation input
5. Type `MEMPOOL` → PROCEED enables
6. Go back, change to a typo'd ID → Submit on form re-disabled before reaching Step 3 (the form-level gate from Task 11 catches this)

- [ ] **Step 12.6: Commit**

```bash
git add src/components/wizard/Step3Preview.tsx
git commit -m "feat(preflight): wire InscriptionPanel + override into Step3Preview

Renders the full inscription preview above the simulation results.
'Proceed to Execution' button gated on inscriptionAcknowledged, which
auto-toggles true when conf >= 6 (happy path is friction-free).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Manual test plan execution

**Files:** none (verification only)

Run through the manual test plan from the spec (§8.4). Document any deviations from expected behavior.

- [ ] **Step 13.1: Start dev server**

Run: `pnpm dev`

Wait for `Local: http://localhost:3000` line.

- [ ] **Step 13.2: M1 — Known-good inscription**

Visit `/teleburn`, connect wallet. Paste mint + inscription `6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0` → green status, ≥6 conf, image renders.

- [ ] **Step 13.3: M2 — Confirmed non-existent**

Paste `0000000000000000000000000000000000000000000000000000000000000000i999999` → red row, Submit disabled.

- [ ] **Step 13.4: M3 — Recently-inscribed**

Find a very-recent mainnet inscription (search ordinals.com for one inscribed in the last hour). Paste → orange/yellow row depending on confirmation count. Form-level Submit allowed (only `not_found` blocks at form level). In Step 3, override widget appears.

- [ ] **Step 13.5: M4 — Cache hammer**

Open browser DevTools Network tab. Paste a valid inscription, observe one preflight call. Re-paste the same ID, navigate away and back: only one preflight network call (cached on the server). Then `curl -s http://localhost:3000/api/inscription/preflight?id=<id>` 50 times in a tight loop and check Vercel/local logs — only the first call shows a network hit to ordinals.com; the rest log `cached=true`.

- [ ] **Step 13.6: M5 — Recursive HTML inscription**

Find a known recursive HTML inscription (search ordinals.com for `content_type=text/html` inscriptions). Paste → in Step 3, sandboxed iframe renders + "Open externally →" link visible.

- [ ] **Step 13.7: M6 — Very large inscription**

Find an inscription >5 MB (search for video inscriptions or large image inscriptions). Paste → in Step 3, metadata renders, SHA-256 row shows "(too large to hash)", content still renders via direct URL.

- [ ] **Step 13.8: M7 — Network failure**

Open DevTools → Network → throttle to "Offline". Paste valid ID → expect yellow `all_unreachable` row, Submit allowed at form level (network outages are soft-block), Step 3 shows retry button + override checkbox.

- [ ] **Step 13.9: M8 — Mixed-case ID**

Paste valid ID with uppercase characters, e.g. `6FB976AB...I0`. Status row should treat it as same as lowercase. Server logs should show the normalized lowercase ID.

- [ ] **Step 13.10: Document any failures**

If any test deviates from expected behavior, write the deviation into a follow-up issue or update the implementation before merging.

---

## Task 14: Delete orphaned InscriptionVerificationStep

**Files:**
- Delete: `src/components/wizard/InscriptionVerificationStep.tsx`

The new preflight panel replaces the v0.x verification step. The old component still exists in the repo but is no longer imported by any other file in `src/`.

- [ ] **Step 14.1: Confirm no remaining importers**

Run: `pnpm exec grep -rn "InscriptionVerificationStep" src 2>&1 | grep -v "InscriptionVerificationStep.tsx"`

Expected: no output. If anything turns up, do NOT delete the file — investigate the importer.

- [ ] **Step 14.2: Delete the file**

```bash
rm src/components/wizard/InscriptionVerificationStep.tsx
```

- [ ] **Step 14.3: Verify build still works**

Run: `pnpm build 2>&1 | tail -10`

Expected: build succeeds with no errors about missing modules.

- [ ] **Step 14.4: Commit**

```bash
git add -u src/components/wizard/InscriptionVerificationStep.tsx
git commit -m "chore: remove orphaned v0.x InscriptionVerificationStep

Replaced by src/components/preflight/InscriptionPanel which handles
the v1.0 protocol (no expected SHA-256 required, content equivalence
is informational not gating).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Final.1: All tests pass**

Run: `pnpm jest tests/unit/inscription-preflight 2>&1 | tail -5`

Expected: `Tests: 30 passed, 30 total`.

- [ ] **Final.2: TypeScript clean**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "^src/" | head -5`

Expected: no output.

- [ ] **Final.3: Production build**

Run: `pnpm build 2>&1 | tail -20`

Expected: build succeeds, route list includes `/api/inscription/preflight`.

- [ ] **Final.4: Verify on Vercel after push** (if deploying)

Push and watch the Vercel deployment status. Smoke-test the production `/api/inscription/preflight?id=<known-good>` URL once it deploys.

---

## Notes for the executor

- **Worktrees**: The user's established workflow is committing directly to `main` (see recent commits). If you prefer a worktree, create one with `git worktree add ../kiln-preflight -b feat/inscription-preflight`. Otherwise, working on `main` is fine — split into the three PRs the spec calls out (Phase 0 / Phases 1-5 / Phases 6-14) by pushing intermediate branches if PR review is wanted.
- **Endpoint paths**: Task 3.1 has you verify the live ordinals.com / ordinalswallet JSON field names. **Do this first.** The test fixtures are best-effort; field names sometimes differ from what the live API returns.
- **The `burned` flag** is best-effort. If neither indexer reliably surfaces it, leave the `burned: boolean` field in the type but document that it's always `false` in MVP. The spec's gate matrix treats `burned: true` as info-only anyway.
- **No new runtime dependencies** are introduced. If you find yourself reaching for an HTTP client, just use `fetch`. If you find yourself reaching for an LRU cache library, just use the `Map`-based one in this plan.
- **Don't refactor `inscription-verifier.ts` or `inscription-resilience.ts`** in this plan. The v0.x verifier and the new preflight have different shapes; consolidating them is a future cleanup spec.
- **If a step's expected output differs from what you see**, STOP. Investigate. Don't paper over it. The most common cause is the indexer API returning a slightly different JSON shape than the test mocks assumed — fix both together.
- **Deferred from this plan**: the spec mentions an optional "Compare with NFT image" side-by-side toggle in the panel (spec §5.5). This is intentionally NOT in this plan — it requires the Solana NFT image fetch + cross-source SHA-256 comparison, which is the same component the `/verify` content-equivalence panel needs (parent proposal §2.3). Building it once, in the next sub-spec, avoids duplication. The current panel surfaces the inscription's SHA-256; users can still cross-check manually.
