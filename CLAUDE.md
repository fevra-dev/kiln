# kiln — project instructions

**Kiln is a teleburn protocol: it permanently migrates a Solana NFT to a Bitcoin Ordinals
inscription, leaving on-chain proof of the migration.** Burning the Solana asset and writing the
proof memo happen in **one atomic transaction**. There is **no on-chain program** — everything is
client-side transaction building (Next.js API routes + Umi/web3.js) verified against Helius DAS.
The user connects a wallet and signs; Kiln never touches private keys.

## Protocol (v1.0 — canonical)

- **Memo format:** `teleburn:<inscription_id>` — a single SPL-Memo string, ~78 bytes.
  `inscription_id` = 64 hex chars + `i` + index (e.g. `abc…799i0`). Built/parsed in `src/lib/teleburn.ts`.
- **Atomicity:** memo instruction rides in the *same* transaction as the burn, so the tx signature
  *is* the proof and blockTime/slot *is* the timestamp. No separate seal/retire steps.
- **Legacy (parse-only, do not emit):** v0.1.x JSON seal/retire memos and the `kiln:` prefix are
  still *parsed* for back-compat (`parseAnyTeleburnMemo`), but v1.0 only ever *writes* `teleburn:`.
  The old JSON "Standard" (SHA-256 derived off-curve owner, domain-separation salt, temporal
  anchoring) is **removed from the write path** — see the header of `teleburn.ts`.

## Architecture — the burn path

`TeleburnForm` → `POST /api/tx/burn-memo` → `buildBurnMemoTransaction` (`src/lib/local-burn/build-burn-memo-tx.ts`),
a **thin dispatcher**:

1. `detectAssetKind(mint, rpcUrl)` (`detect.ts`) — Helius DAS `getAsset`, returns an `NftKind`
   discriminated union + raw `DasAsset`. **No caching** (asset state is mutable, unlike inscriptions).
2. `switch (kind.kind)` routes to a per-standard builder with a uniform signature; each owns its
   whole tx (burn ix + `teleburn:` memo + compute budget) and returns a Umi `TransactionBuilder`.
3. Compile → `VersionedTransaction` → base64 → client signs & broadcasts.

**Asset support matrix** (`NftKind`, `src/lib/local-burn/types.ts`):

| kind | status | burn path |
|---|---|---|
| `regular` | ✅ | Token Metadata `burnV1` (`regular-burn.ts`) |
| `pnft` | ✅ | Token Metadata `burnV1` (`pnft-burn.ts`) |
| `cnft` | ✅ | Bubblegum `burn` + DAS proof + canopy slice (`cnft-burn.ts`, `cnft-proof.ts`) |
| `core` | ⛔ `NotYetImplementedError` | sub-spec 2 |
| `mpl-inscription` | ⛔ `NotYetImplementedError` | sub-spec 3 |
| `libreplex-inscription` | ⛔ `NotYetImplementedError` | sub-spec 4 |
| `unknown` | ⛔ `UnsupportedStandardError` | — |

The switch is exhaustive — adding an `NftKind` variant without a case is a TypeScript error.
Fungibles throw `NotAnNftError`. Typed errors (`src/lib/local-burn/errors.ts`) map to HTTP
400/409/500 in the route and to user-facing copy + a retry button (`CNFT_STALE_PROOF` is retryable).

**cNFT specifics** (last session's work, built with obra superpowers): cNFTs have no mint account —
they're Merkle-tree leaves. Detection extracts `tree`/`leafIndex`/`dataHash`/`creatorHash`; the
builder fetches a fresh `getAssetProof`, slices off the on-chain canopy, guards tx size ≤ 1232 B
(`CnftTooDeepError`), and pre-checks owner + delegate. v1 = owner-only, no ALTs, no batch. UI shows
a "🌳 Compressed NFT" badge in Step 3 via `DryRunReport.nftKind`. Design + plan live in
`docs/superpowers/specs|plans/2026-05-19-cnft-burn-and-asset-foundation-*.md`.

## Safety invariants (never violate)

- Never handle, store, or log private keys. Never auto-sign — the connecting wallet signs.
- Every burn is **decode → simulate (`/api/tx/simulate`, dry-run) → disclose → confirm** before signature.
- Fail closed on detection/proof ambiguity (ADR-0005). Sanitize untrusted DAS/RPC bytes before use (ADR-0006).

## Stack & conventions

- Next.js 14 (App Router), React 18, TypeScript **strict** (no `any` in exports), Tailwind, Zod for all external input.
- Solana: `@solana/web3.js`, `@metaplex-foundation/umi`, `mpl-token-metadata`, `mpl-bubblegum`,
  `@solana/spl-account-compression` (**patched** via `pnpm.patchedDependencies` — see `patches/`; a
  broken `exports` field is also aliased in `next.config.js`).
- RPC is **Helius** (DAS); public endpoints are 401/403 fallbacks only.
- **Package manager is pnpm@8.15.1** — use `pnpm`, never `npm` (npm crashes on the patch protocol).
  Tests: `pnpm test` (Jest unit/integration, Playwright e2e). Types: `pnpm type-check`.

## README canon (was ambiguous — resolved)

- **`README.md` (root) is authoritative** for the protocol (v1.0). `README-kiln.md` is a byte-identical duplicate.
- **`public/README.md` is stale** — it documents the superseded v0.1.1 JSON "Standard". Do not treat it as current.
- All three READMEs predate the multi-standard dispatch + cNFT work; **this file is the current source of truth** for architecture.

## Harness (ADR-governed)

Read `/adr` before writing or modifying code; treat each `NNNN-*.md` as a hard constraint that
overrides defaults. A new architectural/security/dependency decision → a new ADR from
`adr/TEMPLATE.md`, grilled with a threat-model, then enforced.

**Pre-push gate:** `.githooks/lint-gate.sh` — Oxlint → Biome → Trivy → Semgrep → dependency-cruiser
→ Sigma → redact; each stage self-skips if its config/tool is absent. Lint/format tools are pinned
as devDeps (ADR-0001) via `pnpm add -D oxlint @biomejs/biome eslint-plugin-oxlint dependency-cruiser`.
The redact stage (ADR-0011) scrubs agent-written `.audit/` reports of secrets/PII via the global
`~/.claude/scripts/redact.py`; it self-skips when there's no `.audit/`.

Operator profile + global conventions: `~/Apps/WORKFLOW/OPERATOR.md`, `STACK.md`, `HARNESS.md`.
