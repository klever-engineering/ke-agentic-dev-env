#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

required_paths=(
  "context-engineering"
  "context-engineering/input"
  "context-engineering/sources"
  "context-engineering/support"
)

for p in "${required_paths[@]}"; do
  if [ ! -e "$p" ]; then
    echo "Missing required context path: $p"
    exit 1
  fi
done

echo "Context structure looks valid"
