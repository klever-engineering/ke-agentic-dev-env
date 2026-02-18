#!/usr/bin/env bash
set -euo pipefail

check_url() {
  local name="$1"
  local url="$2"
  if [ -z "$url" ]; then
    echo "$name: not configured"
    return 0
  fi

  if curl -fsS "$url/health" >/dev/null 2>&1 || curl -fsS "$url" >/dev/null 2>&1; then
    echo "$name: healthy"
  else
    echo "$name: unhealthy ($url)"
    return 1
  fi
}

check_url "staging" "${STAGING_BASE_URL:-}"
check_url "production" "${PRODUCTION_BASE_URL:-}"
