#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

skip_code=false
skip_environment=false
skip_aws=false
skip_grafana=false
build_knowledge=false

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-code) skip_code=true ;;
    --skip-environment) skip_environment=true ;;
    --skip-aws) skip_aws=true ;;
    --skip-grafana) skip_grafana=true ;;
    --build-knowledge) build_knowledge=true ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

run_collector() {
  local name="$1"
  local cmd="$2"
  echo "▶ $name"
  if bash "$cmd"; then
    echo "  ✅ success"
  else
    echo "  ❌ failed"
    return 1
  fi
}

failed=0

if [ "$skip_code" = false ]; then
  run_collector "code" "$SCRIPT_DIR/collect_code.sh" || failed=1
else
  echo "⏭ code skipped"
fi

if [ "$skip_environment" = false ]; then
  run_collector "environment" "$SCRIPT_DIR/collect_environment.sh" || failed=1
else
  echo "⏭ environment skipped"
fi

run_collector "infrastructure" "$SCRIPT_DIR/collect_infrastructure.sh" || failed=1

if [ "$skip_aws" = false ]; then
  run_collector "aws" "$SCRIPT_DIR/collect_aws.sh" || failed=1
else
  echo "⏭ aws skipped"
fi

if [ "$skip_grafana" = false ]; then
  run_collector "grafana" "$SCRIPT_DIR/collect_grafana.sh" || failed=1
else
  echo "⏭ grafana skipped"
fi

run_collector "network" "$SCRIPT_DIR/collect_network.sh" || failed=1

if [ "$build_knowledge" = true ]; then
  echo "▶ knowledge-layer"
  if command -v node >/dev/null 2>&1; then
    if node "$SCRIPT_DIR/build_knowledge_layer.mjs" --provider "${LLM_PROVIDER:-auto}"; then
      echo "  ✅ success"
    else
      echo "  ❌ failed"
      failed=1
    fi
  else
    echo "  ❌ node not available"
    failed=1
  fi
fi

exit "$failed"
