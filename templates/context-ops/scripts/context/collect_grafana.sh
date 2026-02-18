#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/redaction.sh"

OUT_DIR="$SCRIPT_DIR/../../context-engineering/snapshots"
mkdir -p "$OUT_DIR"

domain="grafana"
snapshot_id="${domain}_$(date -u +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/$snapshot_id.json"
url="${GRAFANA_URL:-}"
token="${GRAFANA_API_TOKEN:-}"

success=true
errors='[]'
dashboards=0
datasources=0

if [ -z "$url" ] || [ -z "$token" ]; then
  success=false
  errors='[{"message":"missing GRAFANA_URL or GRAFANA_API_TOKEN","severity":"error"}]'
else
  if curl -fsS -H "Authorization: Bearer $token" "$url/api/health" >/dev/null 2>&1; then
    dashboards=$(curl -fsS -H "Authorization: Bearer $token" "$url/api/search?type=dash-db" | jq 'length' 2>/dev/null || echo 0)
    datasources=$(curl -fsS -H "Authorization: Bearer $token" "$url/api/datasources" | jq 'length' 2>/dev/null || echo 0)
  else
    success=false
    errors='[{"message":"grafana api health check failed","severity":"error"}]'
  fi
fi

raw=$(jq -n \
  --arg version "1.0.0" \
  --arg id "$snapshot_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg url "$url" \
  --argjson success "$success" \
  --argjson dashboards "${dashboards:-0}" \
  --argjson datasources "${datasources:-0}" \
  --argjson errors "$errors" \
  '{
    version: $version,
    snapshot_id: $id,
    timestamp: $ts,
    domain: "grafana",
    source: {collector: "collect_grafana.sh", version: "1.0.0"},
    status: {success: $success, collected_at: $ts, completed_at: $ts, duration_seconds: 0, errors: $errors},
    freshness: {ttl_hours: 24},
    data: {
      summary: {total_items: ($dashboards + $datasources), categories: {dashboards: $dashboards, datasources: $datasources}},
      grafana_url: $url
    },
    metadata: {redacted_fields: ["data.grafana_url"], tags: ["grafana", "observability"], notes: "grafana summary"}
  }')

redacted=$(redact_json "$raw")
echo "$redacted" | jq '.' > "$out_file"
echo "wrote $out_file"

if [ "$success" = false ]; then
  exit 1
fi
