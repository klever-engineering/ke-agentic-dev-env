#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
source "$SCRIPT_DIR/lib/redaction.sh"

OUT_DIR="$ROOT_DIR/context-engineering/snapshots"
mkdir -p "$OUT_DIR"

domain="environment"
snapshot_id="${domain}_$(date -u +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/$snapshot_id.json"

tools=(node npm python3 pip3 jq gh docker aws kubectl)
versions='[]'
missing=0
present=0

for tool in "${tools[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    present=$((present + 1))
    version_output=$("$tool" --version 2>/dev/null | head -1 | tr -d '\r' || echo "unknown")
    versions=$(echo "$versions" | jq --arg t "$tool" --arg v "$version_output" '. + [{tool: $t, version: $v}]')
  else
    missing=$((missing + 1))
    versions=$(echo "$versions" | jq --arg t "$tool" '. + [{tool: $t, version: null}]')
  fi
done

kernel=$(uname -srmo 2>/dev/null || uname -a 2>/dev/null || echo "unknown")
hostname_value=$(hostname 2>/dev/null || echo "unknown")

raw=$(jq -n \
  --arg version "1.0.0" \
  --arg id "$snapshot_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg kernel "$kernel" \
  --arg host "$hostname_value" \
  --argjson versions "$versions" \
  --argjson present "$present" \
  --argjson missing "$missing" \
  '{
    version: $version,
    snapshot_id: $id,
    timestamp: $ts,
    domain: "environment",
    source: {collector: "collect_environment.sh", version: "1.0.0", host: $host, agent: "software-process-agent"},
    status: {success: true, collected_at: $ts, completed_at: $ts, duration_seconds: 0, errors: []},
    freshness: {ttl_hours: 720},
    data: {
      summary: {
        total_items: ($present + $missing),
        categories: {tools_present: $present, tools_missing: $missing}
      },
      runtime: {
        os_kernel: $kernel,
        tools: $versions
      }
    },
    metadata: {redacted_fields: ["source.host"], tags: ["environment", "toolchain"], notes: "local runtime and toolchain context"}
  }')

redacted=$(redact_json "$raw")
echo "$redacted" | jq '.' > "$out_file"
echo "wrote $out_file"
