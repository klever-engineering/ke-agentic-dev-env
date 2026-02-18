#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CHECKS_PASSED=0
CHECKS_FAILED=0

run_check() {
  local name="$1"
  local cmd="$2"
  echo "▶ $name"
  if eval "$cmd"; then
    echo "  ✅ pass"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo "  ❌ fail"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
  fi
  echo
}

run_check "Agent context contract" "./scripts/validate_agent_context.sh"
run_check "Markdown links" "./scripts/validate_markdown_links.sh"
run_check "Context structure" "./scripts/context/validate_context.sh"
run_check "LLM provider credentials" "./scripts/ai/validate_provider.sh"
run_check "Secret hygiene" "./scripts/secret-scan.sh"

echo "Preflight summary"
echo "  passed: $CHECKS_PASSED"
echo "  failed: $CHECKS_FAILED"

if [ "$CHECKS_FAILED" -gt 0 ]; then
  exit 1
fi
