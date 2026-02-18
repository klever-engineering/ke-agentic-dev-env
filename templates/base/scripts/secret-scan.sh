#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source . --no-git --redact
  exit 0
fi

# Lightweight fallback patterns
if rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' '(ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----)' . >/tmp/secret_scan_hits.txt; then
  echo "Potential secret patterns detected:"
  cat /tmp/secret_scan_hits.txt
  exit 1
fi

echo "No obvious secret patterns detected"
