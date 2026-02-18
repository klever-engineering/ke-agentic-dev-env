# ke-agentic-dev-env-codex

[![CI](https://github.com/klever-engineering/ke-agentic-dev-env-codex/actions/workflows/ci.yml/badge.svg)](https://github.com/klever-engineering/ke-agentic-dev-env-codex/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](./CHANGELOG.md)

Generic template repository and npm CLI scaffold for agentic development environments.

## Package intent

Consolidate best practices from multiple internal agentic repositories into one reusable bootstrap tool.

Implemented as CLI package:

- package: `@klever/agentic-environment`
- bin: `klever`

Install style:

```bash
npm install -g @klever/agentic-environment
```

## Commands

```bash
# create a fresh environment
klever init <target-dir> --profile foundation

# wrap an existing repository
klever wrap <target-dir> --profile full

# inspect workspace and generate scan artifacts
klever scan . --scan-executor auto --scan-method deep

# clone and register external source repository
klever add https://github.com/your-org/your-repo.git
```

`klever add` clones repositories into `repositories/<repo-name>` and updates `context-engineering/sources/catalog.yaml`.

`klever scan` now:
- detects local coding agents (`codex`, `copilot`, `claude`, `gemini`) and allows delegating scan execution
- falls back to `llm-api` mode when delegation is not selected
- generates deep artifacts under `context-engineering/sources/repositories/`:
  - `source-map.json`
  - `mcp-suggestions.json`
  - `mcp-suggestions.md`
- writes delegated scan prompt (when local agent mode is selected):
  - `context-engineering/scan/delegated-scan-request.md`

Initialization asks for your LLM provider/API key (`openai`, `anthropic`, or `gemini`) and keeps the key in runtime memory/environment only. It is not persisted to scaffold files.

## Profiles

- `foundation`
  - AGENTS governance
  - playbooks
  - handoffs
  - safety boundaries
  - issue/PR intake templates
  - preflight + basic validation scripts
  - KPI/sprint snapshots

- `context-ops`
  - extends foundation
  - source catalog (`context-engineering/sources/catalog.yaml`)
  - context source inventory + ownership templates
  - context snapshot schema
  - collectors: code, environment, infrastructure, aws, grafana, network
  - LLM knowledge builder: `scripts/context/build_knowledge_layer.mjs`
  - redaction library
  - freshness + required-domain validation gates
  - scheduled context refresh workflow

- `full`
  - extends context-ops
  - trusted-source policy for MCP/skills
  - MCP client setup docs/config
  - skills catalog lifecycle templates
  - action gate/guardrail docs

## Context-engineering priority

The most important reusable capability in this scaffold is context engineering:

- domain-based context model and source registry
- deterministic collection and validation
- security/redaction policy built into collectors
- ownership and freshness operationalized via workflow + runbooks

## Key project docs

- `docs/capability-matrix.md`
- `docs/context-engineering-findings.md`
- `docs/architecture.md`
- `docs/versioning-policy.md`
- `CHANGELOG.md`

## Local test

```bash
npm test
```

## Release notes

- Current release line: `v0.1.0`
- Changelog: `CHANGELOG.md`
- License: `LICENSE`
