#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
source "$SCRIPT_DIR/lib/redaction.sh"

OUT_DIR="$ROOT_DIR/context-engineering/snapshots"
mkdir -p "$OUT_DIR"

domain="code"
snapshot_id="${domain}_$(date -u +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/$snapshot_id.json"

git_branch=""
git_commit=""
commit_count=0
modified_files=0
doc_markdown_files=0
workflow_files=0
issues_open=-1
prs_open=-1
errors='[]'

if command -v git >/dev/null 2>&1 && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_branch=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  git_commit=$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo "")
  commit_count=$(git -C "$ROOT_DIR" rev-list --count HEAD 2>/dev/null || echo 0)
  modified_files=$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
else
  errors='[{"message":"git repo not available","severity":"warning"}]'
fi

if [ -d "$ROOT_DIR/doc" ]; then
  doc_markdown_files=$(find "$ROOT_DIR/doc" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
fi
if [ -d "$ROOT_DIR/.github/workflows" ]; then
  workflow_files=$(find "$ROOT_DIR/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | wc -l | tr -d ' ')
fi

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

org="${GITHUB_ORG:-}"
repo="${GITHUB_REPO:-}"
if command -v gh >/dev/null 2>&1 && [ -n "$org" ] && [ -n "$repo" ]; then
  if load_gh_token; then
    issues_open=$(gh issue list --repo "$org/$repo" --state open --limit 200 --json number 2>/dev/null | jq 'length' 2>/dev/null || echo -1)
    prs_open=$(gh pr list --repo "$org/$repo" --state open --limit 200 --json number 2>/dev/null | jq 'length' 2>/dev/null || echo -1)
  else
    errors=$(echo "$errors" | jq '. + [{"message":"GH token missing (set GITHUB_API_TOKEN in .env)","severity":"warning"}]')
  fi
else
  errors=$(echo "$errors" | jq '. + [{"message":"gh or GITHUB_ORG/GITHUB_REPO unavailable for GitHub delivery metrics","severity":"warning"}]')
fi

if [ -n "$git_commit" ]; then
  git_commit="$(redact_json "$git_commit")"
fi

total_items=$((commit_count + modified_files + doc_markdown_files + workflow_files))
if [ "$issues_open" -ge 0 ]; then
  total_items=$((total_items + issues_open))
fi
if [ "$prs_open" -ge 0 ]; then
  total_items=$((total_items + prs_open))
fi

raw=$(jq -n \
  --arg version "1.0.0" \
  --arg id "$snapshot_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg branch "$git_branch" \
  --arg commit "$git_commit" \
  --arg org "$org" \
  --arg repo "$repo" \
  --argjson commit_count "${commit_count:-0}" \
  --argjson modified_files "${modified_files:-0}" \
  --argjson docs "${doc_markdown_files:-0}" \
  --argjson workflows "${workflow_files:-0}" \
  --argjson issues "$issues_open" \
  --argjson prs "$prs_open" \
  --argjson total_items "$total_items" \
  --argjson errors "$errors" \
  '{
    version: $version,
    snapshot_id: $id,
    timestamp: $ts,
    domain: "code",
    source: {collector: "collect_code.sh", version: "1.0.0", agent: "software-process-agent"},
    status: {success: true, collected_at: $ts, completed_at: $ts, duration_seconds: 0, errors: $errors},
    freshness: {ttl_hours: 168},
    data: {
      summary: {
        total_items: $total_items,
        categories: {
          commits: $commit_count,
          modified_files: $modified_files,
          docs: $docs,
          workflows: $workflows,
          open_issues: (if $issues < 0 then null else $issues end),
          open_prs: (if $prs < 0 then null else $prs end)
        }
      },
      git: {
        branch: $branch,
        head_commit: $commit
      },
      github: {
        repo: (if ($org | length) > 0 and ($repo | length) > 0 then ($org + "/" + $repo) else null end)
      }
    },
    metadata: {redacted_fields: [], tags: ["code", "github"], notes: "code and delivery context snapshot"}
  }')

redacted=$(redact_json "$raw")
echo "$redacted" | jq '.' > "$out_file"
echo "wrote $out_file"
