# ke-agentic-dev-env-codex

Generic template repository and npm CLI scaffold for agentic development environments.

## Package intent

Consolidate best practices from multiple internal agentic repositories into one reusable bootstrap tool.

Implemented as CLI package:

- package: `@klever/agentic-environment`
- bin: `klever-agentic`

Install style:

```bash
npm install -g @klever/agentic-environment
```

## Commands

```bash
# create a fresh environment
node src/cli.mjs init <target-dir> --profile foundation

# wrap an existing repository
node src/cli.mjs wrap <target-dir> --profile full
```

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

## Local test

```bash
npm test
```
