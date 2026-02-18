#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT="$ROOT_DIR/agent-context.json"

if [ ! -f "$CONTRACT" ]; then
  echo "agent-context.json not found"
  exit 1
fi

node - "$CONTRACT" <<'NODE'
const fs = require('fs');
const contractPath = process.argv[2];
const required = ['version', 'workspace', 'documentation', 'scripts', 'validation_commands'];
const data = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

for (const key of required) {
  if (!(key in data)) {
    console.error(`Missing required key: ${key}`);
    process.exit(1);
  }
}

if (!data.workspace || !data.workspace.name || !data.workspace.root_path) {
  console.error('workspace.name and workspace.root_path are required');
  process.exit(1);
}

console.log('agent-context.json structure looks valid');
NODE
