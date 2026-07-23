#!/usr/bin/env bash
# lint-gate.sh — pre-push quality + security gate (fevra-dev template, 2026-07-04)
#
# Drop into a project (TS/JS and/or Python) and wire as a git pre-push hook (see
# README). Each stage is skipped (with a notice) when its tool/config/files are
# absent, so the gate degrades gracefully — e.g. the JS linter self-skips on a
# Python-only repo rather than failing. ANY stage failure aborts the push.
#
# Stack (validated STACK.md §11/§16/§17/§20): Oxlint (lint) + Biome (format) + ruff
# (Python lint/format) + Trivy (deps/secrets — ADR-0001) + Semgrep (ADR-derived security
# rules) + bandit (Python SAST) + dependency-cruiser (module-graph / architecture rules)
# + redact --check (scrub agent-generated .audit reports — ADR-0011).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1
fail=0
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
# True if any path matching the given git pathspecs is tracked, or untracked but
# not gitignored — i.e. something the tool would actually lint. Lets JS-only
# stages self-skip on a Python repo instead of erroring on "no files found".
have_files() { [ -n "$( { git ls-files -- "$@"; git ls-files --others --exclude-standard -- "$@"; } 2>/dev/null )" ]; }

# 1. Oxlint — fast lint (~12x ESLint). Prefers the pinned local devDep; falls
#    back to download. Set OXLINT_TYPE_AWARE=1 in CI to enable tsgolint (alpha).
#    Self-skips when the repo has no JS/TS — oxlint exits non-zero on "no files
#    found", which would otherwise abort the push on a Python-only project.
if [ -f .oxlintrc.json ] && have_files '*.js' '*.jsx' '*.ts' '*.tsx' '*.mjs' '*.cjs' '*.cts' '*.mts'; then
  step "oxlint"
  npx --yes oxlint --config .oxlintrc.json ${OXLINT_TYPE_AWARE:+--type-aware} || fail=1
elif [ -f .oxlintrc.json ]; then echo "· skip oxlint (no JS/TS files)"
else echo "· skip oxlint (no .oxlintrc.json)"; fi

# 2. Format check — Biome (stable). Swap to oxfmt once it hits GA.
if [ -f biome.json ]; then
  step "biome format --check"
  npx --yes @biomejs/biome format --error-on-warnings . || fail=1
else echo "· skip format (no biome.json)"; fi

# 2b. ruff — Python lint + format check (replaces flake8/isort/black). Uses [tool.ruff]
#     if present, else ruff defaults. uv-tool-isolated; self-skips if ruff or a Python
#     project marker (pyproject.toml / ruff.toml) is absent.
if command -v ruff >/dev/null 2>&1 && { [ -f pyproject.toml ] || [ -f ruff.toml ] || [ -f .ruff.toml ]; }; then
  step "ruff check + format --check"
  ruff check . || fail=1
  ruff format --check . || fail=1
else echo "· skip ruff (no pyproject.toml/ruff.toml or ruff absent)"; fi

# 3. Dependency / secret / license scan — ADR-0001 zero-trust-deps.
if command -v trivy >/dev/null 2>&1; then
  step "trivy fs (vuln,secret,license)"
  trivy fs --scanners vuln,secret,license --exit-code 1 --severity HIGH,CRITICAL --quiet . || fail=1
else echo "· skip trivy (not installed)"; fi

# 4. Semgrep — ADR-derived security rules authored via semgrep-rule-creator.
if command -v semgrep >/dev/null 2>&1 && [ -d .semgrep ]; then
  step "semgrep (ADR rules)"
  semgrep --config .semgrep --error --quiet . || fail=1
else echo "· skip semgrep (no .semgrep/ rules or semgrep absent)"; fi

# 4b. bandit — Python SAST (security). Fails only on HIGH severity + HIGH confidence
#     (fail-closed on real issues, low FP noise — sast-triage-criteria lens); tune via
#     [tool.bandit] in pyproject. uv-tool-isolated; self-skips if bandit or pyproject absent.
if command -v bandit >/dev/null 2>&1 && [ -f pyproject.toml ]; then
  step "bandit (Python SAST, HIGH/HIGH)"
  bandit -r . -q --severity-level high --confidence-level high \
    -x '*/.venv/*,*/venv/*,*/node_modules/*,*/build/*,*/dist/*' || fail=1
else echo "· skip bandit (no pyproject.toml or bandit absent)"; fi

# 5. dependency-cruiser — module-graph / architecture rules (structural ADR enforcement, STACK §16).
#    Complements Semgrep (AST patterns): forbidden imports, dependency-direction, circular deps,
#    orphans. Opt-in — runs only if the project ships a dep-cruiser config (i.e. has architectural
#    ADRs). Scaffold one with `npx depcruise --init`. MIT · npx · no global install · no telemetry.
DEPCRUISE_CFG=""; for c in .dependency-cruiser.js .dependency-cruiser.cjs .dependency-cruiser.mjs .dependency-cruiser.json .dependency-cruiser.jsonc; do [ -f "$c" ] && DEPCRUISE_CFG="$c" && break; done
DEPCRUISE_SRC="src"; [ -d "$DEPCRUISE_SRC" ] || DEPCRUISE_SRC="."
if [ -n "$DEPCRUISE_CFG" ]; then
  step "dependency-cruiser ($DEPCRUISE_CFG)"
  npx --yes dependency-cruiser --config "$DEPCRUISE_CFG" --no-progress "$DEPCRUISE_SRC" || fail=1
else echo "· skip dependency-cruiser (no .dependency-cruiser config)"; fi

# 6. Sigma detection-rule validation — Detection-as-Code (STACK.md §14).
#    Validates Sigma rules (from adr-to-sigma-yara-sync) before they reach a SIEM.
#    Local equiv of the SigmaHQ/sigma-rules-validator GitHub Action; sigma-cli via uv.
SIGMA_DIR=""; for d in detections .sigma sigma rules/sigma; do [ -d "$d" ] && SIGMA_DIR="$d" && break; done
if command -v sigma >/dev/null 2>&1 && [ -n "$SIGMA_DIR" ]; then
  step "sigma check ($SIGMA_DIR)"
  sigma check "$SIGMA_DIR" || fail=1
else echo "· skip sigma (no detections/ rules or sigma-cli absent)"; fi

# 7. Output redaction — ADR-0011: scrub agent-generated audit reports of card/PII/
#    credential/key material before they're pushed. Fail-closed backstop (the
#    write-time scrub happens in the /audit + /attack commands via redact.py).
#    Self-skips when no .audit/ reports exist or redact.py is absent.
REDACT="$HOME/.claude/scripts/redact.py"
# Invoke via `uv run` — bare `python3` is blocked by a shim in this environment (STACK §20 verified
# fact). Gate on uv, not python3, so the stage runs where uv is present and self-skips otherwise.
if [ -d .audit ] && [ -f "$REDACT" ] && command -v uv >/dev/null 2>&1; then
  _reports=$(find .audit -type f \( -name '*.md' -o -name '*.sarif' \) 2>/dev/null)
  if [ -n "$_reports" ]; then
    step "redact --check (.audit reports, ADR-0011)"
    printf '%s\n' "$_reports" | tr '\n' '\0' | xargs -0 uv run --no-project "$REDACT" --check || fail=1
  else echo "· skip redact (no .audit reports)"; fi
else echo "· skip redact (no .audit/ or redact.py absent)"; fi

if [ "$fail" -eq 0 ]; then echo; echo "✅ lint-gate passed"; else echo; echo "❌ lint-gate failed — push aborted"; fi
exit "$fail"
