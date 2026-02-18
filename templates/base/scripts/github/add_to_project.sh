#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <issue-url>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

load_gh_token() {
  if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
    return 0
  fi

  if [ -f "$ROOT_DIR/.env" ]; then
    local token
    token=$(awk -F= '/^GITHUB_API_TOKEN=/{print $2}' "$ROOT_DIR/.env" | tail -1 | sed -e 's/^"//' -e 's/"$//')
    if [ -n "$token" ]; then
      export GH_TOKEN="$token"
      return 0
    fi
  fi

  return 1
}

issue_url="$1"
project="${GITHUB_PROJECT_NUMBER:-}"
owner="${GITHUB_ORG:-__ORG_NAME__}"

if [ -z "$project" ]; then
  echo "GITHUB_PROJECT_NUMBER is not set; skipping project add"
  exit 0
fi

if ! load_gh_token; then
  echo "Missing GH token. Set GH_TOKEN/GITHUB_TOKEN or add GITHUB_API_TOKEN to .env"
  exit 1
fi

gh project item-add "$project" --owner "$owner" --url "$issue_url"
echo "Added to project $owner/$project"
