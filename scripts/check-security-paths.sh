#!/usr/bin/env bash
# check-security-paths.sh — sensitive-path change review (ADR-0017).
#
# trivy cannot see the *content* of patch files, lockfile edits, or the risk
# register itself, so a change to any of them must be human-reviewed. This gate
# fails a push whose range touches a sensitive path unless a commit in that
# range carries a `SECURITY-REVIEW:` trailer. Implements the lockfile-
# justification control ADR-0001 named but never built (grill #1/#3).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

# Range = everything on this branch since it diverged from the mainline.
base="$(git merge-base HEAD origin/main 2>/dev/null \
     || git merge-base HEAD main 2>/dev/null || true)"
range="${base:+$base..}HEAD"

SENSITIVE=(patches/ pnpm-lock.yaml .trivyignore.yaml .trivyignore)
changed="$(git diff --name-only "$range" -- "${SENSITIVE[@]}" 2>/dev/null)"

if [ -z "$changed" ]; then
  echo "· security-paths: no sensitive-path changes in ${range}"
  exit 0
fi

if git log "$range" --format='%B' 2>/dev/null | grep -qiE '^[[:space:]]*SECURITY-REVIEW:'; then
  echo "· security-paths: sensitive-path change(s) present, SECURITY-REVIEW trailer found — OK"
  exit 0
fi

echo "❌ security-paths (ADR-0017): sensitive paths changed without a SECURITY-REVIEW: trailer:"
echo "${changed}" | sed 's/^/    /'
echo "   trivy cannot inspect these — a human must. Add a commit trailer in ${range}:"
echo "       SECURITY-REVIEW: <what you verified about this dep/patch/register change>"
exit 1
