# Pre-Burn Inscription Check — Design Spec

| | |
|---|---|
| Spec | `2026-05-17-pre-burn-inscription-check-design.md` |
| Date | 2026-05-17 |
| Owner | fevra-dev |
| Sub-spec of | `public/docs/KILN_PROTOCOL_ENHANCEMENT_PROPOSAL.md` §2.1 |
| Status | Draft, pending implementation plan |
| Estimated effort | 2 days (1 PR for route + tests, 1 PR for wizard integration) |

> **Updated 2026-05-18 (in-flight):** Hiro's public Ordinals API (`api.hiro.so/ordinals/v1`) was discovered to be deprecated (HTTP 410 Gone) mid-implementation. The fallback indexer was swapped to `turbo.ordinalswallet.com`. Note that ordinalswallet has no public content endpoint, so the fallback path returns `contentSha256: null`; content URLs still point to ordinals.com for client rendering. See commit `511e2d6` on `feat/inscription-preflight`.

---

## 1. Problem statement

Today the KILN wizard accepts any 64-hex + `i` + digit string as an inscription ID and proceeds with the burn. If the inscription doesn't exist on Bitcoin — typo, wrong index, phishing source, or just-broadcast-but-not-yet-confirmed and dropped from mempool — the NFT is permanently destroyed and the on-chain memo points to nothing. There is no recovery. This is the only failure mode in the v1.0 protocol that produces *silent, irreversible* data loss for a normal user, and it is the single highest-leverage safety improvement we can make.

## 2. Decision summary

- **Indexer source**: public-only — `ordinals.com` primary, `ordinalswallet` fallback. No self-hosted ord dependency.
- **Gate posture**: balanced — hard block on confirmed-404 (both indexers), soft override on `<6` confirmations, hard green at `≥6` confirmations.
- **Surface depth**: rich preview — content render (image/text/HTML via sandbox), metadata, content SHA-256, sat number, content URL.
- **Architecture**: server-proxied Next.js route `/api/inscription/preflight` with in-memory LRU cache; client `useInscriptionPreflight` hook; preview component reused in Step 2 (compact status row) and Step 3 (full panel).
- **Rollout**: no feature flag; ship on for everyone; deploy in two PRs (route + integration).

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│  Wizard Step 2 (ID input)  ┐                │
│  Wizard Step 3 (Preview)   ├── usePreflight │
│  /verify page (later)      ┘    (hook)      │
└──────────────────────┬──────────────────────┘
                       │ GET /api/inscription/preflight?id=…
                       ▼
┌─────────────────────────────────────────────┐
│  Next.js route handler                      │
│   1. Validate id (regex)                    │
│   2. Cache lookup (in-memory Map, LRU)      │
│   3. Indexer chain:                         │
│        ordinals.com  → 200 / 404 / timeout  │
│        ordinalswallet → 200 / 404 / timeout │
│   4. Fetch /content/<id> for SHA-256        │
│   5. Normalize → cache → respond            │
└─────────────────────────────────────────────┘
```

One new route file, one client hook, one preview component, one cache utility. No new dependencies beyond what's already in `package.json`.

## 4. API contract

### 4.1 Request

```
GET /api/inscription/preflight?id=<inscriptionId>
```

- `id` MUST match `^[a-f0-9]{64}i[0-9]+$` (matches spec §3.1.2)
- Server normalizes case (`id.toLowerCase()`) before lookup — also satisfies §2.4 of the parent proposal (lowercase input) as a side effect
- Invalid format → `400 { error: "invalid inscription id format" }`
- Missing param → `400 { error: "missing id param" }`

### 4.2 Response

Discriminated union by `exists`. Always returns HTTP 200 unless the request itself was malformed (400). "Inscription does not exist" is a successful result, not a server error.

```ts
type PreflightResponse =
  | {
      exists: true;
      inscriptionId: string;            // lowercased, normalized
      confirmations: number;             // 0 if mempool-only
      genesisBlockHeight: number | null; // null if mempool
      genesisTimestamp: number | null;   // unix-seconds
      contentType: string;               // e.g. "image/png"
      contentLength: number;             // bytes
      contentSha256: string | null;      // hex, 64 chars; null if content > size cap
      contentUrl: string;                // for client rendering (proxied)
      sat: number;                       // ordinal sat number
      satRarity:
        | 'common' | 'uncommon' | 'rare'
        | 'epic' | 'legendary' | 'mythic';
      cursed: boolean;                    // ord pre-jubilee curse flag
      burned: boolean;                    // inscription is on a Bitcoin-burned output
      indexerUsed: 'ordinals.com' | 'ordinalswallet';
      cached: boolean;
      checkedAt: number;                  // unix-ms
    }
  | {
      exists: false;
      inscriptionId: string;
      reason: 'not_found' | 'all_unreachable';
      indexersChecked: Array<{
        name: 'ordinals.com' | 'ordinalswallet';
        status: 'not_found' | 'timeout' | 'error' | 'rate_limited';
        httpStatus?: number;
      }>;
      checkedAt: number;
    };
```

**`reason` distinction**: `not_found` (both indexers said 404) is a *hard block*. `all_unreachable` (network errors, timeouts, rate limits) is a *soft block with override* — the user may know their inscription exists; we just couldn't verify right now.

**Content size cap**: hardcoded module-level constant `MAX_HASHABLE_BYTES = 5 * 1024 * 1024` in the route file (revisit if a future spec needs runtime tuning). Above this, server returns `contentSha256: null` but still populates `contentLength`, `contentType`, `contentUrl`. Client UI degrades gracefully (no hash row in panel, no SHA-256 comparison).

### 4.3 Caching

| Cache key | Cache value | TTL |
|---|---|---|
| Inscription ID (lowercased) | `exists:true, confirmations ≥ 6` | **Indefinite** (Bitcoin reorgs >6 blocks deep are functionally impossible) |
| Inscription ID (lowercased) | `exists:true, confirmations < 6` | 30s |
| Inscription ID (lowercased) | `exists:false, reason:'not_found'` | 30s |
| Inscription ID (lowercased) | `exists:false, reason:'all_unreachable'` | 5s (network blips, retry quickly) |
| — | 5xx / malformed responses | **Never cached** |

Implementation: in-memory `Map<string, { response: PreflightResponse; expiresAt: number }>`, LRU eviction at ~10k entries. Per-instance only (Vercel serverless); no cross-instance sharing in MVP. Swap to Upstash Redis later via a 1-file change if needed.

Exported `__resetCache()` for tests.

### 4.4 Indexer fallback chain

| Step | URL | Purpose | Timeout |
|---|---|---|---|
| 1 | `GET https://ordinals.com/r/inscription/<id>` | Metadata (JSON) | 5s |
| 2 | `GET https://ordinals.com/content/<id>` | Content body for SHA-256 | 5s |
| 3 (fallback) | `GET https://turbo.ordinalswallet.com/inscription/<id>` | Metadata (JSON) | 5s |
| 4 (fallback) | *(no content endpoint)* | ordinalswallet has no public content endpoint; `contentSha256: null` for this path | — |

**Fallback triggers** (for the metadata fetch): HTTP 404, HTTP 5xx, network error, timeout, malformed JSON. If primary returns 200, skip fallback.

**Content fetch**: only attempted if metadata fetch succeeded. Uses the same indexer that served the metadata (no cross-indexer mix). Content fetch failure does *not* fail the whole preflight — the response is returned with `contentSha256: null` and a server log line noting the partial result.

**Total time budget**: worst case ~10s when both indexers time out in sequence (ordinals metadata 5s + ordinals content 5s + ordinalswallet metadata 5s — ordinalswallet has no content endpoint so no third timeout). In practice well under 1s for cached results and 1–3s for cache misses with healthy indexers. Set the Next.js route handler's `maxDuration` to `20` to give margin above the timeout-cascade worst case.

**Exact endpoint paths to verify during implementation against:**
- `docs.ordinals.com/guides/api.html`
- `turbo.ordinalswallet.com/inscription/<id>` (live endpoint, no published docs)
- `github.com/ordinals/ord`

The abstract contract above is what the spec commits to; specific URL fragments above are best-effort and the implementation step verifies them against current indexer docs.

## 5. Wizard integration

### 5.1 Firing points

| Step | Trigger | Behavior |
|---|---|---|
| Step 2 — Inscription ID input | `onChange` debounced 500ms; also on `onPaste` | Background fetch; compact status row inline; **Next disabled** until result lands |
| Step 3 — Preview | On mount (cache hit usually instant) | Full inscription panel alongside simulation; **Sign disabled** based on gate matrix below |
| `/verify` page | Later spec | Same hook, same data, different consumer component |

### 5.2 Hook contract

```ts
// src/lib/hooks/useInscriptionPreflight.ts
function useInscriptionPreflight(inscriptionId: string | null): {
  state: 'idle' | 'loading' | 'success' | 'error';
  result: PreflightResponse | null;
  error: string | null;
  refetch: () => void;
}
```

- Pass `null` to disable
- Internally: 500ms debounce, AbortController on rapid input change, stale-while-revalidate (show cached prior result while fetching fresh data on input flip-flop)
- No business logic in the hook — wizard consumes `result` and decides what to render and what to gate

### 5.3 Gate matrix

| Preflight result | Step 2 visual | Step 2 Next button | Step 3 banner | Step 3 Sign button |
|---|---|---|---|---|
| `state: 'loading'` | Spinner inline | Disabled | Skeleton in panel | Disabled |
| `success`, `confirmations >= 6`, not burned | ✅ Green status row | Enabled | No banner | Enabled |
| `success`, `1 <= confirmations < 6` | ⚠️ Yellow row "Recently inscribed, N confirmations — reorg-vulnerable" | Enabled | Yellow banner | Disabled until **"I understand reorg risk" checkbox** ticked |
| `success`, `confirmations == 0` (mempool) | ⚠️ Orange row "Not yet confirmed by Bitcoin — burning now risks loss" | Enabled | Orange banner | Disabled until user **types `MEMPOOL` in confirmation input** |
| `success`, `burned: true` | ℹ️ Info badge "Bitcoin inscription has been burned" (display only) | Enabled | Info banner | Enabled (this is a user choice, not a safety issue) |
| `success`, `cursed: true` | ℹ️ Info badge "Cursed inscription (pre-jubilee)" (display only) | Enabled | Info banner | Enabled |
| `exists: false`, `reason: 'not_found'` | ❌ Red row "Inscription not found on Bitcoin. Check ID for typos." | **Disabled** | Red panel, no Sign path | N/A — wizard can't reach Step 3 |
| `exists: false`, `reason: 'all_unreachable'` | ⚠️ Yellow row "Couldn't reach Bitcoin indexers" + Retry | Enabled | Yellow banner | Disabled until **"I have independently verified this inscription exists" checkbox** ticked |
| `state: 'error'` (transport / 5xx) | ⚠️ Yellow row + Retry | **Disabled until success or override** | Yellow banner | Disabled |

**Override mechanics — escalating commitment:**

1. **No override** for `≥6 conf` (no warning to override) and `not_found` (cannot override; ID is wrong, period).
2. **Checkbox override** for `1–5 conf` and `all_unreachable`. Single click, label is verbose.
3. **Typed-word override** for mempool-only (`conf == 0`). User must type `MEMPOOL` (case-sensitive) into an input field. This is the strongest non-modal commitment a wizard can extract; signals the user has read what they're consenting to.

**Override scoping**: per-inscription-ID, per-session, in-memory. Changing the inscription ID resets all overrides. Refreshing the page resets all overrides. No `localStorage` persistence; no power-user "skip all checks" toggle.

### 5.4 Step 3 preview panel — content rendering

| `content-type` prefix | Render strategy |
|---|---|
| `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif` | `<img src={contentUrl}>` direct, max 256×256 in panel, click-to-expand modal |
| `image/svg+xml` | `<img>` (the SVG-via-`<img>` rendering context blocks script execution and event handlers — no extra CSP rules needed; the browser refuses to run scripts in image contexts) |
| `text/plain`, `text/markdown` | `<pre>`, first 4 KB, "show more" if truncated |
| `text/html` | **Sandboxed `<iframe sandbox>` (no `allow-scripts`, no `allow-same-origin`)** + warning badge "HTML inscription — preview limited for safety" + external link button to `https://ordinals.com/inscription/<id>` |
| `application/json` | `<pre>` pretty-printed JSON, first 4 KB |
| `video/*` | `<video controls preload="metadata">`, lazy-loaded; file-size warning if `>5 MB` |
| `audio/*` | `<audio controls preload="metadata">` |
| Anything else | Filename + content-type + file size + a download icon link |

### 5.5 Optional: "Compare with NFT image" toggle

Step 3 has an existing NFT image (Solana metadata via Helius DAS). The preflight panel adds a toggle "Compare with NFT image →" that, when on, renders both side-by-side with their SHA-256s and a "match / no match / unable-to-compare" stamp. **Default off** in MVP (don't distract from the main preview); promote to default-on in a follow-up spec when the `/verify` content-equivalence panel ships, which reuses this same component.

## 6. Edge cases

| Case | Behavior |
|---|---|
| Cursed inscription (negative numbering, pre-jubilee) | `cursed: true`; rendered identically; info badge in panel |
| Pointer-targeted inscription | No special handling; the `sat` field in response is the targeted sat |
| Burned inscription (output already spent/OP_RETURN'd) | `burned: true` if indexer reports it; info badge in panel; **does not gate**, user choice |
| Recursive HTML inscription | Sandboxed iframe rendering; recursive `<img src="/r/…">` references inside iframe will fail safely |
| Content > 5 MB | `contentSha256: null`; panel shows metadata only with note "Content too large to hash in browser" |
| Empty content (length 0) | `contentSha256: 'e3b0c44…'` (hash of empty bytes); panel shows "Empty inscription" |
| Inscription ID with very large index (`i999999`) | Regex permits any non-negative integer; no special handling |
| Multiple inscriptions on the same sat | Out of scope; preflight is keyed by inscription ID, not sat |

## 7. Error handling

| Situation | Server behavior | Client visible state |
|---|---|---|
| Both indexers 404 | `exists:false, reason:'not_found'` (HTTP 200) | Red — hard block |
| Both indexers timeout (>5s) | `exists:false, reason:'all_unreachable'` | Yellow — soft override |
| Primary 429 (rate limit) | Skip to secondary immediately; if secondary also 429, `all_unreachable` with `status:'rate_limited'` | Yellow — "Retry in a few seconds" |
| Primary 5xx | Try secondary | Same as 429 |
| Indexer 200 + malformed JSON | Treat as error for that indexer, fall back | Same as 5xx |
| Inscription ID regex mismatch | HTTP 400 | Inline form error in Step 2; never reaches network |
| Content fetch fails but metadata succeeded | Response with `contentSha256: null` | Panel shows metadata-only; no error to user |
| Server bug (unhandled throw) | HTTP 500 `{ error: "preflight failed" }`; `console.error` for Vercel logs | Yellow with retry button |

**Cache poisoning prevention**: never cache 5xx, never cache malformed JSON. Cache `not_found` for 30s only. Cache `all_unreachable` for 5s only.

**Logging**: one `console.log` line per preflight, format:

```
[preflight] id=<id> result=<exists|not_found|unreachable> indexer=<which|none> ms=<latency> cached=<bool>
```

Greppable in Vercel logs. Structured logging infra not introduced for this spec.

## 8. Testing

### 8.1 Jest infra prerequisite

The current `jest.config.js` `transformIgnorePatterns` doesn't match pnpm's `.pnpm/<pkg>/` path layout, breaking any test that transitively imports `@solana/web3.js`. This must be fixed before integration tests can run.

Preflight code itself does *not* import Solana — it's pure Bitcoin indexer logic. **Unit tests for this spec can be written and run today** without the jest fix. Integration tests that exercise the wizard flow (which does pull in Solana code) are deferred until the jest fix lands (Appendix A item #2 from the parent proposal).

### 8.2 Unit tests — `tests/unit/inscription-preflight.test.ts`

Mock `fetch` via `jest.fn()` or `msw`. Tests:

1. Valid ID, ordinals.com 200 → response with `exists:true, indexerUsed:'ordinals.com'`
2. Valid ID, ordinals.com 404, ordinalswallet 200 → response with `indexerUsed:'ordinalswallet'`
3. Valid ID, both 404 → `exists:false, reason:'not_found'`
4. Valid ID, ordinals.com timeout, ordinalswallet 200 → response with `indexerUsed:'ordinalswallet'`
5. Valid ID, both timeout → `exists:false, reason:'all_unreachable'`
6. Valid ID, ordinals.com 429, ordinalswallet 200 → response with `indexerUsed:'ordinalswallet'`
7. Valid ID, malformed JSON from primary, secondary 200 → fallback succeeds
8. Invalid ID format → 400
9. Mixed-case ID input → normalized lowercase in response and cache key
10. Repeat call within TTL → cache hit, `cached:true`, no `fetch` invocation
11. Confirmed-≥6 cached indefinitely (advance clock past 30s, still hit)
12. Mempool/<6 cache expires at 30s
13. SHA-256 computation correctness for known content
14. Content size cap: above 5 MB → `contentSha256:null`
15. Cursed/burned flag propagation from indexer metadata

Reset cache between tests via exported `__resetCache()`.

### 8.3 Hook tests — `tests/unit/use-inscription-preflight.test.tsx`

Requires React Testing Library; if jest infra blocks this for the same reason as Solana imports, treat as deferred to post-jest-fix.

1. Debounce: typing rapidly only fires one request after 500ms idle
2. AbortController: rapid input change cancels prior request
3. Stale-while-revalidate: switching ID and back shows previous result while refetching
4. Loading state transitions: `idle → loading → success` / `idle → loading → error`
5. `refetch()` bypasses debounce and triggers immediate refresh

### 8.4 Manual test plan (markdown checklist in the spec, executed pre-deploy)

| # | Test | Expected |
|---|---|---|
| M1 | Paste `6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0` | Green status, ≥6 conf, image preview renders |
| M2 | Paste `0000000000000000000000000000000000000000000000000000000000000000i999999` | Red row, "Inscription not found", Next disabled |
| M3 | Paste a very-recent (just-inscribed) mainnet inscription | Orange row (mempool) or yellow row (1-5 conf), Next enabled with override |
| M4 | Hammer the route 50× tight loop with same ID | First call ~500ms, rest <10ms (cache hit) |
| M5 | Paste known recursive HTML inscription | Sandboxed iframe + external link button visible |
| M6 | Paste known very-large inscription (>5 MB) | Metadata renders, no SHA-256 row, no content render |
| M7 | Disable network during typing, then retype | Yellow row "all_unreachable", Retry button visible |
| M8 | Paste mixed-case ID like `6FB976AB...` | Normalized to lowercase, treats as same cache key |

## 9. Rollout

- **No feature flag.** Safety improvement; ship on for everyone.
- **Backwards compat**: purely additive. Doesn't change the burn transaction, memo format, or on-chain footprint. In-flight burns from tabs opened before deploy are unaffected.
- **Deploy ordering**:
  1. **PR 1**: Land `jest.config.js` `transformIgnorePatterns` fix (Appendix A #2). Required prerequisite for any test to run.
  2. **PR 2**: `/api/inscription/preflight` route + unit tests + content size cap.
  3. **PR 3**: Wizard integration (hook + Step 2 status row + Step 3 panel + override mechanics).
- **Monitoring** (informal, post-launch grep on Vercel logs):
  - Preflight call volume
  - Fallback rate (ordinals.com → ordinalswallet)
  - 404 rate (typo prevalence — interesting product signal)
  - Override usage rate (if very high, warnings are noise; if very low, they're load-bearing)

## 10. Cross-spec leverage

This spec produces three reusable pieces downstream specs will consume directly:

1. **The `/api/inscription/preflight` route** — sub-spec B (pointer-based image preservation, parent proposal §2.2) needs the same metadata to construct the `content/<id>` URL it writes into Solana metadata.
2. **The content-rendering component** — drops into the `/verify` page's content-equivalence panel (parent proposal §2.3) with zero change.
3. **The `contentSha256` in the response** — enables the `content_match` boolean in `/verify` once that ships.

No cross-spec helpers are pre-built. YAGNI for shared abstractions until two specs actually want them.

## 11. Decisions deferred

- **Upstash/KV cache promotion**: stay in-memory until logs show hot inscriptions justifying it. Estimated trigger: >10k unique preflight calls/day with >40% cache miss rate.
- **Indexer config promotion** (env var for ord URL): not needed for kiln.hot; revisit if forks of KILN ask. Easy to add later — single env var, single fallback-chain function.
- **Sat-rarity-based recommendations** ("this is a Pizza-era sat, are you sure?"): out of scope. Surface the rarity in the panel and let the user decide.
- **Pre-flight from `/verify` page**: same route, different consumer. Out of scope for this spec; lands when /verify gets its content-equivalence panel.

## 12. Out of scope (explicitly)

- Any change to the on-chain memo format
- Any change to the burn transaction structure
- Any new Solana RPC calls
- Cross-instance cache sharing
- Webhook-based indexer push notifications
- Automatic retry policy beyond the 5s timeout per indexer

## 13. References

- Parent proposal: `public/docs/KILN_PROTOCOL_ENHANCEMENT_PROPOSAL.md` §2.1
- KILN spec: `public/docs/TELEBURN_SPEC_v1.0.md`
- Ordinals API: https://docs.ordinals.com/guides/api.html
- Ordinals Wallet API: https://turbo.ordinalswallet.com (live endpoint; no published docs)
- Inscription pointer feature: https://docs.ordinals.com/inscriptions/pointer.html
- Inscription burning: https://docs.ordinals.com/inscriptions/burning.html
- ord source: https://github.com/ordinals/ord
