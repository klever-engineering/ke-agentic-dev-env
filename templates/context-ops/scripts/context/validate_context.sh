#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
SNAPSHOT_DIR="$ROOT_DIR/context-engineering/snapshots"

if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo "Snapshot directory missing: $SNAPSHOT_DIR"
  exit 1
fi

mapfile -t snapshots < <(find "$SNAPSHOT_DIR" -type f -name '*.json' | sort)
if [ "${#snapshots[@]}" -eq 0 ]; then
  echo "No snapshots found; nothing to validate"
  exit 0
fi

declare -A ttl_map
# domain default TTLs in hours
ttl_map[code]=168
ttl_map[environment]=720
ttl_map[infrastructure]=24
ttl_map[aws]=168
ttl_map[grafana]=24
ttl_map[network]=24

declare -A seen_domains
required_domains=(code environment infrastructure network)

if [ "${REQUIRE_AWS_CONTEXT:-false}" = "true" ]; then
  required_domains+=(aws)
fi
if [ "${REQUIRE_GRAFANA_CONTEXT:-false}" = "true" ]; then
  required_domains+=(grafana)
fi

invalid=0
stale=0

for file in "${snapshots[@]}"; do
  echo "▶ validating $(basename "$file")"

  if ! jq empty "$file" >/dev/null 2>&1; then
    echo "  ❌ invalid json"
    invalid=$((invalid + 1))
    continue
  fi

  for key in version snapshot_id timestamp domain source status data; do
    if ! jq -e ".$key" "$file" >/dev/null 2>&1; then
      echo "  ❌ missing key: $key"
      invalid=$((invalid + 1))
      continue 2
    fi
  done

  domain=$(jq -r '.domain' "$file")
  seen_domains["$domain"]=1

  ts=$(jq -r '.timestamp' "$file")
  ttl=$(jq -r '.freshness.ttl_hours // empty' "$file")
  if [ -z "$ttl" ] || [ "$ttl" = "null" ]; then
    ttl=${ttl_map[$domain]:-24}
  fi

  snap_epoch=$(date -d "$ts" +%s 2>/dev/null || echo 0)
  now_epoch=$(date +%s)
  age_hours=$(( (now_epoch - snap_epoch) / 3600 ))

  if [ "$snap_epoch" -eq 0 ]; then
    echo "  ❌ invalid timestamp format: $ts"
    invalid=$((invalid + 1))
    continue
  fi

  if [ "$age_hours" -gt "$ttl" ]; then
    if [ "$age_hours" -gt $((ttl * 2)) ]; then
      echo "  ❌ critical staleness: ${age_hours}h (ttl ${ttl}h)"
      invalid=$((invalid + 1))
    else
      echo "  ⚠ stale: ${age_hours}h (ttl ${ttl}h)"
      stale=$((stale + 1))
    fi
  else
    echo "  ✅ fresh"
  fi

  ok=$(jq -r '.status.success' "$file")
  if [ "$ok" != "true" ]; then
    echo "  ⚠ collector reported success=false"
  fi
done

for domain in "${required_domains[@]}"; do
  if [ -z "${seen_domains[$domain]:-}" ]; then
    echo "❌ missing required domain snapshot: $domain"
    invalid=$((invalid + 1))
  fi
done

echo
echo "Validation summary: invalid=$invalid stale=$stale"
if [ "$invalid" -gt 0 ]; then
  exit 1
fi
