# ADR-0005 — Fail Closed on Security Decisions

**Status:** Accepted · **Date:** 2026-06-07
**Supersedes:** — · **Superseded-by:** —
*(Threat-model review: `grill-with-threat-model` pass below.)*

## Context
A security control that fails *open* — granting access on error, timeout, or ambiguity — is worse than no control, because it gives false assurance. AI-generated code frequently defaults to permissive error handling.

## Decision
Every security-relevant decision (authentication, authorization, validation, signature/permission check, policy evaluation) MUST default to **deny** on any error, exception, timeout, missing input, or unrecognized value. No path may turn an *absent* or *failed* check into an *allow*.

## Consequences
Occasional false denials under fault conditions — acceptable (fail safe). Eliminates fail-open as a vulnerability class.

## Security Considerations & Mitigations (grill-with-threat-model)
- **Exception → default allow** — a `catch`/`except` around the check returns `true`/allows. → the only safe value from a failed security check is deny.
- **Unknown input treated as pass** — an absent field or unrecognized enum hits a permissive default branch. → unknown/missing = deny; make deny the default arm.
- **Timeout → proceed** — the auth/policy backend times out and the caller continues. → timeout = deny, never "assume allowed."
- **Short-circuit skips the deny** — early-return or `&&`/`||` short-circuit leaves the deny branch unreached on some path. → structure so deny is the fall-through default, not an `else` a path can bypass.

## Enforcement
- `differential-review` on every PR (its core job is flagging fail-open patterns).
- Semgrep rule: flag error/`catch` branches in auth/validation modules that return allow/true.
- `insecure-defaults` review of new security-relevant components.
