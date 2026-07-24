# ADR-0006 — Sanitize Untrusted Bytes Before Any Sink

**Status:** Accepted · **Date:** 2026-06-07
**Supersedes:** — · **Superseded-by:** —
*(Threat-model review: `grill-with-threat-model` pass below.)*

## Context
Security/forensics/detection tooling ingests attacker-controlled bytes (HTTP headers, log lines, packet payloads, file contents, tool output). Writing those bytes unsanitized to a sink — disk, log, stdout/terminal, SIEM, or a parser's memory — enables log injection, telemetry forgery, and terminal-escape attacks. (From the operator's own ADR-context-layer note: "all raw byte streams must pass through `sanitize_payload()` before being written to disk or memory.")

## Decision
All raw/untrusted byte streams MUST pass a sanitizer (`sanitize_payload()` or equivalent) **at the trust boundary**, before being written to any sink: disk, log, stdout/stderr/terminal, SIEM/telemetry, or parsed into trusted memory. Sanitization happens once, at the boundary — not at each use site.

## Consequences
One mandatory choke-point per ingestion path; prevents log/telemetry forgery and terminal-injection from poisoning the tool's own output.

## Security Considerations & Mitigations (grill-with-threat-model)
- **Terminal/ANSI-escape injection** — untrusted bytes with escape sequences reach stdout / a log viewer → terminal spoofing, hidden text, log forgery. → strip/escape control + ANSI sequences in the sanitizer.
- **Log-line / newline forgery** — untrusted input with `\n`/`\r` injects fake log entries (spoofs the SIEM baseline). → escape newlines/CR before logging.
- **Sanitize-at-use desync (TOCTOU)** — sanitized for one sink, but another code path writes the *raw* value to a different sink. → sanitize at the boundary, single choke-point (pair with `spec-isolation-boundaries`).
- **Encoding bypass / double-decode** — the sanitizer validates UTF-8 but the sink re-decodes differently, or input is double-decoded past the check. → canonicalize encoding *before* sanitizing; the sink consumes only the canonical form.

## Enforcement
- Semgrep rule: flag any write/log/print of a value that did not pass the sanitizer (direct sink of untrusted input).
- `spec-isolation-boundaries` to map the per-tool entry points + choke-points that feed this rule.
