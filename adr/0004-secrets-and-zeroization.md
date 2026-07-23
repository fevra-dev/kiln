# ADR-0004 — Secret Handling & Zeroization

**Status:** Accepted · **Date:** 2026-06-07
**Supersedes:** — · **Superseded-by:** —
*(Threat-model review: `grill-with-threat-model` pass below.)*

## Context
This stack builds security/offensive tooling that handles credentials, keys, tokens, and other secrets. Leaked or lingering secrets — in memory, on disk, in logs, or in crash artifacts — are a primary failure mode.

## Decision
1. No secret is hardcoded in source, config, or test fixtures (use env / a secret store).
2. Secrets are never written to logs, stdout/stderr, error messages, or persisted to disk in plaintext.
3. Sensitive buffers (keys, plaintext, derived material) are zeroized immediately after use with a **guaranteed-wipe** primitive — never a plain `memset` the optimizer can elide.

## Consequences
More care around secret lifetimes and buffer handling; eliminates the most common credential-leak classes from the toolchain.

## Security Considerations & Mitigations (grill-with-threat-model)
- **Dead-store-eliminated wipe** — the compiler removes a `memset(buf,0,n)` "useless" store, leaving the secret in memory. → use `explicit_bzero` / the `zeroize` crate / `SecureZeroMemory` / volatile writes; verify with the `zeroize-audit` skill.
- **Secret survives in copies** — string concat, format, realloc/GC move, or interpolation copied the secret before the wipe; the original is wiped but copies persist in heap/swap. → minimize copies, prefer fixed buffers, wipe derived buffers, `mlock` sensitive pages.
- **Leak via error/exception path** — secret lands in a stack trace, panic message, or debug log. → redact in error paths; secret-typed wrappers whose Debug/Display is masked.
- **Persisted via core dump / swap** — a crash dump or swap page writes the secret to disk. → disable core dumps for the process; lock sensitive pages out of swap.

## Enforcement
- `trivy fs --scanners secret` + a gitleaks-style pre-commit (no hardcoded secrets).
- Semgrep rule: flag logging / printing / disk-writing of secret-typed values.
- `zeroize-audit` on wipe paths; `constant-time-analysis` where comparison timing matters.
