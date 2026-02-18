#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <server-name> [args...]"
  exit 1
fi

server="$1"
shift

# Load local env if present
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -f .env.mcp ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.mcp
  set +a
fi

case "$server" in
  github)
    echo "Configure your GitHub MCP command here (default read-only policy)."
    ;;
  docker)
    echo "Configure your Docker MCP command here (default read-only policy)."
    ;;
  grafana)
    echo "Configure your Grafana MCP command here (default read-only policy)."
    ;;
  firebase)
    echo "Configure your Firebase MCP command here (default read-only policy)."
    ;;
  *)
    echo "Unknown MCP server: $server"
    exit 1
    ;;
esac
