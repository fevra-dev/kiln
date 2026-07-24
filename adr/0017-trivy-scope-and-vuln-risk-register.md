# ADR-0017 — Trivy dependency-scan scoping & vulnerability risk register

**Status:** Accepted · **Date:** 2026-07-23
**Supersedes:** — · **Superseded-by:** — · **Refines:** ADR-0001 (Zero-Trust Dependencies)
**Threat-model:** grilled 2026-07-23 (8 vectors; mitigations folded into §Security Considerations & Limitations) · **Sign-off:** operator, 2026-07-23

## Context
ADR-0001 wires `trivy fs --scanners vuln,secret,license` into the pre-push gate and fails the push on any finding. First run against kiln surfaced **65 vuln findings (4 CRITICAL, 61 HIGH) + 3 license** and blocks every push. Triage:

- **3 vulns are a vendored Ruby `Gemfile.lock` inside `@solana`/`@stellar` node_modules** (`activesupport`, `concurrent-ruby`). Not kiln's runtime, not in the shipped bundle — pure false positives from filesystem traversal. Scoping trivy to the pnpm lockfile removes all 3.
- **62 vulns are in the pnpm dependency graph, but only `next` is a *direct* dependency.** The other 60 are transitive (`@solana/wallet-adapter-*`, `react-native`, `@stellar/*` chains): `axios`, `lodash`, `ws`, `node-forge`, `protobufjs`, `shell-quote`, `form-data`, `js-yaml`, `jws`, `minimatch`, … kiln cannot unilaterally bump them; the fix must come from the parent package.
- `--ignore-unfixed` removes only **1** of 62 — 61 have an upstream "fixed version," but for transitive deps that is not a kiln-actionable lever.
- The one direct-dep vuln, `next` **CVE-2026-44573** (middleware information disclosure, HIGH), is fixed only in **Next 15.5.16 / 16.2.5** — a major, breaking upgrade.
- 3 CRITICALs (`protobufjs` CVE-2026-41242, `shell-quote` CVE-2026-9277, …) are all transitive.

A gate that is permanently red on 60+ unactionable upstream vulns trains developers to `git push --no-verify`, which disables the **entire** gate — oxlint, biome, secret-scan, license — a strictly worse security posture than an honest, scoped gate. **A gate that is always red is a gate that is ignored.**

## Decision
1. **Scope is per-scanner, not uniform.** **Vuln** scanning targets the dependency graph (`pnpm-lock.yaml`) — foreign-ecosystem manifests vendored in `node_modules` are out of scope. **License** scanning runs against the **full filesystem** (`fs .`, *including* `node_modules` — that is where real `LICENSE` files live; verified that `--skip-dirs node_modules` and lockfile-only both detect **zero** license findings, so the full-tree scan is the only working control) (grill #5). **Secret** scanning is filesystem-scoped (minus `node_modules` for FP noise) and fail-closed.
2. **Fail condition.** The gate MUST fail on any HIGH/CRITICAL vuln — or `forbidden`/`restricted` license — that is **not** present in the version-controlled risk register `.trivyignore.yaml`.
3. **Register discipline.** Every register entry MUST carry: the CVE id, a `statement` recording `direct|transitive` + why it is accepted (no upstream fix · not kiln-reachable · breaking-bump-deferred), and an `expired_at` review date. Entries **expire** — on expiry trivy re-flags them, forcing re-triage. The register is append-only; entries are removed only when the underlying dep is fixed, never to silence a live finding.
4. **Expiry is hard-capped and fails (never warns).** `expired_at` MUST be ≤ **30 days** for `direct:` entries and ≤ **90 days** for `transitive:` entries; the hygiene check *fails* the gate on any entry over its cap or already past `expired_at` (grill #7). A direct-dep HIGH/CRITICAL MUST be remediated by upgrade or accepted under the 30-day cap with a tracked follow-up. Seed: `next` CVE-2026-44573 accepted pending the Next 15/16 major upgrade, review **2026-08-22**.
5. **Reachability at seed (grill #6).** Any CVE in a package imported from `src/` (e.g. `axios`, `next`) MUST get an **individual** `statement` with a reachability note; only build/dev-time-only transitive deps may be batch-accepted.
6. **Patched deps are a reviewed surface (grill #1).** trivy cannot see patch content, so any change to `patches/` or `pnpm.patchedDependencies` MUST carry a `SECURITY-REVIEW:` commit trailer; the same requirement applies to edits of `.trivyignore.yaml` and `pnpm-lock.yaml` (the security-sensitive path set — this is the lockfile-justification control ADR-0001 named but never implemented, grill #3).
7. **Secret scanning is unchanged: filesystem-wide and fail-closed.** A leaked secret is always kiln-actionable, so secret scanning keeps no register.

## Considered Options
- **Risk register (`.trivyignore.yaml`) + lockfile scope — chosen.** Every accepted risk is explicit, justified, and dated; new/unaccepted findings still fail; the gate is green-able without being disabled. Strengthens ADR-0001: acceptance now requires a written, expiring justification instead of a silent pass.
- **`--ignore-unfixed`** — rejected: removes only 1/62 here, and hides fixed-upstream-but-transitive risk with no audit trail or expiry.
- **Severity CRITICAL-only** — rejected: 3 transitive CRITICALs still wedge the gate, and it silently drops every HIGH with no record.
- **Direct-deps-only filter (no register)** — rejected: no native trivy support without JSON post-processing, and it silently ignores transitive CRITICALs with zero visibility or review cadence.
- **Drop trivy from pre-push / tolerate `--no-verify`** — rejected: disables secret + license + new-CVE detection wholesale; this is precisely the failure ADR-0001 exists to prevent.

## Consequences
- The gate greens on today's baseline while every accepted CVE is documented and dated.
- New direct deps, new CVEs, and license changes still fail the gate — ADR-0001 is intact and tightened.
- Transitive CRITICALs (`protobufjs`, `shell-quote`) live visibly in the register, not buried — creating pressure to bump parents (`@solana/wallet-adapter-*`, etc.) when they release.
- Maintenance cost: re-triage on entry expiry (and any `pnpm up`); entries drop out as upstream ships fixes.
- This does **not** reduce actual transitive risk today — it makes that risk explicit, owned, and time-boxed instead of a push-blocker that gets bypassed.

## Limitations / Non-goals (stated up front — do not over-claim)
Trivy is a **known-CVE** scanner. This ADR does **not** defend against the core supply-chain threats ADR-0001 names — typosquats, dependency-confusion, or a maintainer-compromised/backdoored package — because those ship with **no CVE id** and trivy cannot match them (grill #4). Those threats are owned by lockfile-integrity hashes + human dependency review, not by this gate. Likewise, the pre-push hook is a **local, advisory** control (`core.hooksPath` is local git config; `--no-verify` bypasses it — grill #2); durable enforcement requires the same gate to run in CI branch protection, which this ADR **requires as a follow-up (§Enforcement)** but cannot itself install. Until that CI job exists, every finding here is advisory.

## Security Considerations & Mitigations
<!-- grill-with-threat-model output, 8 vectors -->
- **Patched-dependency blind spot (grill #1, kiln-specific).** `pnpm.patchedDependencies` + `patches/*.patch` inject code trivy never sees (it matches lockfile versions). → `patches/` is a security-sensitive path: the gate MUST fail on any diff to `patches/` or `pnpm.patchedDependencies` without an accompanying `SECURITY-REVIEW:` note in the commit, and patched deps stay pinned by lockfile integrity hash.
- **Local-advisory enforcement / `--no-verify` (grill #2).** Accepted as an inherited limitation (above); mitigated only by the required CI mirror of the gate. Not solved by this ADR alone — stated honestly rather than claimed closed.
- **Smuggled dep behind a same-PR register edit (grill #3).** The originally-cited "lockfile-changed-without-justification" gate did **not exist**. This ADR now *implements* it: `.trivyignore.yaml`, `pnpm-lock.yaml`, and `patches/` are the security-sensitive path set; the gate fails on a change to any of them lacking a `SECURITY-REVIEW:` commit-trailer, and register edits are reviewed under the ADR-0007 lens.
- **Known-CVE-only false assurance (grill #4).** See Limitations. The register is explicitly **not** a supply-chain-integrity control; the ADR text no longer implies it catches backdoors.
- **License detection regressed by lockfile scope (grill #5).** Real regression, verified empirically: lockfile-only **and** `fs . --skip-dirs node_modules` both detect **zero** license findings; only the full `fs .` scan (which reads the actual `LICENSE`/`package.json` files inside `node_modules`) surfaces the 3 real findings. → the license scan runs against the **full filesystem**; only the **vuln** scan moves to the lockfile. Scanners are split by scope, not scoped uniformly.
- **Blanket seed amnesty hides a reachable HIGH (grill #6).** → seed acceptance MUST carry an **individual** `statement` with a reachability note for any CVE in a package imported from `src/` (e.g. `axios`, `next`); only build/dev-time-only transitive deps get batch-style acceptance. `axios` CVEs are triaged against the RPC-failover path before acceptance.
- **Transitive expiry as a permanent silent accept (grill #7).** → the hygiene check **fails** (not warns) on any `expired_at` beyond a hard cap: 30 days for `direct:`, 90 days for `transitive:`. No entry can outlive a quarter without re-review. Clock-rollback is out of scope for a local dev tool but re-caught by the CI mirror.
- **Scanner-absent / stale-DB fail-open (grill #8).** The local dev hook may self-skip when trivy is absent (fast-feedback ergonomics), but the **CI mirror MUST fail closed** (ADR-0005) when trivy is absent or its vuln DB is older than 7 days (`--skip-db-update` forbidden in CI).

## Enforcement
- **Gate rewrite** in `.githooks/lint-gate.sh`, trivy stage — three scans, split by scope (grill #5):
  - vuln (graph): `trivy fs --scanners vuln --severity HIGH,CRITICAL --ignorefile .trivyignore.yaml --exit-code 1 --quiet pnpm-lock.yaml`
  - license (full filesystem incl node_modules, where real LICENSE files live): `trivy fs --scanners license --severity HIGH,CRITICAL --ignorefile .trivyignore.yaml --exit-code 1 --quiet .`
  - secret (filesystem, fail-closed): `trivy fs --scanners secret --exit-code 1 --quiet --skip-dirs node_modules .`
- **`.trivyignore.yaml`** committed as the register — seeded + annotated from this triage.
- **Register-hygiene check** (`scripts/check-trivyignore.mjs`, runs before trivy): FAILS on any entry lacking `statement`/`expired_at`, past `expired_at`, `direct:` over 30 days, or `transitive:` over 90 days.
- **Security-sensitive-path change-review** (`scripts/check-security-paths.sh`, in the gate): fails if the pushed range's diff touches `patches/`, `pnpm.patchedDependencies`, `.trivyignore.yaml`, or `pnpm-lock.yaml` without a `SECURITY-REVIEW:` trailer in the range's commits — implements ADR-0001's lockfile-justification control and closes grill #1/#3.
- **CI mirror (required follow-up):** the same three scans MUST run in CI branch protection and there fail closed if trivy is absent or its vuln DB is > 7 days stale (`--skip-db-update` forbidden). Until this exists the local gate is advisory (see Limitations). An ADR without enforcement is a comment, not a control.

## Output Schema Impact
**Schema Change Type:** none

## Semantic Drift Assessment
- **Type/Format stability:** n/a — no tool output schema changes.
- **Enum extensibility:** n/a.
- **Mathematical invariants:** n/a.
- **Verification plan:** `check-trivyignore.mjs` unit-tested against a fixture register (valid entry, missing-statement, expired, over-long direct expiry).
