#!/usr/bin/env bash
set -euo pipefail

redact_aws_account_id() {
  echo "$1" | sed -E 's/\b[0-9]{12}\b/REDACTED_AWS_ACCOUNT_ID/g'
}

redact_private_ips() {
  local input="$1"
  input=$(echo "$input" | sed -E 's/\b10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b/REDACTED_PRIVATE_IP/g')
  input=$(echo "$input" | sed -E 's/\b172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3}\b/REDACTED_PRIVATE_IP/g')
  input=$(echo "$input" | sed -E 's/\b192\.168\.[0-9]{1,3}\.[0-9]{1,3}\b/REDACTED_PRIVATE_IP/g')
  echo "$input"
}

redact_email_addresses() {
  echo "$1" | sed -E 's/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/REDACTED_EMAIL/g'
}

redact_internal_hostnames() {
  echo "$1" | sed -E 's/ip-[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}\.[A-Za-z0-9.-]+\.internal/REDACTED_HOSTNAME/g'
}

redact_secrets_by_keyword() {
  echo "$1" | sed -E 's/(password|secret|api_key|apikey|access_key|private_key|token|credential)[": ]+[^",}]+/\1": "REDACTED_SECRET"/gi'
}

redact_json() {
  local input="$1"
  input=$(redact_aws_account_id "$input")
  input=$(redact_private_ips "$input")
  input=$(redact_email_addresses "$input")
  input=$(redact_internal_hostnames "$input")
  input=$(redact_secrets_by_keyword "$input")
  echo "$input"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  sample='{"account":"123456789012","ip":"172.31.1.1","email":"x@y.z"}'
  echo "$(redact_json "$sample")" >/dev/null
  echo "Redaction library sanity check passed"
fi
