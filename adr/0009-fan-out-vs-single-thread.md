# ADR-0009 — Fan out for discovery, single-thread for logic-critical work

**Status:** Accepted · **Date:** 2026-06-12 · **Last-reviewed:** 2026-06-12

## Context

With frontier models (Opus 4.8 / GPT-5.5), one agent holding full context out-performs parallel
subagents for *logic-critical* work: a subagent returns a **summary**, and summaries drop the
specific detail that logic and security verdicts ride on. Bootoshi's field report and the Harness
Engineering article both land here. But this is not "never fan out": read-only breadth — locating
files, sweeping naming conventions, recon enumeration — is exactly what subagents are good at
(they compact large research well). The existing `/attack` routing fans hunters out; that is correct
*for discovery*. The risk is letting a subagent's summary of code stand in for reading the code when
a verdict or a fix depends on its exact logic — which is also an untrusted-content propagation vector
(a subagent reading attacker-controlled code can be injected and return a poisoned summary; ADR-0002/0003/0006).

## Decision

Fan out (parallel subagents) only for read-only discovery that returns **locations/candidates**.
Run logic-critical reasoning — `/audit` verification, security verdicts, and any implementation or
fix of logic-critical code — in a single context-holding thread. Never substitute a subagent's
*summary* of code for the code itself when the decision depends on that code's logic.

## Invariants

1. `/attack` hunters MAY run in parallel but return candidate **locations**, not trusted logic-summaries.
2. `/audit` verification (`fp-check`) and finding verdicts are single-thread.
3. Subagent output is a **pointer, never evidence**: before any verdict or fix, the single-thread agent re-reads the actual code itself. A subagent's claim ("this function is vulnerable because…") is treated as an unverified lead, which also contains any injection it may have ingested.
4. Implementation/refactor of logic-critical code is single-thread; subagents may gather context but the editing agent reads the actual code it changes.

## Enforcement

- `gavel` / semantic — no static rule; this is a routing discipline.
- CLAUDE.md routing rule (invocation rule 3) states the fan-out-vs-single-thread boundary.

## Consequences

Costs some wall-clock parallelism on the verify/fix path. Buys accuracy where it matters most —
fewer summary-induced misses in audit verdicts, fewer "fixed X, broke Y" regressions from a subagent
that never held full context, and one fewer place for injected untrusted content to propagate as a
trusted summary. Discovery stays fast (still parallel).

## References

- Routing: `~/.claude/CLAUDE.md` (invocation rule 3)
- Related: ADR-0002 / ADR-0003 / ADR-0006 (untrusted-content defenses — the re-read rule is also their ally)
- Source: `docs/ideas/Booworkflow gold.md` (mega-thread vs subagent), `docs/ideas/Harness engineering.md`
- Grill: light `grill-with-threat-model` pass, 2026-06-12 — break path "logic claim dressed as a candidate / injected summary" folded into invariant 3.
