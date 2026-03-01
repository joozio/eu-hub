#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Running quality gate (lint + test + build)"
npm run check

echo "==> Running dependency audit (prod/high)"
npm audit --omit=dev --audit-level=high

echo "==> Running secret pattern scan"
SCAN_PATTERN='(MISTRAL_API_KEY\\s*=\\s*[A-Za-z0-9_\\-]{16,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\\-_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|BEGIN[[:space:]]+PRIVATE[[:space:]]+KEY)'

if command -v rg >/dev/null 2>&1; then
  if rg -n --hidden \
    --glob '!.git' \
    --glob '!node_modules' \
    --glob '!.next' \
    --glob '!.env*' \
    -e "$SCAN_PATTERN" .; then
    echo "Secret scan failed: potential credential-like pattern detected."
    exit 1
  fi
else
  if grep -RInE "$SCAN_PATTERN" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude=.env \
    --exclude=.env.local \
    --exclude=.env.example; then
    echo "Secret scan failed: potential credential-like pattern detected."
    exit 1
  fi
fi

echo "==> Checking demo snapshot fixtures"
required_snapshots=(
  "src/data/demo/feed.json"
  "src/data/demo/rankings.json"
  "src/data/demo/stats.json"
  "src/data/demo/compare.json"
)

for snapshot in "${required_snapshots[@]}"; do
  if [[ ! -f "$snapshot" ]]; then
    echo "Missing required demo snapshot: $snapshot"
    exit 1
  fi
done

if [[ -f ".env.local" ]]; then
  echo "==> Note: .env.local present (expected local-only; ignored by git)."
fi

echo "Preflight passed: production and demo gates are green."
