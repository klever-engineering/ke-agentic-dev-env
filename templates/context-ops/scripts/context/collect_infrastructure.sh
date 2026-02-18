#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/redaction.sh"

OUT_DIR="$SCRIPT_DIR/../../context-engineering/snapshots"
mkdir -p "$OUT_DIR"

domain="infrastructure"
snapshot_id="${domain}_$(date -u +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/$snapshot_id.json"

containers_total=0
containers_running=0
services_total=0
errors='[]'

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    containers_total=$(docker ps -a --format '{{.ID}}' 2>/dev/null | wc -l | tr -d ' ')
    containers_running=$(docker ps --format '{{.ID}}' 2>/dev/null | wc -l | tr -d ' ')
  else
    errors='[{"message":"docker installed but not accessible for current user","severity":"warning"}]'
  fi
else
  errors='[{"message":"docker not available","severity":"warning"}]'
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-units --type=service --state=running --no-pager --no-legend >/dev/null 2>&1; then
    services_total=$(systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | wc -l | tr -d ' ')
  else
    errors=$(echo "$errors" | jq '. + [{"message":"systemctl not accessible in current runtime","severity":"warning"}]')
  fi
fi

raw=$(jq -n \
  --arg version "1.0.0" \
  --arg id "$snapshot_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg host "$(hostname 2>/dev/null || echo unknown)" \
  --argjson containers_total "$containers_total" \
  --argjson containers_running "$containers_running" \
  --argjson services_total "$services_total" \
  --argjson errors "$errors" \
  '{
    version: $version,
    snapshot_id: $id,
    timestamp: $ts,
    domain: "infrastructure",
    source: {collector: "collect_infrastructure.sh", version: "1.0.0", host: $host, agent: "manual"},
    status: {success: true, collected_at: $ts, completed_at: $ts, duration_seconds: 0, errors: $errors},
    freshness: {ttl_hours: 24},
    data: {
      summary: {total_items: ($containers_total + $services_total), categories: {containers: $containers_total, services: $services_total}},
      containers: {total: $containers_total, running: $containers_running},
      services: {running: $services_total}
    },
    metadata: {redacted_fields: [], tags: ["infrastructure", "runtime"], notes: "infrastructure snapshot"}
  }')

redacted=$(redact_json "$raw")
echo "$redacted" | jq '.' > "$out_file"
echo "wrote $out_file"
