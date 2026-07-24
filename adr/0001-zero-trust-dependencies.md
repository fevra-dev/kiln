# ADR-0001 — Zero-Trust Dependencies

**Status:** Accepted · **Date:** 2026-06-06
**Supersedes:** — · **Superseded-by:** —

## Context
This stack builds security/offensive tooling where supply-chain risk and minimal attack surface are first-order concerns. Agents reach for `npm install`/`pip install` reflexively, importing transitive risk and bloat.

## Decision
No third-party dependency may be added without a written justification that: (a) names the exact package + version + source; (b) compares its supply-chain risk (maintainers, last release, known CVEs via Trivy/cve-mcp, transitive count) against the cost of an in-house implementation; and (c) records the decision here or in the PR. Prefer stdlib / in-house for trivial functionality. Pin exact versions; no floating ranges.

## Consequences
Slower to add deps; leaner, more auditable, more performant, stealthier tools. Forces a builder mindset.

## Security Considerations & Mitigations
- Typosquat / dependency-confusion → every new dep scanned with `trivy fs` + cross-checked against `cve-mcp` before adoption.
- Transitive bloat → justification must include the transitive dependency count.
- Compromised maintainer → prefer lockfile integrity / reproducible builds; pin + verify hashes.

## Enforcement
- `trivy fs --scanners vuln,secret,license <repo>` in the pre-push gate (Thread 3).
- Pre-push hook: fail if a lockfile changed without an accompanying justification note.
- Semgrep rule flagging un-pinned version ranges in dependency manifests.
