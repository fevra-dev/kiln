# cNFT Burn Path + Asset Detection Foundation — Design Spec

| | |
|---|---|
| Spec | `2026-05-19-cnft-burn-and-asset-foundation-design.md` |
| Date | 2026-05-19 |
| Owner | fevra-dev |
| Sub-spec of | `public/docs/KILN_PROTOCOL_ENHANCEMENT_PROPOSAL.md` §2.5 (Asset Coverage) |
| Status | Draft, pending implementation plan |
| Estimated effort | 1 week (2 PRs: foundation refactor + cNFT implementation) |
| First of | 4 planned per-standard sub-specs (cNFT → Core → MPL Inscriptions → LibrePlex) |

---

## 1. Problem statement

KILN currently supports burning two Solana NFT standards: regular NFTs and programmable NFTs (pNFT), both via Metaplex Token Metadata's `burnV1`. This excludes a large segment of Solana NFT volume:

- **Compressed NFTs (cNFTs)** — DRiP, Solana Mobile, brand drops, on-chain games. Stored as Merkle tree leaves with no on-chain mint account. Use Bubblegum's `burn` instruction with a Merkle proof.
- **Metaplex Core NFTs** — newer standard, growing adoption. Single asset account, no metadata PDA, no token account. Use `mpl-core::burn_v1`.
- **MPL Inscriptions on Solana** — niche but coherent crossover with the Ordinals teleburn flow.
- **LibrePlex Inscriptions on Solana** — different program, different burn flow.

The existing `src/lib/local-burn/detect.ts` short-circuits all non-Token-Metadata assets to "unsupported" or worse, silently misroutes them and fails on burn. There's even a comment in detect.ts: *"CORE can be added later via mpl-core."*

This spec covers two deliverables in one focused unit of work:

1. **The shared foundation** that all 4 standards will plug into: a refactored `detect.ts` using Helius DAS for unified asset-kind detection, an expanded `NftKind` discriminated union, and a thin dispatcher in `build-burn-memo-tx.ts` that routes to per-standard burn builders.
2. **The first new asset class: cNFTs.** Largest addressable user base, well-documented burn instruction, validates the foundation against a real new asset class before the other three standards (Core, MPL Inscriptions, LibrePlex) build on it in subsequent sub-specs.

The next 3 sub-specs (Core, MPL Inscriptions, LibrePlex) each add a single new file plus a dispatcher case — no further refactoring of the foundation.

## 2. Decision summary

- **Detection mechanism**: Helius DAS `getAsset` for everything. Single source of truth across all 6 standards. Replaces the current Umi-based `fetchDigitalAssetWithAssociatedToken` detection path.
- **Architecture**: Unified dispatcher in `build-burn-memo-tx.ts` routes by `NftKind` to per-standard burn builders. Each builder owns its complete tx (burn ix + memo ix + compute budget) and follows a uniform signature.
- **Existing code**: `pnft-burn.ts` and `regular-burn.ts` get refactored to accept a pre-fetched DAS asset rather than self-fetching. Burn instruction wiring stays line-for-line identical; only the data source changes.
- **`NftKind` union**: Includes all 6 standards (existing 2 + 4 future) so subsequent sub-specs only add implementation files + a dispatcher case, never refactor the union.
- **Caching**: No detection caching. Asset state changes too easily (transfer, burn, edition mint). Different problem from inscription-preflight (Bitcoin inscriptions are immutable).
- **cNFT-specific UI**: Compression badge in Step 3 preview ("🌳 Compressed NFT"), surfaced via a new `nftKind` field on the existing `DryRunReport`.
- **cNFT scope limits in v1**:
  - Owner-only burns (no delegate-initiated flow yet).
  - No Address Lookup Tables for deep canopy trees (rare case, ships with clear error message).
  - No batch teleburn for cNFTs (defer to future batch spec).
- **Rollout**: Two PRs. PR 1 lands the foundation (zero new user-facing functionality, all regression tests pass on pNFT/regular). PR 2 lands cNFT support on top of PR 1.

## 3. Architecture

### 3.1 File layout

```
src/lib/local-burn/
├── detect.ts                  # REWRITTEN: DAS-driven, returns NftKind union + DasAsset
├── build-burn-memo-tx.ts      # REFACTORED: thin dispatcher (~50 lines)
├── pnft-burn.ts               # REFACTORED: accepts pre-fetched asset, drops self-fetching
├── regular-burn.ts            # REFACTORED: accepts pre-fetched asset, drops self-fetching
├── cnft-burn.ts               # NEW: Bubblegum burn + memo + compute budget
├── cnft-proof.ts              # NEW: DAS getAssetProof + tree canopy fetch + slicing
├── types.ts                   # MODIFIED: NftKind union expanded to 6 standards + DasAsset
├── memo.ts                    # UNCHANGED
├── ix-helpers.ts              # UNCHANGED (withSplMemoString, withComputeBudget)
├── umi.ts                     # UNCHANGED
└── universal.ts               # UNCHANGED
```

Two new files. Three rewrites. Two interface-level changes. Net new lines of code roughly +400, removed ~150 from the old detect/build paths.

### 3.2 Data flow

```
TeleburnForm (mint + inscriptionId)
        ↓
POST /api/tx/burn-memo
        ↓
buildBurnMemoTransaction({ rpcUrl, mint, owner, inscriptionId, priorityFee })
        ↓
   ┌────────────────────────────────────────────────────────┐
   │ detectAssetKind(mint, rpcUrl)                          │
   │   → Helius DAS getAsset(mint)                          │
   │   → returns NftKind union + raw DasAsset               │
   └────────────────────────────────────────────────────────┘
        ↓
   ┌────────────────────────────────────────────────────────┐
   │ dispatcher (build-burn-memo-tx.ts):                    │
   │   switch (kind.kind) {                                 │
   │     case 'pnft':    return buildPnftBurn(...)          │
   │     case 'regular': return buildRegularBurn(...)       │
   │     case 'cnft':    return buildCnftBurn(...)          │
   │     case 'core' | 'mpl-inscription' | 'libreplex-…':   │
   │                     throw NotYetImplementedError(kind) │
   │     case 'unknown': throw UnsupportedStandardError(…)  │
   │   }                                                    │
   └────────────────────────────────────────────────────────┘
        ↓
   Built VersionedTransaction with burn + memo + compute budget
        ↓
Returned to TeleburnForm → client signs → broadcast
```

### 3.3 Per-standard burn-builder uniform signature

```ts
function buildXxxBurn(args: {
  umi: Umi;
  asset: DasAsset;
  kindInfo: NftKind;              // narrowed to the specific variant
  inscriptionId: string;
  ownerPubkey: PublicKey;
  priorityMicrolamports: number;
  rpcUrl: string;
}): Promise<TransactionBuilder>;
```

The dispatcher passes the same shape to every builder; each builder narrows `kindInfo` via TypeScript discriminated-union refinement. Builders don't share build steps — they share interface.

## 4. Detection contract & `NftKind`

### 4.1 `NftKind` discriminated union — full shape

```ts
import type { PublicKey } from '@solana/web3.js';

export type NftKind =
  | { kind: 'regular'; mint: PublicKey }
  | { kind: 'pnft'; mint: PublicKey }
  | { kind: 'cnft';
      assetId: PublicKey;       // cNFT asset ID (cNFTs have NO mint)
      tree: PublicKey;          // Merkle tree this cNFT belongs to
      leafIndex: number;        // position in the tree
      dataHash: string;         // hex from DAS compression.data_hash
      creatorHash: string;      // hex from DAS compression.creator_hash
    }
  | { kind: 'core'; assetId: PublicKey }
  | { kind: 'mpl-inscription'; mint: PublicKey }
  | { kind: 'libreplex-inscription'; mint: PublicKey }
  | { kind: 'unknown'; daInterface: string; identifier: string };
```

**`mint` vs `assetId` distinction**: regular/pNFT/inscription standards have an SPL token mint. cNFTs and Core assets do not — they have an asset ID (the leaf address for cNFT, the asset account pubkey for Core). Field naming prevents misuse.

The `core`, `mpl-inscription`, and `libreplex-inscription` variants are in the union now so future sub-specs only need to add implementation files + a dispatcher case. They produce `NotYetImplementedError` when routed today.

### 4.2 Detection function

```ts
export async function detectAssetKind(
  mintOrAssetId: string,
  rpcUrl: string,
): Promise<{ kind: NftKind; asset: DasAsset }>;
```

**Algorithm:**

1. POST to Helius DAS `getAsset` RPC method via the existing Helius RPC endpoint at `rpcUrl`.
2. Inspect the response:
   - `compression.compressed === true` → `cnft` (extract `tree`, `leaf_id`, `data_hash`, `creator_hash`)
   - `interface === 'ProgrammableNFT'` → `pnft`
   - `interface === 'V1_NFT' | 'V1_PRINT' | 'V2_NFT'` → `regular`
   - `interface === 'MplCoreAsset' | 'MplCoreCollection'` → `core`
   - `interface === 'FungibleToken' | 'FungibleAsset'` → throw `NotAnNftError`
   - Other (`Custom`, `Identity`, `Executable`, …) → `unknown` (preserves the raw interface name)
3. Return both the discriminant and the raw normalized DAS asset.

**MPL Inscriptions and LibrePlex Inscriptions** are typed in the union but `detect.ts` doesn't return those values in this spec — they'll fall through to `unknown` until their own sub-specs add detection logic (likely an on-chain account-owner check). Documented limitation.

### 4.3 `DasAsset` normalized internal shape

The DAS response is verbose; this is what burn builders need:

```ts
export interface DasAsset {
  id: string;
  interface: string;
  ownership: { owner: string; delegate: string | null; ownership_model: 'single' | 'token' };
  content: {
    metadata: { name?: string; description?: string };
    files?: Array<{ uri: string; mime?: string }>;
    json_uri?: string;
  };
  compression?: {
    compressed: boolean;
    tree?: string;
    leaf_id?: number;
    data_hash?: string;
    creator_hash?: string;
    asset_hash?: string;
    seq?: number;
  };
}
```

### 4.4 Caching: none

Asset state changes too easily (transfer, burn, edition mint). Always fetch fresh on every burn. Detection takes ~200ms — well under any UX threshold.

The inscription-preflight cache (last week's work) was safe because Bitcoin inscriptions are immutable. Asset detection is not.

### 4.5 Dispatcher in `build-burn-memo-tx.ts`

```ts
export async function buildBurnMemoTransaction(args: BuildBurnMemoArgs): Promise<BuiltBurnTx> {
  const { kind, asset } = await detectAssetKind(args.mint, args.rpcUrl);

  const common = {
    umi,
    asset,
    inscriptionId: args.inscriptionId,
    ownerPubkey: args.owner,
    priorityMicrolamports: args.priorityFee,
    rpcUrl: args.rpcUrl,
  };

  switch (kind.kind) {
    case 'pnft':    return buildPnftBurn({ ...common, kindInfo: kind });
    case 'regular': return buildRegularBurn({ ...common, kindInfo: kind });
    case 'cnft':    return buildCnftBurn({ ...common, kindInfo: kind });
    case 'core':
    case 'mpl-inscription':
    case 'libreplex-inscription':
      throw new NotYetImplementedError(kind.kind);
    case 'unknown':
      throw new UnsupportedStandardError(kind.daInterface);
  }
}
```

Exhaustive switch — TypeScript will flag if a future `NftKind` variant is added without a dispatcher case.

### 4.6 Error types

```ts
export class NotAnNftError extends Error {}             // fungible / non-NFT asset
export class NotYetImplementedError extends Error {}    // recognized standard, not yet built
export class UnsupportedStandardError extends Error {}  // unknown DAS interface
export class AssetNotFoundError extends Error {}        // DAS 404

// cNFT-specific (defined in cnft-burn.ts)
export class CnftStaleProofError extends Error {}       // tree mutated between fetch and sign
export class CnftTooDeepError extends Error {}          // proof+canopy can't fit in 1 tx
export class CnftOwnershipMismatchError extends Error {} // signer ≠ DAS owner
export class CnftDelegatedError extends Error {}        // active non-owner delegate
```

Each maps to an HTTP 400 in `/api/tx/burn-memo` with a user-facing message. Network/unknown errors → 500. Stale-proof → 409 (retryable).

## 5. cNFT burn path internals

### 5.1 Module: `src/lib/local-burn/cnft-burn.ts`

Single file, ~150 lines. Responsibilities: proof slicing, ownership pre-check, delegate pre-check, tx-size guard, Bubblegum burn instruction construction, memo attachment, compute-budget. Returns a fully-formed `TransactionBuilder`.

### 5.2 Bubblegum burn instruction — inputs

Via `@metaplex-foundation/mpl-bubblegum`'s `burn` helper. Required inputs:

| Field | Source |
|---|---|
| `leafOwner` (signer) | Connecting wallet (via Umi noop signer for tx building; client signs at broadcast) |
| `leafDelegate` | Same as `leafOwner` if no delegate; v1 errors if non-owner delegate present |
| `merkleTree` | `kindInfo.tree` from detection |
| `root` | Fresh — fetched at burn-build time from DAS `getAssetProof.root` |
| `dataHash` | `kindInfo.dataHash` from detection |
| `creatorHash` | `kindInfo.creatorHash` from detection |
| `nonce` | `kindInfo.leafIndex` |
| `index` | `kindInfo.leafIndex` |
| `proof[]` | Sliced array of proof nodes (see §5.4) |

Tree authority, log wrapper, account compression program, and system program are wired automatically by the Umi helper.

### 5.3 Proof fetching — `cnft-proof.ts`

```ts
export async function fetchAssetProof(
  assetId: PublicKey,
  rpcUrl: string,
): Promise<{
  root: string;          // base58 pubkey
  proof: string[];       // base58 pubkey array, leaf-up
  node_index: number;
  leaf: string;
  tree_id: string;
}>;
```

POSTs JSON-RPC to the same Helius endpoint with method `getAssetProof`. Same auth, same caching policy (none).

### 5.4 Canopy slicing

A Bubblegum tree has a configurable `canopyDepth` (typically 0–17). The top `canopyDepth` proof nodes are stored on-chain and don't need to be included in the burn ix.

```ts
export async function fetchTreeCanopyDepth(
  treePubkey: PublicKey,
  umi: Umi,
): Promise<number>;
```

Reads the tree account header (first ~80 bytes) and derives canopy depth from the layout. Standard pattern; existing Solana Foundation docs cover the math.

The proof passed to Bubblegum's `burn` is `proof.slice(0, proof.length - canopyDepth)`.

### 5.5 Pre-flight checks (before tx construction)

| Check | Action on failure |
|---|---|
| `asset.ownership.owner === ownerPubkey.toBase58()` | `CnftOwnershipMismatchError` |
| `asset.ownership.delegate === null` OR `delegate === owner` | `CnftDelegatedError` |
| Estimated tx size with sliced proof ≤ 1232 bytes | `CnftTooDeepError` |

The third check uses a heuristic estimator: `estimateCnftBurnSize(slicedProofLength)` returns approximate tx bytes including compute-budget ix + bubblegum burn ix + memo ix + signatures. Conservative — overestimates by ~10% to avoid edge cases.

### 5.6 `cnft-burn.ts` module shape

```ts
import { burn as bubblegumBurn } from '@metaplex-foundation/mpl-bubblegum';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { transactionBuilder, publicKey, createNoopSigner } from '@metaplex-foundation/umi';
import { withSplMemoString } from './ix-helpers';
import { buildRetireMemo } from './memo';
import { fetchAssetProof, fetchTreeCanopyDepth } from './cnft-proof';
import {
  CnftStaleProofError,
  CnftTooDeepError,
  CnftOwnershipMismatchError,
  CnftDelegatedError,
} from './errors';

const CNFT_BURN_COMPUTE_UNITS = 300_000;
const MAX_TX_SIZE = 1232;

export async function buildCnftBurn(args: {
  umi: Umi;
  asset: DasAsset;
  kindInfo: Extract<NftKind, { kind: 'cnft' }>;
  inscriptionId: string;
  ownerPubkey: PublicKey;
  priorityMicrolamports: number;
  rpcUrl: string;
}): Promise<TransactionBuilder> {
  // Pre-flight: ownership
  if (args.asset.ownership.owner !== args.ownerPubkey.toBase58()) {
    throw new CnftOwnershipMismatchError(args.asset.ownership.owner, args.ownerPubkey.toBase58());
  }

  // Pre-flight: delegate
  if (
    args.asset.ownership.delegate !== null &&
    args.asset.ownership.delegate !== args.asset.ownership.owner
  ) {
    throw new CnftDelegatedError(args.asset.ownership.delegate);
  }

  // Fetch proof (fresh)
  const proof = await fetchAssetProof(args.kindInfo.assetId, args.rpcUrl);

  // Determine canopy depth and slice
  const canopyDepth = await fetchTreeCanopyDepth(args.kindInfo.tree, args.umi);
  const slicedProof = proof.proof.slice(0, proof.proof.length - canopyDepth);

  // Pre-flight: tx size guard
  const expectedTxSize = estimateCnftBurnSize(slicedProof.length);
  if (expectedTxSize > MAX_TX_SIZE) {
    throw new CnftTooDeepError(args.kindInfo.tree, slicedProof.length, expectedTxSize);
  }

  // Build tx
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(args.umi, { units: CNFT_BURN_COMPUTE_UNITS }));
  tb = tb.add(setComputeUnitPrice(args.umi, { microLamports: args.priorityMicrolamports }));

  const ownerSigner = createNoopSigner(publicKey(args.ownerPubkey.toBase58()));

  tb = tb.add(
    bubblegumBurn(args.umi, {
      leafOwner: ownerSigner,
      merkleTree: publicKey(args.kindInfo.tree.toBase58()),
      root: proof.root,
      dataHash: args.kindInfo.dataHash,
      creatorHash: args.kindInfo.creatorHash,
      nonce: args.kindInfo.leafIndex,
      index: args.kindInfo.leafIndex,
      proof: slicedProof,
    }),
  );

  // Memo (same withSplMemoString helper as pNFT/regular paths)
  const memo = buildRetireMemo({ inscriptionId: args.inscriptionId });
  tb = withSplMemoString(tb, memo);

  return tb;
}

function estimateCnftBurnSize(slicedProofLength: number): number {
  // Heuristic — overestimates by ~10%
  // Base: tx header + signatures + 3 instructions (compute limit, compute price, memo)
  // Plus: bubblegum burn ix with proof nodes (each proof node = 32 bytes)
  const BASE_TX_BYTES = 280;
  const PER_PROOF_NODE_BYTES = 32;
  return BASE_TX_BYTES + slicedProofLength * PER_PROOF_NODE_BYTES;
}
```

### 5.7 New dependency

Adds `@metaplex-foundation/mpl-bubblegum` to `package.json`. Same author + same shape as existing Umi packages — pure addition, no version conflicts expected.

### 5.8 Compute budget & priority fee

- **Compute limit:** 300k (Bubblegum burn typical: 50–150k; 2x headroom for proof verification variance).
- **Priority fee:** Same default as existing pNFT/regular paths (2000 microLamports). cNFT burns aren't priority-sensitive — they're not racing anyone.

### 5.9 Atomicity

Burn ix + memo ix + compute budget = one `VersionedTransaction`. Same as today's pNFT/regular paths. Satisfies v1.0 teleburn spec §3.2 (atomic burn+memo) identically.

## 6. UI changes

### 6.1 Compression badge in Step3Preview

The wizard surfaces an info-level badge when the detected kind is `cnft`. Placement: alongside the existing NFT title in the Step 3 preview area.

Content:
- Pill: "🌳 Compressed NFT"
- Color: subtle info (matches `InscriptionPanel` info badges from last week's preflight work)
- Tooltip: "Stored as a Merkle tree leaf — same teleburn protocol, same on-chain memo, same verification."

### 6.2 Data flow for the badge

The wizard doesn't currently know the asset kind — detection happens inside `/api/tx/burn-memo`. To surface it:

- Add `nftKind: NftKind['kind']` to `DryRunReport` (returned by `/api/tx/simulate`).
- Step3Preview reads `report.nftKind === 'cnft'` and conditionally renders the badge.

This is the only modification to existing API shape in this spec. Additive only.

### 6.3 Error UX surface points

| Error type | Where rendered | User message |
|---|---|---|
| `NotAnNftError` | TeleburnForm submit response | "That mint isn't an NFT — looks like a fungible token. Teleburn only supports NFTs." |
| `NotYetImplementedError` | TeleburnForm submit response | "Standard '{kind}' isn't supported yet. Coming soon: Core, MPL Inscriptions, LibrePlex." |
| `UnsupportedStandardError` | TeleburnForm submit response | "Unrecognized asset standard. KILN supports regular, programmable, and compressed NFTs." |
| `AssetNotFoundError` | TeleburnForm submit response | "Asset not found. Check the mint address." |
| `CnftDelegatedError` | TeleburnForm submit response | "This cNFT has an active delegate. Revoke delegation before burning." |
| `CnftOwnershipMismatchError` | Step3Preview simulate result | "Connected wallet doesn't own this cNFT (it may have been transferred)." |
| `CnftStaleProofError` | Step4Execute on broadcast | "Tree state changed mid-sign. Click Retry to fetch fresh proof." |
| `CnftTooDeepError` | TeleburnForm or Step3 simulate | "This cNFT's tree is unsupported (proof too large for one transaction). Address Lookup Tables planned for a future release." |

The route handler at `/api/tx/burn-memo` catches typed errors and returns `{ error: string, errorCode: string }`. The client renders a `<RetryButton>` for retryable codes (`CNFT_STALE_PROOF`) and hides it for terminal ones.

## 7. Testing

### 7.1 New test files

| File | What it covers |
|---|---|
| `tests/unit/asset-detection.test.ts` | DAS response → NftKind mapping. 8 cases: regular, pNFT, cNFT, Core, MPL Inscription (→ unknown), LibrePlex (→ unknown), fungible, unknown interface. Mocked fetch. |
| `tests/unit/dispatcher.test.ts` | The switch routes to the right builder per kind. Each builder mocked. Exhaustive case coverage. |
| `tests/unit/cnft-burn.test.ts` | Ownership pre-check, delegate pre-check, tx-size guard, Bubblegum ix construction. Mocked DAS + mocked tree-canopy fetch. |
| `tests/unit/cnft-proof.test.ts` | Standalone proof-fetch + canopy-depth helpers. Mocked Helius DAS. |

### 7.2 Regression coverage

- Existing pNFT/regular burn tests **must still pass** after the refactor. Safety net.
- `tests/unit/inscription-preflight*.test.ts` (40 tests from last week) should be untouched.

### 7.3 Test fixtures

Recorded once from real Helius DAS responses; stored as JSON:

- `tests/fixtures/das-regular-nft.json`
- `tests/fixtures/das-pnft.json`
- `tests/fixtures/das-cnft.json`
- `tests/fixtures/das-core.json`
- `tests/fixtures/das-fungible.json`
- `tests/fixtures/das-cnft-proof.json`

Specific mainnet examples to use should be chosen during implementation (well-known stable mints: a Magic Eden pNFT for pnft, an Okay Bear regular NFT for regular, a DRiP cNFT for cnft, etc.). Implementer picks.

### 7.4 Manual test plan (executed before merge)

| # | Test | Expected |
|---|---|---|
| M1 | Regular NFT teleburn (regression) | Same flow as today; no compression badge; burns successfully |
| M2 | pNFT teleburn (regression) | Same flow as today; no badge; burns successfully |
| M3 | cNFT happy path (Helius DAS owner = signer, fresh tree) | Compression badge in Step 3; burns successfully; tx confirmed |
| M4 | cNFT with active non-owner delegate | TeleburnForm shows `CnftDelegatedError` message |
| M5 | cNFT recently transferred (DAS owner ≠ signer) | Step 3 shows ownership-mismatch error |
| M6 | Core NFT mint | TeleburnForm shows `NotYetImplementedError` for 'core' |
| M7 | Fungible token mint (e.g., USDC) | TeleburnForm shows `NotAnNftError` |
| M8 | Garbage mint string | Same as today: form-level validation error before submit |

## 8. Rollout

### 8.1 Two-PR ordering

**PR 1: Foundation refactor (no new functionality)**

- `detect.ts` rewritten DAS-driven
- `NftKind` union expanded to 6 variants
- `build-burn-memo-tx.ts` becomes dispatcher
- `pnft-burn.ts` / `regular-burn.ts` refactored to accept pre-fetched asset
- All 4 future kinds (`cnft`, `core`, `mpl-inscription`, `libreplex-inscription`) throw `NotYetImplementedError`
- All existing regression tests pass
- New `asset-detection.test.ts` + `dispatcher.test.ts` pass
- **Manual verification:** M1 + M2 pass on staging before merging

**PR 2: cNFT implementation**

- `cnft-burn.ts` + `cnft-proof.ts` + `@metaplex-foundation/mpl-bubblegum` dependency
- Dispatcher's `cnft` case wired to `buildCnftBurn`
- DAS asset proof fetching
- `DryRunReport.nftKind` field added; simulate updated
- Step3Preview compression badge
- Error UX wiring in TeleburnForm + Step3Preview
- New tests: `cnft-burn.test.ts`, `cnft-proof.test.ts`
- **Manual verification:** M3–M7 pass

This split lets the foundation refactor go live (and observe pNFT/regular behavior in production) before the new asset type lands. PR 1 is the higher-risk change; isolating it reduces blast radius if something regresses.

### 8.2 Backwards compatibility

Zero. The dispatcher is purely additive — it routes existing kinds to existing builders. The `DryRunReport.nftKind` addition is a new optional field; older clients ignore it.

### 8.3 No feature flag

Safety improvement on a flow that already works for pNFT/regular; ship on for everyone.

### 8.4 Monitoring (informal, grep Vercel logs)

- Detection call latency (DAS RPC response time)
- Distribution of detected kinds (how much cNFT volume vs regular vs pNFT)
- `NotYetImplementedError` frequency (signals demand for the other 3 standards)
- `CnftStaleProofError` frequency (if >1%, consider request coalescing or pre-flight tree-state cache)

## 9. What's deferred to other sub-specs

| Item | Reason | Future spec |
|---|---|---|
| Core NFT support | Separate burn path, separate testing | Sub-spec 2 of asset coverage |
| MPL Inscriptions support | Separate detection + burn path | Sub-spec 3 of asset coverage |
| LibrePlex Inscriptions support | Separate program + tooling | Sub-spec 4 of asset coverage |
| cNFT batch teleburn | Per-cNFT proofs need separate UX/tx-size design | Future batch spec |
| Address Lookup Tables for deep-canopy trees | Niche edge case affecting <5% of cNFTs | Future enhancement |
| Delegate-initiated cNFT burns | Different signer model | Future enhancement if requested |
| Request coalescing in detection / proof fetch | Premature optimization; revisit if monitoring shows duplicate fetches | Post-launch |
| Token-2022 NFT extension support | Existing regular path already handles most cases; metadata extension is separate | Future enhancement |

## 10. Out of scope (explicitly)

- Any change to the on-chain memo format (v1.0 spec is stable)
- Any change to the burn transaction structure beyond the per-standard burn instruction
- Caching of asset detection results
- Inscription pre-flight changes (last week's spec is stable)
- Verify page changes (same shape works for cNFTs)
- History page changes (DAS-based history already supports cNFTs)

## 11. References

- Parent proposal: `public/docs/KILN_PROTOCOL_ENHANCEMENT_PROPOSAL.md` §2.5
- KILN spec: `public/docs/TELEBURN_SPEC_v1.0.md`
- Inscription preflight spec (sibling sub-spec): `docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md`
- Helius DAS API: https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api
- Helius `getAsset`: https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api/get-asset
- Helius `getAssetProof`: https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api/get-asset-proof
- Metaplex Bubblegum: https://developers.metaplex.com/bubblegum
- Bubblegum burn instruction: https://developers.metaplex.com/bubblegum/burn-cnfts
- Metaplex Core: https://developers.metaplex.com/core (future sub-spec 2)
- MPL Inscriptions: https://developers.metaplex.com/inscription (future sub-spec 3)
- LibrePlex: https://docs.libreplex.io (future sub-spec 4)
