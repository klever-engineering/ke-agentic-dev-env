#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <title> <body-file> [labels]"
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

title="$1"
body_file="$2"
labels="${3:-}"
org="${GITHUB_ORG:-__ORG_NAME__}"
repo="${GITHUB_REPO:-__REPO_NAME__}"

if [ ! -f "$body_file" ]; then
  echo "Body file not found: $body_file"
  exit 1
fi

if ! load_gh_token; then
  echo "Missing GH token. Set GH_TOKEN/GITHUB_TOKEN or add GITHUB_API_TOKEN to .env"
  exit 1
fi

if [ -n "$labels" ]; then
  url=$(gh issue create --repo "$org/$repo" --title "$title" --body-file "$body_file" --label "$labels")
else
  url=$(gh issue create --repo "$org/$repo" --title "$title" --body-file "$body_file")
fi

echo "Created issue: $url"

if [ -n "${GITHUB_PROJECT_NUMBER:-}" ]; then
  "$SCRIPT_DIR/add_to_project.sh" "$url"
fi
