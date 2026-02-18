#!/usr/bin/env bash
set -euo pipefail

scope="${1:-all}"
echo "Running QA scope: $scope"
./scripts/ci/preflight.sh
