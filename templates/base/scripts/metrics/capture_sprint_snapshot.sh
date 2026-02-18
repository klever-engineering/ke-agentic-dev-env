#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/doc/agents/metrics/snapshots"
mkdir -p "$OUT_DIR"

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
out_file="$OUT_DIR/snapshot_$(date -u +%Y%m%d_%H%M%S).json"
latest="$OUT_DIR/latest.json"

cat > "$out_file" <<JSON
{
  "timestamp": "$now",
  "notes": "Populate this snapshot with project-specific sprint metrics using gh/API integrations.",
  "kpis": {
    "first_pass_success_rate": null,
    "time_to_first_usable_pr_hours": null,
    "rework_rate": null,
    "docs_drift_incidents": null
  }
}
JSON

cp "$out_file" "$latest"
echo "Wrote snapshot: $out_file"
