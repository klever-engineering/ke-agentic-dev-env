# Klever Documentation

Klever is a CLI for building and operating an agentic development workspace.

## Start here

- [Default Workflow](./default-workflow.md)
- [Agent-Friendly Examples](./agent-friendly-examples.md)
- [Architecture](./architecture.md)
- [Capability Matrix](./capability-matrix.md)
- [Context Engineering Findings](./context-engineering-findings.md)
- [Versioning Policy](./versioning-policy.md)

## What agents should read first

Agents should bootstrap context in this order:

1. `AGENTS.md`
2. `agent-context.json`
3. `context-engineering/scan/scan-summary.json`
4. `context-engineering/sources/repositories/source-map.json`
5. `context-engineering/sources/repositories/*.intelligence.md`
6. `context-engineering/sources/system-map.json`
7. `context-engineering/sources/addon-suggestions.json`

This sequence reduces hallucinations and improves plan quality before code changes.

## CLI command families

- `klever init` and `klever wrap`
- `klever add`
- `klever scan`
- `klever up`
- `klever mcp suggest` and `klever mcp install`
- `klever addons list|install|run`
- `klever config init|show`
