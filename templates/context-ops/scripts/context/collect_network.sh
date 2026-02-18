#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/redaction.sh"

OUT_DIR="$SCRIPT_DIR/../../context-engineering/snapshots"
mkdir -p "$OUT_DIR"

domain="network"
snapshot_id="${domain}_$(date -u +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/$snapshot_id.json"

domains=("${PRIMARY_DOMAIN:-example.com}" "${API_DOMAIN:-api.example.com}")
records=()

for d in "${domains[@]}"; do
  ip=""
  if command -v dig >/dev/null 2>&1; then
    ip=$(dig +short A "$d" 2>/dev/null | head -1 || true)
  fi
  records+=("{\"domain\":\"$d\",\"a\":\"$ip\"}")
done

records_json=$(printf '%s\n' "${records[@]}" | jq -s '.')

raw=$(jq -n \
  --arg version "1.0.0" \
  --arg id "$snapshot_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson records "$records_json" \
  '{
    version: $version,
    snapshot_id: $id,
    timestamp: $ts,
    domain: "network",
    source: {collector: "collect_network.sh", version: "1.0.0"},
    status: {success: true, collected_at: $ts, completed_at: $ts, duration_seconds: 0, errors: []},
    freshness: {ttl_hours: 24},
    data: {summary: {total_items: ($records | length), categories: {dns_records: ($records | length)}}, dns_records: $records},
    metadata: {redacted_fields: [], tags: ["network", "dns"], notes: "network summary"}
  }')

redacted=$(redact_json "$raw")
echo "$redacted" | jq '.' > "$out_file"
echo "wrote $out_file"
