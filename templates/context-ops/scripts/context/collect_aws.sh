#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/redaction.sh"

OUT_DIR="$SCRIPT_DIR/../../context-engineering/snapshots"
mkdir -p "$OUT_DIR"

domain="aws"
snapshot_id="${domain}_$(date -u +%Y%m%d_%H%M%S)"
out_file="$OUT_DIR/$snapshot_id.json"
region="${AWS_REGION:-us-east-1}"

success=true
errors='[]'
stack_count=0
lambda_count=0

if ! command -v aws >/dev/null 2>&1; then
  success=false
  errors='[{"message":"aws cli not installed","severity":"error"}]'
else
  if aws sts get-caller-identity >/dev/null 2>&1; then
    stack_count=$(aws cloudformation describe-stacks --region "$region" --query 'length(Stacks)' --output text 2>/dev/null || echo 0)
    lambda_count=$(aws lambda list-functions --region "$region" --query 'length(Functions)' --output text 2>/dev/null || echo 0)
  else
    success=false
    errors='[{"message":"aws credentials unavailable","severity":"error"}]'
  fi
fi

raw=$(jq -n \
  --arg version "1.0.0" \
  --arg id "$snapshot_id" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg region "$region" \
  --argjson success "$success" \
  --argjson stack_count "${stack_count:-0}" \
  --argjson lambda_count "${lambda_count:-0}" \
  --argjson errors "$errors" \
  '{
    version: $version,
    snapshot_id: $id,
    timestamp: $ts,
    domain: "aws",
    source: {collector: "collect_aws.sh", version: "1.0.0"},
    status: {success: $success, collected_at: $ts, completed_at: $ts, duration_seconds: 0, errors: $errors},
    freshness: {ttl_hours: 168},
    data: {
      summary: {total_items: ($stack_count + $lambda_count), categories: {cloudformation_stacks: $stack_count, lambda_functions: $lambda_count}},
      region: $region
    },
    metadata: {redacted_fields: [], tags: ["aws", "cloud"], notes: "aws topology summary"}
  }')

redacted=$(redact_json "$raw")
echo "$redacted" | jq '.' > "$out_file"
echo "wrote $out_file"

if [ "$success" = false ]; then
  exit 1
fi
