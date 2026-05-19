# cNFT Burn Path + Asset Detection Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DAS-driven asset detection foundation that supports all 6 Solana NFT standards (existing 2 + 4 future variants), then plug in cNFT (Bubblegum) as the first new asset class.

**Architecture:** New `detect.ts` calls Helius DAS `getAsset` and returns a `NftKind` discriminated union + normalized `DasAsset`. `build-burn-memo-tx.ts` becomes a thin dispatcher routing each kind to a per-standard burn builder. Existing `pnft-burn.ts` / `regular-burn.ts` get refactored to accept a pre-fetched asset (burn instruction wiring unchanged). New `cnft-burn.ts` + `cnft-proof.ts` implement the Bubblegum burn path with proof slicing, ownership pre-check, delegate pre-check, and tx-size guard. UI gets a compression badge in Step 3.

**Tech Stack:** TypeScript, Next.js, Solana web3.js, Metaplex Umi, `@metaplex-foundation/mpl-bubblegum` (new), `@solana/spl-account-compression` (new — for canopy depth), Helius DAS, Jest with `ts-jest`.

**Source spec:** `docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md`

---

## File structure

### Created

| Path | Responsibility |
|---|---|
| `src/lib/local-burn/cnft-burn.ts` | cNFT Bubblegum burn builder; pre-flight checks; tx-size guard |
| `src/lib/local-burn/cnft-proof.ts` | DAS `getAssetProof` fetch + tree canopy depth read + proof slicing |
| `src/lib/local-burn/errors.ts` | Typed errors: `NotAnNftError`, `NotYetImplementedError`, `UnsupportedStandardError`, `AssetNotFoundError`, `CnftStaleProofError`, `CnftTooDeepError`, `CnftOwnershipMismatchError`, `CnftDelegatedError` |
| `tests/unit/asset-detection.test.ts` | Detection: DAS response → NftKind mapping. 8 cases covering each variant + edge cases. Mocked fetch. |
| `tests/unit/dispatcher.test.ts` | Build-burn-memo-tx dispatcher: routes per kind, throws correct errors for unimplemented standards. |
| `tests/unit/cnft-burn.test.ts` | cNFT burn: ownership pre-check, delegate pre-check, tx-size guard, Bubblegum ix construction. Mocked DAS + mocked tree canopy. |
| `tests/unit/cnft-proof.test.ts` | Standalone proof-fetch + canopy-depth helpers. Mocked DAS + mocked Connection. |
| `tests/fixtures/das-regular-nft.json` | Recorded DAS response for a real mainnet regular NFT |
| `tests/fixtures/das-pnft.json` | Recorded DAS response for a real mainnet pNFT |
| `tests/fixtures/das-cnft.json` | Recorded DAS response for a real mainnet cNFT |
| `tests/fixtures/das-core.json` | Recorded DAS response for a real mainnet Core asset |
| `tests/fixtures/das-fungible.json` | Recorded DAS response for a known fungible token (e.g., USDC) |
| `tests/fixtures/das-cnft-proof.json` | Recorded DAS `getAssetProof` response for the cNFT fixture above |

### Modified

| Path | Change |
|---|---|
| `src/lib/local-burn/types.ts` | Add `NftKind` discriminated union (7 variants), `DasAsset` interface, `BuiltBurnTx` shape |
| `src/lib/local-burn/detect.ts` | Rewrite: DAS-driven detection returning `{ kind, asset }` |
| `src/lib/local-burn/build-burn-memo-tx.ts` | Refactor into thin dispatcher routing by `NftKind` |
| `src/lib/local-burn/pnft-burn.ts` | Refactor: accept pre-fetched `DasAsset`, drop self-fetching of digital asset |
| `src/lib/local-burn/regular-burn.ts` | Refactor: accept pre-fetched `DasAsset`, drop self-fetching of digital asset |
| `src/lib/dry-run.ts` | Add `nftKind` to `DryRunReport`; thread through from build result |
| `src/app/api/tx/simulate/route.ts` | Pass `nftKind` from dry-run report to client (already routes the report) |
| `src/components/wizard/Step3Preview.tsx` | Render compression badge when `report.nftKind === 'cnft'` |
| `src/components/teleburn/TeleburnForm.tsx` | Display new typed-error messages from `/api/tx/burn-memo` |
| `src/app/api/tx/burn-memo/route.ts` | Catch new typed errors; return user-friendly HTTP responses with `errorCode` |
| `package.json` | Add `@metaplex-foundation/mpl-bubblegum`, `@solana/spl-account-compression` |

### Deleted

None. This is purely additive + refactor.

---

## Pre-flight environment notes

You have zero context, so:

- **pnpm**, not npm. All commands use `pnpm`.
- **Jest** with `ts-jest`, jsdom env, `tests/setup.ts` polyfills web crypto + mocks fetch.
- **Helius DAS** is accessed via the project's existing `NEXT_PUBLIC_SOLANA_RPC` URL. The DAS endpoints (`getAsset`, `getAssetProof`) are POST JSON-RPC against the same RPC URL.
- **TypeScript strict mode** is on. Use discriminated unions; prefer `unknown` over `any`.
- **Existing pNFT/regular burn tests must keep passing** through the refactor. They're the regression safety net.
- **The previous spec's inscription-preflight code (40 tests) is unaffected** by this work — no shared files.

---

## Task 1: NftKind union + DasAsset types + error classes

**Files:**
- Modify: `src/lib/local-burn/types.ts`
- Create: `src/lib/local-burn/errors.ts`

Pure types and error classes. No tests (TS catches at compile time).

- [ ] **Step 1.1: Add types to `src/lib/local-burn/types.ts`**

Append (or add if not present — read the file first to find the right insertion point):

```ts
import type { PublicKey } from '@solana/web3.js';

/**
 * Discriminated union of supported Solana asset standards.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §4.1
 */
export type NftKind =
  | { kind: 'regular'; mint: PublicKey }
  | { kind: 'pnft'; mint: PublicKey }
  | { kind: 'cnft';
      assetId: PublicKey;
      tree: PublicKey;
      leafIndex: number;
      dataHash: string;
      creatorHash: string;
    }
  | { kind: 'core'; assetId: PublicKey }
  | { kind: 'mpl-inscription'; mint: PublicKey }
  | { kind: 'libreplex-inscription'; mint: PublicKey }
  | { kind: 'unknown'; daInterface: string; identifier: string };

/**
 * Normalized DAS asset shape used by burn builders.
 * Only fields we actually need are surfaced.
 */
export interface DasAsset {
  id: string;
  interface: string;
  ownership: {
    owner: string;
    delegate: string | null;
    ownership_model: 'single' | 'token';
  };
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

/**
 * What the dispatcher returns after building a burn+memo tx.
 * Replaces the old `nftType: 'PNFT' | 'REGULAR'` shape.
 */
export interface BuiltBurnTx {
  transaction: string;          // base64 serialized
  isVersioned: boolean;
  nftKind: NftKind['kind'];     // expanded from old nftType
}
```

- [ ] **Step 1.2: Create `src/lib/local-burn/errors.ts`**

```ts
/**
 * Typed errors for asset detection + burn dispatch.
 * Each maps to a specific HTTP status + user-facing message in /api/tx/burn-memo.
 */

export class NotAnNftError extends Error {
  readonly code = 'NOT_AN_NFT';
  constructor(public daInterface: string) {
    super(`asset is a fungible token, not an NFT (interface: ${daInterface})`);
  }
}

export class NotYetImplementedError extends Error {
  readonly code = 'NOT_YET_IMPLEMENTED';
  constructor(public standard: string) {
    super(`asset standard '${standard}' is recognized but not yet supported`);
  }
}

export class UnsupportedStandardError extends Error {
  readonly code = 'UNSUPPORTED_STANDARD';
  constructor(public daInterface: string) {
    super(`unrecognized asset standard (interface: ${daInterface})`);
  }
}

export class AssetNotFoundError extends Error {
  readonly code = 'ASSET_NOT_FOUND';
  constructor(public id: string) {
    super(`asset not found: ${id}`);
  }
}

export class CnftStaleProofError extends Error {
  readonly code = 'CNFT_STALE_PROOF';
  constructor() {
    super('cNFT proof is stale; tree state changed during sign');
  }
}

export class CnftTooDeepError extends Error {
  readonly code = 'CNFT_TOO_DEEP';
  constructor(public tree: string, public proofLength: number, public estimatedSize: number) {
    super(`cNFT tree ${tree} produces a ${proofLength}-node proof (~${estimatedSize} bytes) that exceeds the 1232-byte transaction size limit`);
  }
}

export class CnftOwnershipMismatchError extends Error {
  readonly code = 'CNFT_OWNERSHIP_MISMATCH';
  constructor(public daOwner: string, public signer: string) {
    super(`cNFT is owned by ${daOwner} but signer is ${signer}`);
  }
}

export class CnftDelegatedError extends Error {
  readonly code = 'CNFT_DELEGATED';
  constructor(public delegate: string) {
    super(`cNFT has an active non-owner delegate: ${delegate}`);
  }
}
```

- [ ] **Step 1.3: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "local-burn/(types|errors)" | head -5`

Expected: no output.

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/local-burn/types.ts src/lib/local-burn/errors.ts
git commit -m "feat(asset-detection): NftKind union, DasAsset, typed errors

Adds the foundation types for the unified asset detection layer:
- NftKind discriminated union covering all 6 standards (existing 2 +
  4 future variants — core, mpl-inscription, libreplex-inscription,
  cnft).
- DasAsset normalized internal shape (subset of Helius DAS getAsset
  response).
- BuiltBurnTx replacing the old nftType: 'PNFT'|'REGULAR' shape.
- Typed errors for detection + cNFT pre-flight failures.

No runtime code yet; subsequent tasks build on these.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Rewrite `detect.ts` — DAS-driven detection

**Files:**
- Modify: `src/lib/local-burn/detect.ts` (full rewrite)
- Create: `tests/unit/asset-detection.test.ts`
- Create: `tests/fixtures/das-regular-nft.json`
- Create: `tests/fixtures/das-pnft.json`
- Create: `tests/fixtures/das-cnft.json`
- Create: `tests/fixtures/das-core.json`
- Create: `tests/fixtures/das-fungible.json`

- [ ] **Step 2.1: Record real DAS fixtures**

Pick stable mainnet examples. Suggestions (verify current state with curl before recording):

- Regular NFT: `8eX5oKHHCnHkPpoUmd8Tk5Asg5UZx4WTGoCqK6gZTwbo` (or any well-known stable regular NFT)
- pNFT: `BCq4ZRC52a4XAprjg5tJxgkyKVMqQsHe2eMtdGzGhFA9` (or any Magic Eden / Tensor pNFT)
- cNFT: `7tABALetxnEYRyTpVbg6PNF6kRYsT44sLynkrYAvb7As` (or any DRiP / Solana Mobile cNFT)
- Core asset: any verified mainnet Core asset
- Fungible token: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC mainnet mint)

For each, run:

```bash
curl -s "$NEXT_PUBLIC_SOLANA_RPC" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"getAsset","params":{"id":"<MINT_OR_ASSET_ID>"}}' \
  | jq . > tests/fixtures/das-<KIND>.json
```

Save the **`result`** object (inside the JSON-RPC envelope), not the full envelope — that's what the detection code parses.

If you can't reach mainnet, manually construct fixtures from the field shape documented in `tests/unit/asset-detection.test.ts` (Step 2.2) and the spec §4.3. Document any synthetic-fixture deviations in a comment at the top of each JSON file.

- [ ] **Step 2.2: Write the failing test**

Create `tests/unit/asset-detection.test.ts`:

```ts
import { detectAssetKind } from '@/lib/local-burn/detect';
import { NotAnNftError } from '@/lib/local-burn/errors';
import dasRegular from '../fixtures/das-regular-nft.json';
import dasPnft from '../fixtures/das-pnft.json';
import dasCnft from '../fixtures/das-cnft.json';
import dasCore from '../fixtures/das-core.json';
import dasFungible from '../fixtures/das-fungible.json';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';

function mockDasResponse(result: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ jsonrpc: '2.0', id: '1', result }),
  });
}

describe('detectAssetKind', () => {
  beforeEach(() => fetchMock.mockReset());

  it('classifies regular NFT (interface: V1_NFT)', async () => {
    mockDasResponse(dasRegular);
    const out = await detectAssetKind('test-mint', RPC_URL);
    expect(out.kind.kind).toBe('regular');
  });

  it('classifies pNFT (interface: ProgrammableNFT)', async () => {
    mockDasResponse(dasPnft);
    const out = await detectAssetKind('test-mint', RPC_URL);
    expect(out.kind.kind).toBe('pnft');
  });

  it('classifies cNFT and extracts tree/leaf/hashes', async () => {
    mockDasResponse(dasCnft);
    const out = await detectAssetKind('test-asset-id', RPC_URL);
    expect(out.kind.kind).toBe('cnft');
    if (out.kind.kind === 'cnft') {
      expect(out.kind.tree.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(out.kind.leafIndex).toBeGreaterThanOrEqual(0);
      expect(out.kind.dataHash).toMatch(/^[0-9a-fA-F]+$/);
      expect(out.kind.creatorHash).toMatch(/^[0-9a-fA-F]+$/);
    }
  });

  it('classifies Core asset (interface: MplCoreAsset)', async () => {
    mockDasResponse(dasCore);
    const out = await detectAssetKind('test-asset-id', RPC_URL);
    expect(out.kind.kind).toBe('core');
  });

  it('throws NotAnNftError for fungible tokens', async () => {
    mockDasResponse(dasFungible);
    await expect(detectAssetKind('test-mint', RPC_URL)).rejects.toBeInstanceOf(NotAnNftError);
  });

  it('returns "unknown" for unrecognized DAS interface', async () => {
    mockDasResponse({ id: 'x', interface: 'Custom', ownership: { owner: 'o', delegate: null, ownership_model: 'single' }, content: { metadata: {} } });
    const out = await detectAssetKind('test-id', RPC_URL);
    expect(out.kind.kind).toBe('unknown');
    if (out.kind.kind === 'unknown') {
      expect(out.kind.daInterface).toBe('Custom');
    }
  });

  it('returns the normalized DAS asset alongside the kind', async () => {
    mockDasResponse(dasRegular);
    const out = await detectAssetKind('test-mint', RPC_URL);
    expect(out.asset.id).toBeDefined();
    expect(out.asset.interface).toBeDefined();
    expect(out.asset.ownership).toBeDefined();
  });

  it('throws AssetNotFoundError when DAS returns null result', async () => {
    mockDasResponse(null);
    await expect(detectAssetKind('missing-mint', RPC_URL)).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2.3: Run test to verify it fails**

Run: `pnpm jest tests/unit/asset-detection.test.ts 2>&1 | tail -10`

Expected: failure with the message `Cannot find module '@/lib/local-burn/detect'` OR existing detect.ts compile errors (because we'll rewrite the whole file).

- [ ] **Step 2.4: Rewrite `src/lib/local-burn/detect.ts`**

Replace the file's entire contents with:

```ts
/**
 * Asset detection — Helius DAS-driven, returns NftKind discriminated union.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §4
 */

import { PublicKey } from '@solana/web3.js';
import type { NftKind, DasAsset } from './types';
import { AssetNotFoundError, NotAnNftError } from './errors';

interface DasGetAssetEnvelope {
  jsonrpc: string;
  id: string;
  result: unknown;
}

export async function detectAssetKind(
  mintOrAssetId: string,
  rpcUrl: string,
): Promise<{ kind: NftKind; asset: DasAsset }> {
  const body = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getAsset',
    params: { id: mintOrAssetId },
  };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DAS getAsset HTTP ${res.status}`);
  }

  const env = (await res.json()) as DasGetAssetEnvelope;
  const result = env.result;

  if (result === null || result === undefined) {
    throw new AssetNotFoundError(mintOrAssetId);
  }

  const asset = result as DasAsset;
  const iface = typeof asset.interface === 'string' ? asset.interface : '';

  // Order matters: compression check beats interface check (a cNFT may
  // have interface 'V1_NFT' but be compressed).
  if (asset.compression?.compressed === true) {
    return {
      kind: {
        kind: 'cnft',
        assetId: new PublicKey(asset.id),
        tree: new PublicKey(asset.compression.tree!),
        leafIndex: asset.compression.leaf_id!,
        dataHash: asset.compression.data_hash!,
        creatorHash: asset.compression.creator_hash!,
      },
      asset,
    };
  }

  if (iface === 'ProgrammableNFT') {
    return { kind: { kind: 'pnft', mint: new PublicKey(asset.id) }, asset };
  }

  if (iface === 'V1_NFT' || iface === 'V1_PRINT' || iface === 'V2_NFT') {
    return { kind: { kind: 'regular', mint: new PublicKey(asset.id) }, asset };
  }

  if (iface === 'MplCoreAsset' || iface === 'MplCoreCollection') {
    return { kind: { kind: 'core', assetId: new PublicKey(asset.id) }, asset };
  }

  if (iface === 'FungibleToken' || iface === 'FungibleAsset') {
    throw new NotAnNftError(iface);
  }

  return {
    kind: { kind: 'unknown', daInterface: iface, identifier: asset.id },
    asset,
  };
}
```

- [ ] **Step 2.5: Run test to verify it passes**

Run: `pnpm jest tests/unit/asset-detection.test.ts 2>&1 | tail -10`

Expected: `Tests: 8 passed, 8 total`.

If any test fails because the real DAS fixture has different field names than expected, update the test fixture and the parsing logic together — do not paper over the mismatch.

- [ ] **Step 2.6: Verify other tests still pass**

Run: `pnpm jest 2>&1 | tail -5`

Expected: existing tests still pass (the inscription-preflight 40 + the new 8 = 48+). If any existing burn-related tests fail, they're likely importing the old detect.ts signature — note them for Tasks 3-5 below to fix.

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/local-burn/detect.ts tests/unit/asset-detection.test.ts tests/fixtures/das-*.json
git commit -m "feat(asset-detection): DAS-driven detect.ts with NftKind union

Replaces the existing Umi-based fetchMetadata detection (PNFT/REGULAR
only) with a Helius DAS getAsset call that returns the full
NftKind union (regular, pnft, cnft, core, mpl-inscription,
libreplex-inscription, unknown) plus a normalized DasAsset shape.

Detection logic:
- compression.compressed === true → cnft (extracts tree, leaf, hashes)
- interface ProgrammableNFT → pnft
- interface V1_NFT | V1_PRINT | V2_NFT → regular
- interface MplCoreAsset | MplCoreCollection → core
- interface FungibleToken | FungibleAsset → throws NotAnNftError
- other → unknown (preserves raw interface name)

MPL Inscriptions and LibrePlex Inscriptions are typed in NftKind but
detection falls through to 'unknown' until their own sub-specs add
detection logic (likely on-chain account-owner checks).

Tests: 8 cases covering each kind + edge cases (null result, unknown
interface, non-NFT) with real recorded DAS fixtures.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Refactor `pnft-burn.ts` to accept pre-fetched asset

**Files:**
- Modify: `src/lib/local-burn/pnft-burn.ts`

The current `pnft-burn.ts` calls `fetchDigitalAssetWithAssociatedToken(umi, mintPk, ownerPk)` internally. After refactor it accepts a pre-fetched `DasAsset` and uses only the data already available there.

- [ ] **Step 3.1: Read the current file**

Read `src/lib/local-burn/pnft-burn.ts` end-to-end. Identify:
- The function signature (likely `buildPnftBurn(umi, args)` or similar)
- The `fetchDigitalAssetWithAssociatedToken` call — this is what we're removing
- The Umi `burnV1` instruction construction — keep this intact
- Any field reads from the fetched digital asset (e.g., `asset.metadata.tokenStandard`, `asset.token.publicKey`) — these need to come from DasAsset instead, or from Umi PDA derivations

The pNFT burn ix needs these account references:
- mint (from DasAsset.id)
- authority (the owner — passed in as arg)
- token account (the owner's ATA — can be derived via `findAssociatedTokenPda` from umi-mpl-toolbox)
- tokenRecord (pNFT-specific PDA — `findTokenRecordPda` from mpl-token-metadata)
- metadata PDA (`findMetadataPda` from mpl-token-metadata)
- masterEditionPda (`findMasterEditionPda` from mpl-token-metadata)
- collectionMetadata (optional — only if collection set; DasAsset.grouping[0].group_value is the collection)

- [ ] **Step 3.2: Update the signature**

Change the function to match the uniform burn-builder signature:

```ts
import type { Umi, TransactionBuilder } from '@metaplex-foundation/umi';
import type { PublicKey } from '@solana/web3.js';
import type { DasAsset, NftKind } from './types';
import { publicKey, transactionBuilder, createNoopSigner } from '@metaplex-foundation/umi';
import { burnV1, TokenStandard, findMetadataPda, findMasterEditionPda, findTokenRecordPda } from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { withSplMemoString } from './ix-helpers';
import { buildRetireMemo } from './memo';

export async function buildPnftBurn(args: {
  umi: Umi;
  asset: DasAsset;
  kindInfo: Extract<NftKind, { kind: 'pnft' }>;
  inscriptionId: string;
  ownerPubkey: PublicKey;
  priorityMicrolamports: number;
  rpcUrl: string;
}): Promise<TransactionBuilder> {
  const mintPk = publicKey(args.kindInfo.mint.toBase58());
  const ownerPk = publicKey(args.ownerPubkey.toBase58());
  const ownerSigner = createNoopSigner(ownerPk);

  // Derive PDAs from mint
  const metadataPda = findMetadataPda(args.umi, { mint: mintPk })[0];
  const masterEditionPda = findMasterEditionPda(args.umi, { mint: mintPk })[0];
  const tokenRecord = findTokenRecordPda(args.umi, { mint: mintPk, token: findAssociatedTokenPda(args.umi, { mint: mintPk, owner: ownerPk })[0] })[0];

  // Owner's ATA
  const ownerAta = findAssociatedTokenPda(args.umi, { mint: mintPk, owner: ownerPk })[0];

  // Optional collection metadata (from DAS grouping)
  let collectionMetadata: ReturnType<typeof findMetadataPda>[0] | undefined;
  const grouping = (args.asset as DasAsset & { grouping?: Array<{ group_key: string; group_value: string }> }).grouping;
  if (grouping && grouping.length > 0) {
    const collKey = grouping.find(g => g.group_key === 'collection')?.group_value;
    if (collKey) {
      collectionMetadata = findMetadataPda(args.umi, { mint: publicKey(collKey) })[0];
    }
  }

  // Build tx
  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(args.umi, { units: 500_000 }));
  tb = tb.add(setComputeUnitPrice(args.umi, { microLamports: args.priorityMicrolamports }));

  tb = tb.add(burnV1(args.umi, {
    mint: mintPk,
    authority: ownerSigner,
    token: ownerAta,
    tokenRecord,
    metadata: metadataPda,
    edition: masterEditionPda,
    collectionMetadata,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
  }));

  const memo = buildRetireMemo({ inscriptionId: args.inscriptionId });
  tb = withSplMemoString(tb, memo);

  return tb;
}
```

Note: the existing pnft-burn.ts may have wrapping logic (creating Umi, fetching the asset, etc.) — strip all of that. The function now ASSUMES it's called with a valid Umi instance, ownerPubkey, etc. The dispatcher provides those.

- [ ] **Step 3.3: Verify the refactor compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "pnft-burn" | head -5`

Expected: no output.

If type errors appear about PDA helpers (`findTokenRecordPda`, etc.), confirm the umi-mpl-token-metadata version exports them; older versions may use different names.

- [ ] **Step 3.4: Verify it doesn't break existing tests yet**

Run: `pnpm jest 2>&1 | tail -10`

Existing burn tests may fail because they call the OLD pnft-burn signature. That's expected — Task 5 will update the dispatcher and tests will pass again. For now, just ensure the file compiles.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/local-burn/pnft-burn.ts
git commit -m "refactor(burn): pnft-burn.ts accepts pre-fetched DasAsset

Drops the internal fetchDigitalAssetWithAssociatedToken call; PDAs are
now derived from the mint pubkey, and collection metadata comes from
the DAS asset's grouping field if present.

Function signature now matches the uniform burn-builder shape:
(umi, asset, kindInfo, inscriptionId, ownerPubkey, priorityMicrolamports, rpcUrl)

Burn instruction wiring is line-for-line identical to before. Only the
data source for the asset state changed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Refactor `regular-burn.ts` to accept pre-fetched asset

**Files:**
- Modify: `src/lib/local-burn/regular-burn.ts`

Same pattern as Task 3 but for regular (non-pNFT) NFTs. Regular NFTs don't need `tokenRecord`.

- [ ] **Step 4.1: Read current file**

Read `src/lib/local-burn/regular-burn.ts`. Identify the same elements as Task 3 Step 3.1.

- [ ] **Step 4.2: Update the signature**

Replace function body with:

```ts
import type { Umi, TransactionBuilder } from '@metaplex-foundation/umi';
import type { PublicKey } from '@solana/web3.js';
import type { DasAsset, NftKind } from './types';
import { publicKey, transactionBuilder, createNoopSigner } from '@metaplex-foundation/umi';
import { burnV1, TokenStandard, findMetadataPda, findMasterEditionPda } from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit, setComputeUnitPrice, findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { withSplMemoString } from './ix-helpers';
import { buildRetireMemo } from './memo';

export async function buildRegularBurn(args: {
  umi: Umi;
  asset: DasAsset;
  kindInfo: Extract<NftKind, { kind: 'regular' }>;
  inscriptionId: string;
  ownerPubkey: PublicKey;
  priorityMicrolamports: number;
  rpcUrl: string;
}): Promise<TransactionBuilder> {
  const mintPk = publicKey(args.kindInfo.mint.toBase58());
  const ownerPk = publicKey(args.ownerPubkey.toBase58());
  const ownerSigner = createNoopSigner(ownerPk);

  const metadataPda = findMetadataPda(args.umi, { mint: mintPk })[0];
  const masterEditionPda = findMasterEditionPda(args.umi, { mint: mintPk })[0];
  const ownerAta = findAssociatedTokenPda(args.umi, { mint: mintPk, owner: ownerPk })[0];

  let collectionMetadata: ReturnType<typeof findMetadataPda>[0] | undefined;
  const grouping = (args.asset as DasAsset & { grouping?: Array<{ group_key: string; group_value: string }> }).grouping;
  if (grouping && grouping.length > 0) {
    const collKey = grouping.find(g => g.group_key === 'collection')?.group_value;
    if (collKey) {
      collectionMetadata = findMetadataPda(args.umi, { mint: publicKey(collKey) })[0];
    }
  }

  let tb = transactionBuilder();
  tb = tb.add(setComputeUnitLimit(args.umi, { units: 400_000 }));
  tb = tb.add(setComputeUnitPrice(args.umi, { microLamports: args.priorityMicrolamports }));

  tb = tb.add(burnV1(args.umi, {
    mint: mintPk,
    authority: ownerSigner,
    token: ownerAta,
    metadata: metadataPda,
    edition: masterEditionPda,
    collectionMetadata,
    tokenStandard: TokenStandard.NonFungible,
  }));

  const memo = buildRetireMemo({ inscriptionId: args.inscriptionId });
  tb = withSplMemoString(tb, memo);

  return tb;
}
```

- [ ] **Step 4.3: Verify it compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "regular-burn" | head -5`

Expected: no output.

- [ ] **Step 4.4: Commit**

```bash
git add src/lib/local-burn/regular-burn.ts
git commit -m "refactor(burn): regular-burn.ts accepts pre-fetched DasAsset

Same pattern as pnft-burn refactor. PDAs derived from mint; collection
metadata from DAS grouping. No tokenRecord (regular NFTs don't have
one).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Refactor `build-burn-memo-tx.ts` into dispatcher + tests

**Files:**
- Modify: `src/lib/local-burn/build-burn-memo-tx.ts` (full rewrite)
- Create: `tests/unit/dispatcher.test.ts`

- [ ] **Step 5.1: Write the failing dispatcher test**

Create `tests/unit/dispatcher.test.ts`:

```ts
import { buildBurnMemoTransaction } from '@/lib/local-burn/build-burn-memo-tx';
import {
  NotYetImplementedError,
  UnsupportedStandardError,
  NotAnNftError,
} from '@/lib/local-burn/errors';
import dasRegular from '../fixtures/das-regular-nft.json';
import dasPnft from '../fixtures/das-pnft.json';
import dasCnft from '../fixtures/das-cnft.json';
import dasCore from '../fixtures/das-core.json';
import dasFungible from '../fixtures/das-fungible.json';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';
const OWNER = 'FaucetOwner111111111111111111111111111111111';
const INSCRIPTION = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';

function mockDasResponse(result: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ jsonrpc: '2.0', id: '1', result }),
  });
}

describe('buildBurnMemoTransaction dispatcher', () => {
  beforeEach(() => fetchMock.mockReset());

  it('throws NotYetImplementedError for cnft (until Task 11)', async () => {
    mockDasResponse(dasCnft);
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'cnft-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(NotYetImplementedError);
  });

  it('throws NotYetImplementedError for core', async () => {
    mockDasResponse(dasCore);
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'core-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(NotYetImplementedError);
  });

  it('throws NotAnNftError for fungible tokens', async () => {
    mockDasResponse(dasFungible);
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'usdc-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(NotAnNftError);
  });

  it('throws UnsupportedStandardError for unknown interfaces', async () => {
    mockDasResponse({
      id: 'x',
      interface: 'Custom',
      ownership: { owner: 'o', delegate: null, ownership_model: 'single' },
      content: { metadata: {} },
    });
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'custom-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(UnsupportedStandardError);
  });

  // Note: tests for the actual pnft/regular happy-path build are integration-level
  // (would require mocking Umi, Connection, blockhash fetch, etc.). Smoke-test
  // those manually post-deploy via M1/M2 in the manual test plan.
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `pnpm jest tests/unit/dispatcher.test.ts 2>&1 | tail -10`

Expected: failure — most likely import or signature mismatch from the existing build-burn-memo-tx.ts.

- [ ] **Step 5.3: Rewrite `src/lib/local-burn/build-burn-memo-tx.ts`**

Replace entire contents with:

```ts
/**
 * Build burn+memo transaction. Thin dispatcher over per-standard burn builders.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §3.2, §4.5
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, signerIdentity, createNoopSigner } from '@metaplex-foundation/umi';
import { Connection, PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { detectAssetKind } from './detect';
import { buildPnftBurn } from './pnft-burn';
import { buildRegularBurn } from './regular-burn';
import { NotYetImplementedError, UnsupportedStandardError } from './errors';
import type { BuiltBurnTx } from './types';

export interface BuildBurnMemoArgs {
  rpcUrl: string;
  mint: string;            // mint OR cNFT assetId OR Core assetId
  owner: string;
  inscriptionId: string;
  priorityMicrolamports?: number;
}

const FALLBACK_RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
];

async function getWorkingRpcUrl(rpcUrl: string): Promise<string> {
  try {
    const conn = new Connection(rpcUrl, 'confirmed');
    await conn.getSlot();
    return rpcUrl;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
      for (const fallback of FALLBACK_RPC_ENDPOINTS) {
        try {
          const c = new Connection(fallback, 'confirmed');
          await c.getSlot();
          return fallback;
        } catch {
          // try next
        }
      }
    }
    return rpcUrl;
  }
}

export async function buildBurnMemoTransaction(args: BuildBurnMemoArgs): Promise<BuiltBurnTx> {
  const priorityMicrolamports = args.priorityMicrolamports ?? 2_000;
  const workingRpcUrl = await getWorkingRpcUrl(args.rpcUrl);

  // 1. Detect asset kind
  const { kind, asset } = await detectAssetKind(args.mint, workingRpcUrl);

  // 2. Set up Umi
  const umi = createUmi(workingRpcUrl);
  umi.programs.add({
    name: 'splToken',
    publicKey: publicKey(TOKEN_PROGRAM_ID.toString()),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  } as unknown as Parameters<typeof umi.programs.add>[0]);
  umi.programs.add({
    name: 'splAssociatedToken',
    publicKey: publicKey(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  } as unknown as Parameters<typeof umi.programs.add>[0]);

  const ownerPubkey = new PublicKey(args.owner);
  const ownerSigner = createNoopSigner(publicKey(ownerPubkey.toBase58()));
  umi.use(signerIdentity(ownerSigner));

  const common = {
    umi,
    asset,
    inscriptionId: args.inscriptionId,
    ownerPubkey,
    priorityMicrolamports,
    rpcUrl: workingRpcUrl,
  };

  // 3. Dispatch
  let tb;
  switch (kind.kind) {
    case 'pnft':
      tb = await buildPnftBurn({ ...common, kindInfo: kind });
      break;
    case 'regular':
      tb = await buildRegularBurn({ ...common, kindInfo: kind });
      break;
    case 'cnft':
    case 'core':
    case 'mpl-inscription':
    case 'libreplex-inscription':
      throw new NotYetImplementedError(kind.kind);
    case 'unknown':
      throw new UnsupportedStandardError(kind.daInterface);
  }

  // 4. Compile + serialize
  const conn = new Connection(workingRpcUrl, 'confirmed');
  const { blockhash } = await conn.getLatestBlockhash();

  const umiInstructions = tb.getInstructions();
  const web3JsInstructions = umiInstructions.map((ix) => toWeb3JsInstruction(ix));

  const messageV0 = new TransactionMessage({
    payerKey: ownerPubkey,
    recentBlockhash: blockhash,
    instructions: web3JsInstructions,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  const serialized = versionedTx.serialize();
  const base64Tx = Buffer.from(serialized).toString('base64');

  return {
    transaction: base64Tx,
    isVersioned: true,
    nftKind: kind.kind,
  };
}
```

- [ ] **Step 5.4: Run dispatcher tests**

Run: `pnpm jest tests/unit/dispatcher.test.ts 2>&1 | tail -10`

Expected: `Tests: 4 passed, 4 total`.

- [ ] **Step 5.5: Run all tests**

Run: `pnpm jest 2>&1 | tail -5`

Expected: existing tests still pass + 8 detection + 4 dispatcher = 12 new tests passing on top of the existing baseline.

If any existing test fails because it imports `nftType` from `BuiltBurnTx`, update it to use `nftKind`. The change is mechanical.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/local-burn/build-burn-memo-tx.ts tests/unit/dispatcher.test.ts
git commit -m "refactor(burn): build-burn-memo-tx.ts is now a dispatcher

Replaces the monolithic pNFT/regular-only burn builder with a thin
dispatcher that:
1. Calls detectAssetKind via DAS
2. Sets up Umi with the registered token programs
3. Routes to the appropriate per-standard burn builder
4. Compiles to a VersionedTransaction and returns base64

Return shape: BuiltBurnTx { transaction, isVersioned, nftKind }.
nftKind replaces the old 'PNFT' | 'REGULAR' nftType.

cNFT / Core / mpl-inscription / libreplex-inscription cases throw
NotYetImplementedError. Unknown interface throws UnsupportedStandardError.
Fungible token throws NotAnNftError (via detect.ts).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Update `/api/tx/burn-memo` route to surface new typed errors

**Files:**
- Modify: `src/app/api/tx/burn-memo/route.ts`

- [ ] **Step 6.1: Read the current route**

Read `src/app/api/tx/burn-memo/route.ts`. Find the try/catch around `buildBurnMemoTransaction`.

- [ ] **Step 6.2: Add typed-error discrimination**

After the existing catch block, before any generic error handling, add:

```ts
import {
  NotAnNftError,
  NotYetImplementedError,
  UnsupportedStandardError,
  AssetNotFoundError,
  CnftStaleProofError,
  CnftTooDeepError,
  CnftOwnershipMismatchError,
  CnftDelegatedError,
} from '@/lib/local-burn/errors';

// In the catch block:
if (err instanceof NotAnNftError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof NotYetImplementedError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof UnsupportedStandardError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof AssetNotFoundError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof CnftOwnershipMismatchError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof CnftDelegatedError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof CnftTooDeepError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 400 });
}
if (err instanceof CnftStaleProofError) {
  return NextResponse.json({ error: err.message, errorCode: err.code }, { status: 409 });
}
// Existing generic 500 handler stays last
```

The shared structure makes it possible to refactor into a single `if (err instanceof TypedError) { ... }` later; for now, explicit is clearer for the engineer reading task by task.

- [ ] **Step 6.3: TypeScript clean**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "burn-memo" | head -5`

Expected: no output.

- [ ] **Step 6.4: Smoke test the route**

Start the dev server: `pnpm dev`. In a separate terminal, run a curl with a fungible-token mint (USDC):

```bash
curl -s -X POST "http://localhost:3000/api/tx/burn-memo" \
  -H "Content-Type: application/json" \
  -d '{"mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","owner":"OWNER_WALLET_PUBKEY","inscriptionId":"6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"}' | head -10
```

Expected: HTTP 400, body includes `"errorCode":"NOT_AN_NFT"`.

Stop dev server.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/api/tx/burn-memo/route.ts
git commit -m "feat(burn-memo): surface typed errors with errorCode

Catch each typed error from build-burn-memo-tx and return user-friendly
HTTP responses with an errorCode field. Maps:
- NotAnNftError, NotYetImplementedError, UnsupportedStandardError,
  AssetNotFoundError, CnftOwnership/Delegated/TooDeep → 400
- CnftStaleProofError → 409 (retryable)
- everything else → existing generic 500

The errorCode field lets the client render a RetryButton on 409s and
show specific messaging per error class.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: PR 1 manual verification — M1 + M2

**Files:** none (verification only)

PR 1 is now complete in terms of code. Before moving to PR 2, manually verify that the regression isn't broken.

- [ ] **Step 7.1: Start dev server**

Run: `pnpm dev`. Wait for `http://localhost:3000`.

- [ ] **Step 7.2: M1 — Regular NFT teleburn**

- Connect wallet
- Enter a real regular NFT mint you own + a valid inscription ID
- Step 2: form accepts; preflight check from previous spec passes
- Step 3: simulation runs successfully; no compression badge (it's not a cNFT)
- Step 4: sign + broadcast — verify the burn lands on chain (or, if running on a fresh wallet, simulate-only verification is acceptable)

Document any unexpected behavior.

- [ ] **Step 7.3: M2 — pNFT teleburn**

Same as M1 but with a pNFT (Magic Eden / Tensor pNFT). Should behave identically — same wizard flow, no compression badge, simulate + sign work.

- [ ] **Step 7.4: Stop dev server and document results**

If M1 and M2 both pass, PR 1 is shippable. If either fails, debug — the refactor regressed something. Most likely culprits:
- PDA derivation order differs from the old Umi-fetched version
- Token account derivation isn't passing through the same params
- Compute budget changed accidentally

This is the cutpoint for PR 1. Push and verify on Vercel before continuing.

- [ ] **Step 7.5: Push PR 1**

```bash
git push origin main  # (or open a PR if you prefer)
```

Wait for Vercel deploy. Re-run M1/M2 against the production deploy. If green, proceed to Task 8 (start of PR 2).

---

## Task 8: Add dependencies for PR 2

**Files:**
- Modify: `package.json` (via `pnpm add`)

- [ ] **Step 8.1: Install Bubblegum + account compression**

Run:

```bash
pnpm add @metaplex-foundation/mpl-bubblegum @solana/spl-account-compression
```

- [ ] **Step 8.2: Verify versions compatible**

Run: `pnpm install` (should be a no-op after add but confirms lock).

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "version|conflict" | head -5`

Expected: no output. If there's a peer-dep complaint about Umi versions, pin to the version range that matches existing `@metaplex-foundation/mpl-token-metadata`.

- [ ] **Step 8.3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add @metaplex-foundation/mpl-bubblegum + @solana/spl-account-compression

For cNFT (Bubblegum) burn path in upcoming Task 10. Bubblegum provides
the Umi-flavored burn instruction; spl-account-compression provides
ConcurrentMerkleTreeAccount for canopy depth parsing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: `cnft-proof.ts` — DAS proof fetch + canopy depth

**Files:**
- Create: `src/lib/local-burn/cnft-proof.ts`
- Create: `tests/unit/cnft-proof.test.ts`
- Create: `tests/fixtures/das-cnft-proof.json`

- [ ] **Step 9.1: Record the proof fixture**

Using the same cNFT used in `tests/fixtures/das-cnft.json`:

```bash
curl -s "$NEXT_PUBLIC_SOLANA_RPC" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"getAssetProof","params":{"id":"<CNFT_ASSET_ID>"}}' \
  | jq '.result' > tests/fixtures/das-cnft-proof.json
```

If you can't reach mainnet, construct a synthetic proof: `{ root: "<base58>", proof: ["pubkey1", ...], node_index: <N>, leaf: "<base58>", tree_id: "<base58>" }` with 14-20 proof entries.

- [ ] **Step 9.2: Write the failing test**

Create `tests/unit/cnft-proof.test.ts`:

```ts
import { PublicKey } from '@solana/web3.js';
import { fetchAssetProof, fetchTreeCanopyDepth, sliceProof } from '@/lib/local-burn/cnft-proof';
import dasCnftProof from '../fixtures/das-cnft-proof.json';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';

describe('cnft-proof', () => {
  beforeEach(() => fetchMock.mockReset());

  describe('fetchAssetProof', () => {
    it('returns the DAS proof for a cNFT', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ jsonrpc: '2.0', id: '1', result: dasCnftProof }),
      });

      const assetId = new PublicKey('11111111111111111111111111111111');
      const proof = await fetchAssetProof(assetId, RPC_URL);
      expect(proof.root).toBeDefined();
      expect(Array.isArray(proof.proof)).toBe(true);
    });

    it('throws on DAS HTTP error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) });
      const assetId = new PublicKey('11111111111111111111111111111111');
      await expect(fetchAssetProof(assetId, RPC_URL)).rejects.toThrow(/500/);
    });
  });

  describe('sliceProof', () => {
    it('slices off canopy nodes from the END of the proof', () => {
      const proof = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      // canopy depth 3 means top 3 nodes are stored on-chain
      const sliced = sliceProof(proof, 3);
      expect(sliced.length).toBe(5);
      expect(sliced).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('returns full proof when canopy depth is 0', () => {
      const proof = ['a', 'b', 'c', 'd'];
      expect(sliceProof(proof, 0)).toEqual(proof);
    });

    it('returns empty when canopy depth equals proof length', () => {
      const proof = ['a', 'b', 'c'];
      expect(sliceProof(proof, 3)).toEqual([]);
    });
  });
});
```

Note: `fetchTreeCanopyDepth` is harder to test in isolation (it reads a real on-chain account). We test the parsing logic indirectly via `sliceProof`; the on-chain fetch is exercised in the cnft-burn integration smoke tests.

- [ ] **Step 9.3: Run test to verify it fails**

Run: `pnpm jest tests/unit/cnft-proof.test.ts 2>&1 | tail -10`

Expected: `Cannot find module '@/lib/local-burn/cnft-proof'`.

- [ ] **Step 9.4: Create `src/lib/local-burn/cnft-proof.ts`**

```ts
/**
 * cNFT proof fetching + canopy depth + slicing.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §5.3-§5.4
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { ConcurrentMerkleTreeAccount } from '@solana/spl-account-compression';
import type { Umi } from '@metaplex-foundation/umi';

export interface AssetProof {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: string;
}

export async function fetchAssetProof(
  assetId: PublicKey,
  rpcUrl: string,
): Promise<AssetProof> {
  const body = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getAssetProof',
    params: { id: assetId.toBase58() },
  };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DAS getAssetProof HTTP ${res.status}`);
  }

  const env = await res.json();
  return env.result as AssetProof;
}

export async function fetchTreeCanopyDepth(
  treePubkey: PublicKey,
  _umi: Umi,
  rpcUrl?: string,
): Promise<number> {
  // _umi is part of the uniform signature but we use a raw web3 Connection
  // here because @solana/spl-account-compression's parser takes a Connection.
  const conn = new Connection(rpcUrl ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
  const account = await ConcurrentMerkleTreeAccount.fromAccountAddress(conn, treePubkey);
  return account.getCanopyDepth();
}

/**
 * Slice off canopy nodes from the end of the proof.
 * Bubblegum's burn instruction only needs the proof nodes NOT covered
 * by the on-chain canopy.
 */
export function sliceProof(proof: string[], canopyDepth: number): string[] {
  if (canopyDepth <= 0) return [...proof];
  if (canopyDepth >= proof.length) return [];
  return proof.slice(0, proof.length - canopyDepth);
}
```

- [ ] **Step 9.5: Run test to verify it passes**

Run: `pnpm jest tests/unit/cnft-proof.test.ts 2>&1 | tail -10`

Expected: `Tests: 5 passed, 5 total`.

- [ ] **Step 9.6: Commit**

```bash
git add src/lib/local-burn/cnft-proof.ts tests/unit/cnft-proof.test.ts tests/fixtures/das-cnft-proof.json
git commit -m "feat(cnft): proof fetching + canopy depth + slicing helpers

Three helpers in cnft-proof.ts:
- fetchAssetProof: POSTs DAS getAssetProof, returns root/proof/etc
- fetchTreeCanopyDepth: reads the tree account header via
  ConcurrentMerkleTreeAccount from @solana/spl-account-compression
- sliceProof: trims canopy nodes from the end of the proof array

The Bubblegum burn instruction only needs proof nodes NOT covered by
the on-chain canopy, so we slice. Most trees have canopy >= 10 which
keeps tx size well under 1232 bytes; deeper trees with canopy 0 hit
the size limit and trigger CnftTooDeepError in cnft-burn.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: `cnft-burn.ts` — main cNFT burn builder

**Files:**
- Create: `src/lib/local-burn/cnft-burn.ts`
- Create: `tests/unit/cnft-burn.test.ts`

- [ ] **Step 10.1: Write the failing test**

Create `tests/unit/cnft-burn.test.ts`:

```ts
import { PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { buildCnftBurn } from '@/lib/local-burn/cnft-burn';
import {
  CnftOwnershipMismatchError,
  CnftDelegatedError,
  CnftTooDeepError,
} from '@/lib/local-burn/errors';
import type { DasAsset, NftKind } from '@/lib/local-burn/types';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';

const OWNER = new PublicKey('FaucetOwner111111111111111111111111111111111');
const NOT_OWNER = 'NotOwner1111111111111111111111111111111111';
const ASSET_ID = 'AssetId1111111111111111111111111111111111111';
const TREE = 'Tree1111111111111111111111111111111111111111';

function makeAsset(ownerPubkey: string, delegate: string | null = null): DasAsset {
  return {
    id: ASSET_ID,
    interface: 'V1_NFT',
    ownership: { owner: ownerPubkey, delegate, ownership_model: 'single' },
    content: { metadata: { name: 'Test cNFT' } },
    compression: { compressed: true, tree: TREE, leaf_id: 0, data_hash: 'aabb', creator_hash: 'ccdd' },
  };
}

function makeKindInfo(): Extract<NftKind, { kind: 'cnft' }> {
  return {
    kind: 'cnft',
    assetId: new PublicKey(ASSET_ID),
    tree: new PublicKey(TREE),
    leafIndex: 0,
    dataHash: 'aabb',
    creatorHash: 'ccdd',
  };
}

describe('buildCnftBurn pre-flight checks', () => {
  beforeEach(() => fetchMock.mockReset());

  it('throws CnftOwnershipMismatchError when DAS owner != signer', async () => {
    const umi = createUmi(RPC_URL);
    await expect(buildCnftBurn({
      umi,
      asset: makeAsset(NOT_OWNER), // DAS says NotOwner
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER, // signer says Owner
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    })).rejects.toBeInstanceOf(CnftOwnershipMismatchError);
  });

  it('throws CnftDelegatedError when active delegate is different from owner', async () => {
    const umi = createUmi(RPC_URL);
    await expect(buildCnftBurn({
      umi,
      asset: makeAsset(OWNER.toBase58(), 'Delegate111111111111111111111111111111111111'),
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER,
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    })).rejects.toBeInstanceOf(CnftDelegatedError);
  });

  it('proceeds when delegate equals owner (no-op delegate)', async () => {
    // This test verifies that a delegate === owner case doesn't throw.
    // We mock fetchAssetProof + fetchTreeCanopyDepth to short-circuit the rest.
    jest.mock('@/lib/local-burn/cnft-proof', () => ({
      fetchAssetProof: jest.fn().mockResolvedValue({
        root: 'Root1111111111111111111111111111111111111111',
        proof: Array(10).fill('Pubkey11111111111111111111111111111111111111'),
        node_index: 0, leaf: 'leaf', tree_id: TREE,
      }),
      fetchTreeCanopyDepth: jest.fn().mockResolvedValue(10),
      sliceProof: (p: string[], _c: number) => p.slice(0, 0), // canopy >= proof length
    }));

    const umi = createUmi(RPC_URL);
    // Don't actually attempt the burn build (would need extensive Umi mocking);
    // we're just verifying the pre-flight passes the delegate=owner case.
    const result = buildCnftBurn({
      umi,
      asset: makeAsset(OWNER.toBase58(), OWNER.toBase58()),
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER,
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    });

    // It will fail at the actual burn build (no real RPC), but NOT with a
    // delegate/ownership error.
    await expect(result).rejects.not.toBeInstanceOf(CnftDelegatedError);
    await expect(result).rejects.not.toBeInstanceOf(CnftOwnershipMismatchError);
  });

  it('throws CnftTooDeepError when proof+overhead exceeds 1232 bytes', async () => {
    // Mock helpers to return a huge proof
    jest.doMock('@/lib/local-burn/cnft-proof', () => ({
      fetchAssetProof: jest.fn().mockResolvedValue({
        root: 'Root1111111111111111111111111111111111111111',
        proof: Array(40).fill('Pubkey11111111111111111111111111111111111111'),
        node_index: 0, leaf: 'leaf', tree_id: TREE,
      }),
      fetchTreeCanopyDepth: jest.fn().mockResolvedValue(0),
      sliceProof: (p: string[], _c: number) => p,
    }));

    // Re-import after the mock
    const { buildCnftBurn: buildCnftBurn2 } = await import('@/lib/local-burn/cnft-burn');
    const umi = createUmi(RPC_URL);
    await expect(buildCnftBurn2({
      umi,
      asset: makeAsset(OWNER.toBase58()),
      kindInfo: makeKindInfo(),
      inscriptionId: 'inscid',
      ownerPubkey: OWNER,
      priorityMicrolamports: 2000,
      rpcUrl: RPC_URL,
    })).rejects.toBeInstanceOf(CnftTooDeepError);

    jest.dontMock('@/lib/local-burn/cnft-proof');
  });
});

describe('estimateCnftBurnSize', () => {
  it('exposes a heuristic estimator', async () => {
    const { estimateCnftBurnSize } = await import('@/lib/local-burn/cnft-burn');
    expect(estimateCnftBurnSize(0)).toBeGreaterThanOrEqual(280);
    expect(estimateCnftBurnSize(20)).toBeGreaterThan(estimateCnftBurnSize(0));
    // 30 proof nodes (32 bytes each = 960) + base 280 = 1240 (over the 1232 limit)
    expect(estimateCnftBurnSize(30)).toBeGreaterThan(1232);
  });
});
```

Note: cNFT burn tests are deliberately pre-flight-focused. Full integration of the burn instruction would require real Umi + mpl-bubblegum runtime which is hard to mock cleanly. The integration is verified manually via M3 in Task 14.

- [ ] **Step 10.2: Run test to verify it fails**

Run: `pnpm jest tests/unit/cnft-burn.test.ts 2>&1 | tail -10`

Expected: `Cannot find module '@/lib/local-burn/cnft-burn'`.

- [ ] **Step 10.3: Create `src/lib/local-burn/cnft-burn.ts`**

```ts
/**
 * cNFT burn path. Uses @metaplex-foundation/mpl-bubblegum for the burn
 * instruction and DAS getAssetProof for the Merkle proof.
 * See: docs/superpowers/specs/2026-05-19-cnft-burn-and-asset-foundation-design.md §5
 */

import { PublicKey } from '@solana/web3.js';
import { burn as bubblegumBurn } from '@metaplex-foundation/mpl-bubblegum';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { transactionBuilder, publicKey, createNoopSigner, type Umi, type TransactionBuilder } from '@metaplex-foundation/umi';
import { withSplMemoString } from './ix-helpers';
import { buildRetireMemo } from './memo';
import { fetchAssetProof, fetchTreeCanopyDepth, sliceProof } from './cnft-proof';
import {
  CnftOwnershipMismatchError,
  CnftDelegatedError,
  CnftTooDeepError,
} from './errors';
import type { DasAsset, NftKind } from './types';

const CNFT_BURN_COMPUTE_UNITS = 300_000;
const MAX_TX_SIZE = 1232;
const BASE_TX_BYTES = 280;
const PER_PROOF_NODE_BYTES = 32;

export function estimateCnftBurnSize(slicedProofLength: number): number {
  return BASE_TX_BYTES + slicedProofLength * PER_PROOF_NODE_BYTES;
}

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

  // Fetch fresh proof
  const proof = await fetchAssetProof(args.kindInfo.assetId, args.rpcUrl);

  // Determine canopy depth and slice
  const canopyDepth = await fetchTreeCanopyDepth(args.kindInfo.tree, args.umi, args.rpcUrl);
  const slicedProof = sliceProof(proof.proof, canopyDepth);

  // Pre-flight: tx size
  const estimatedSize = estimateCnftBurnSize(slicedProof.length);
  if (estimatedSize > MAX_TX_SIZE) {
    throw new CnftTooDeepError(args.kindInfo.tree.toBase58(), slicedProof.length, estimatedSize);
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
      proof: slicedProof.map(p => publicKey(p)),
    }),
  );

  // Memo
  const memo = buildRetireMemo({ inscriptionId: args.inscriptionId });
  tb = withSplMemoString(tb, memo);

  return tb;
}
```

- [ ] **Step 10.4: Run test to verify it passes**

Run: `pnpm jest tests/unit/cnft-burn.test.ts 2>&1 | tail -10`

Expected: `Tests: 5 passed, 5 total`.

If the "delegate=owner doesn't throw delegate/ownership" test fails because of jest module-mocking quirks, the test can be simplified to just verify the assertion via spy on the throw type. The important behavior to confirm: ownership and delegate pre-checks correctly gate the function.

- [ ] **Step 10.5: TypeScript clean**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "cnft" | head -5`

Expected: no output.

- [ ] **Step 10.6: Commit**

```bash
git add src/lib/local-burn/cnft-burn.ts tests/unit/cnft-burn.test.ts
git commit -m "feat(cnft): buildCnftBurn with pre-flight + Bubblegum burn

Three pre-flight checks before tx construction:
1. ownership match (DAS owner === signer)
2. no active non-owner delegate
3. estimated tx size <= 1232 bytes (else CnftTooDeepError)

Tx construction: setComputeUnitLimit(300k) + setComputeUnitPrice +
bubblegumBurn(merkleTree, root, dataHash, creatorHash, nonce, index,
sliced proof) + withSplMemoString(teleburn:<inscriptionId>).

Single-tx atomicity matches the v1.0 teleburn protocol §3.2.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Wire cNFT into the dispatcher

**Files:**
- Modify: `src/lib/local-burn/build-burn-memo-tx.ts`

- [ ] **Step 11.1: Add the cNFT import and case**

In `src/lib/local-burn/build-burn-memo-tx.ts`:

- Add the import at the top with the other burn-builder imports:
  ```ts
  import { buildCnftBurn } from './cnft-burn';
  ```

- Update the switch to wire the `cnft` case:
  ```ts
  switch (kind.kind) {
    case 'pnft':
      tb = await buildPnftBurn({ ...common, kindInfo: kind });
      break;
    case 'regular':
      tb = await buildRegularBurn({ ...common, kindInfo: kind });
      break;
    case 'cnft':
      tb = await buildCnftBurn({ ...common, kindInfo: kind });
      break;
    case 'core':
    case 'mpl-inscription':
    case 'libreplex-inscription':
      throw new NotYetImplementedError(kind.kind);
    case 'unknown':
      throw new UnsupportedStandardError(kind.daInterface);
  }
  ```

- [ ] **Step 11.2: Update the dispatcher test**

The existing `dispatcher.test.ts` from Task 5 has a test asserting cnft throws `NotYetImplementedError`. Update that test to verify cnft now ROUTES to the builder rather than throwing — but the test still won't successfully build a real tx (it would need Umi mocking). So change the assertion to verify the *type of error* changes from `NotYetImplementedError` to either an `Cnft*Error` (pre-flight failure with the synthetic DAS fixture) or a network error from the proof fetch.

```ts
it('routes cnft to buildCnftBurn (no longer NotYetImplementedError)', async () => {
  mockDasResponse(dasCnft);
  // Mock the proof fetch too — it'll be the second fetch call
  fetchMock.mockResolvedValueOnce({
    ok: false, status: 500, headers: new Headers(), json: async () => ({}),
  });
  await expect(
    buildBurnMemoTransaction({
      rpcUrl: RPC_URL,
      mint: 'cnft-test',
      owner: OWNER,
      inscriptionId: INSCRIPTION,
      priorityMicrolamports: 2000,
    })
  ).rejects.not.toBeInstanceOf(NotYetImplementedError);
});
```

- [ ] **Step 11.3: Run tests**

Run: `pnpm jest tests/unit/dispatcher.test.ts tests/unit/cnft-burn.test.ts 2>&1 | tail -10`

Expected: all pass.

- [ ] **Step 11.4: TypeScript clean**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "local-burn" | head -5`

Expected: no output.

- [ ] **Step 11.5: Commit**

```bash
git add src/lib/local-burn/build-burn-memo-tx.ts tests/unit/dispatcher.test.ts
git commit -m "feat(cnft): wire cnft case into the dispatcher

The dispatcher now routes 'cnft' to buildCnftBurn instead of throwing
NotYetImplementedError. core / mpl-inscription / libreplex-inscription
still throw NotYetImplementedError until their own sub-specs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Add `nftKind` to `DryRunReport` + simulate route

**Files:**
- Modify: `src/lib/dry-run.ts`
- Modify: `src/app/api/tx/simulate/route.ts` (likely no change — it just forwards the report)

- [ ] **Step 12.1: Read the current DryRunReport**

Read `src/lib/dry-run.ts` and find the `DryRunReport` type. Find where the burn-memo result is consumed (where `nftType` was used).

- [ ] **Step 12.2: Add `nftKind` field**

In `DryRunReport`:
```ts
export interface DryRunReport {
  // ... existing fields ...
  nftKind: NftKind['kind'];   // NEW: 'regular' | 'pnft' | 'cnft' | 'core' | 'mpl-inscription' | 'libreplex-inscription' | 'unknown'
}
```

Update the `import` line to bring in `NftKind`:
```ts
import type { NftKind } from './local-burn/types';
```

Find where the report is constructed. Replace any `nftType: ...` with `nftKind: burnResult.nftKind` (the dispatcher's return shape now has `nftKind`).

- [ ] **Step 12.3: Verify simulate route still compiles**

Read `src/app/api/tx/simulate/route.ts`. It likely just returns the report shape. If there's a type assertion or interface that lists only `nftType: 'PNFT' | 'REGULAR'`, update it to `nftKind: NftKind['kind']`.

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(dry-run|simulate)" | head -10`

Expected: no output.

- [ ] **Step 12.4: Smoke test**

Start dev server `pnpm dev`. Hit `/api/tx/simulate` with a real cNFT mint via curl:

```bash
curl -s -X POST "http://localhost:3000/api/tx/simulate" \
  -H "Content-Type: application/json" \
  -d '{"mint":"<CNFT_ASSET_ID>","owner":"<OWNER>","inscriptionId":"6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"}' \
  | jq '.report.nftKind'
```

Expected: `"cnft"`.

Stop dev server.

- [ ] **Step 12.5: Commit**

```bash
git add src/lib/dry-run.ts src/app/api/tx/simulate/route.ts
git commit -m "feat(simulate): DryRunReport.nftKind replaces nftType

Surfaces the detected asset standard to the client. Supports the 7
NftKind variants (the old 2 + 5 forward-looking). The wizard's Step 3
will use this to render the compression badge for cNFTs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Step3Preview compression badge

**Files:**
- Modify: `src/components/wizard/Step3Preview.tsx`

- [ ] **Step 13.1: Read the current Step3Preview**

Find where the report is rendered. The preview area should already have an NFT title/image. Identify a good insertion point for the badge (near the title is typical).

- [ ] **Step 13.2: Add the compression badge**

```tsx
{report?.nftKind === 'cnft' && (
  <span
    title="Stored as a Merkle tree leaf — same teleburn protocol, same on-chain memo, same verification."
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      marginLeft: 8,
      fontSize: 11,
      border: '1px solid currentColor',
      borderRadius: 12,
      opacity: 0.8,
    }}
  >
    🌳 Compressed NFT
  </span>
)}
```

Place it inline with the NFT title (typically a `<h2>` or `<div className="nft-name">`). The exact placement is a judgment call — adjacent to the title is the usual placement.

- [ ] **Step 13.3: TypeScript clean**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "Step3Preview" | head -5`

Expected: no output.

- [ ] **Step 13.4: Commit**

```bash
git add src/components/wizard/Step3Preview.tsx
git commit -m "feat(cnft-ui): compression badge in Step3Preview

Renders a small '🌳 Compressed NFT' pill alongside the NFT title when
report.nftKind === 'cnft'. Tooltip explains that cNFTs use the same
teleburn protocol. Informational only — does not affect any gates.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Error UX in TeleburnForm + Step3Preview

**Files:**
- Modify: `src/components/teleburn/TeleburnForm.tsx`
- Modify: `src/components/wizard/Step3Preview.tsx`

- [ ] **Step 14.1: Add error-code handling in TeleburnForm**

In TeleburnForm's submit handler, when the burn-memo API returns an error:

```ts
const body = await response.json();
if (!response.ok) {
  const code = body.errorCode as string | undefined;
  switch (code) {
    case 'NOT_AN_NFT':
      setError("That mint isn't an NFT — looks like a fungible token. Teleburn only supports NFTs.");
      break;
    case 'NOT_YET_IMPLEMENTED':
      setError("That asset standard isn't supported yet. Coming soon: Core, MPL Inscriptions, LibrePlex.");
      break;
    case 'UNSUPPORTED_STANDARD':
      setError("Unrecognized asset standard. KILN supports regular, programmable, and compressed NFTs.");
      break;
    case 'ASSET_NOT_FOUND':
      setError("Asset not found. Check the mint address.");
      break;
    case 'CNFT_DELEGATED':
      setError("This cNFT has an active delegate. Revoke delegation before burning.");
      break;
    case 'CNFT_OWNERSHIP_MISMATCH':
      setError("Connected wallet doesn't own this cNFT (it may have been transferred).");
      break;
    case 'CNFT_TOO_DEEP':
      setError("This cNFT's tree is unsupported (proof too large for one transaction). Address Lookup Tables planned for a future release.");
      break;
    default:
      setError(body.error || `HTTP ${response.status}`);
  }
  return;
}
```

(`setError` and the exact state variable names depend on the existing form — adapt to the codebase's pattern.)

- [ ] **Step 14.2: Add retry handling for `CNFT_STALE_PROOF` in Step3Preview / Step4Execute**

The `CNFT_STALE_PROOF` error is retryable. Wherever the burn-memo response is consumed (likely Step4Execute when it tries to broadcast):

```ts
if (body.errorCode === 'CNFT_STALE_PROOF') {
  setError("Tree state changed mid-sign. Click Retry to fetch a fresh proof.");
  setRetryable(true);
}
```

Show the Retry button when `retryable === true`; otherwise hide it.

- [ ] **Step 14.3: TypeScript clean**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(TeleburnForm|Step[34])" | head -5`

Expected: no output.

- [ ] **Step 14.4: Commit**

```bash
git add src/components/teleburn/TeleburnForm.tsx src/components/wizard/Step3Preview.tsx
git commit -m "feat(cnft-ui): typed error messages in TeleburnForm + retry button

Maps errorCode values to user-friendly messages:
- NOT_AN_NFT, NOT_YET_IMPLEMENTED, UNSUPPORTED_STANDARD, ASSET_NOT_FOUND
- CNFT_DELEGATED, CNFT_OWNERSHIP_MISMATCH, CNFT_TOO_DEEP
- CNFT_STALE_PROOF: shows Retry button (retryable error)

All other errors fall through to the existing generic message.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Manual test plan — M3 through M7

**Files:** none (verification only)

- [ ] **Step 15.1: Start dev server**

Run: `pnpm dev`.

- [ ] **Step 15.2: M3 — cNFT happy path**

Use a cNFT you own (Solana Mobile sticker, DRiP, FFF airdrop, etc.) where Helius DAS shows you as owner.

- Connect wallet → enter cNFT asset ID + inscription ID
- Step 2: form accepts; preflight passes
- Step 3: simulation runs; **compression badge appears**; tx ready for sign
- Step 4: sign + broadcast → cNFT burn confirms on chain

- [ ] **Step 15.3: M4 — cNFT with active delegate**

Find or set up a cNFT where you've delegated to another address. (If you don't have one, skip — note in the test results.)

- Expected: TeleburnForm rejects on submit with `CNFT_DELEGATED` message.

- [ ] **Step 15.4: M5 — cNFT after transfer**

Transfer a cNFT to another wallet, then try to teleburn it from the original wallet.

- Expected: Step 3 (or Step 4) surfaces `CNFT_OWNERSHIP_MISMATCH`.

- [ ] **Step 15.5: M6 — Core NFT**

Enter a real Core asset ID.

- Expected: TeleburnForm submit fails with `NOT_YET_IMPLEMENTED` for 'core'.

- [ ] **Step 15.6: M7 — Fungible token**

Enter USDC mint (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).

- Expected: TeleburnForm submit fails with `NOT_AN_NFT`.

- [ ] **Step 15.7: Document results**

If any test misbehaves, debug or open an issue. Once M3 passes (the only cNFT happy-path test), the feature ships. M4/M5/M6/M7 verify the error surfaces work; failures are non-blocking but worth a follow-up commit.

- [ ] **Step 15.8: Push PR 2**

```bash
git push origin main
```

Wait for Vercel deploy. Run M3 against the production deploy as a final sanity check.

---

## Final verification

- [ ] **F.1: All tests pass**

Run: `pnpm jest 2>&1 | tail -5`

Expected: existing tests (40 inscription-preflight + others) + 8 detection + 4 dispatcher + 5 cnft-proof + 5 cnft-burn = at least 62 new + existing baseline, all passing.

- [ ] **F.2: TypeScript clean across src/**

Run: `pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "^src/" | head -10`

Expected: no output.

- [ ] **F.3: Production build**

Run: `pnpm build 2>&1 | tail -20`

Expected: build succeeds.

---

## Notes for the executor

- **Two-PR rollout**: Tasks 1-7 form PR 1 (foundation refactor, no new functionality). Tasks 8-15 form PR 2 (cNFT support). PR 1 must be deployed and regression-tested (M1, M2) before starting PR 2.
- **Test fixtures**: Tasks 2 and 9 ask you to record real DAS responses. If you can't reach mainnet, synthetic fixtures work but document the deviation.
- **Burn instruction wiring**: the existing pNFT/regular burn ix construction must stay line-for-line identical after the refactor. The data source changes (pre-fetched DAS asset vs. self-fetched Umi digital asset); the ix doesn't.
- **`@solana/spl-account-compression` connection**: the existing project uses Umi extensively. The canopy parser uses raw web3.js Connection. Both are fine; just be aware they're different layers.
- **DAS rate limits**: Helius has rate limits. For production, the dispatcher's detection + proof calls eat 2 RPC credits per burn. Document if needed for capacity planning.
- **If a step's expected output differs**, STOP. Investigate. Don't paper over it. The most common cause is a DAS field-name discrepancy between the synthetic fixture and the real response — fix both together.
