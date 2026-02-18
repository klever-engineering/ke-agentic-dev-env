# __PROJECT_NAME__

This repository was initialized with the **Klever Generic Agentic Environment** scaffold.

## Why this exists

This workspace provides a repeatable baseline for agentic development:

- clear governance (`AGENTS.md`)
- deterministic quality gates (`scripts/ci/preflight.sh`)
- machine-readable contract (`agent-context.json`)
- playbooks and handoff standards (`doc/agents/*`)
- context engineering lifecycle (`context-engineering/`)
- issue/PR intake templates for cloud agents (`.github/`)

## Quick start

1. Copy environment files and fill placeholders:
   - `.env.example -> .env`
   - `.env.mcp.example -> .env.mcp`
   - set `GITHUB_API_TOKEN` in `.env` for `gh`-based automation
2. During `init`/`wrap`, the CLI asks for your LLM provider key (`openai`, `anthropic`, or `gemini`) and does not persist secrets to files.
3. Review and adapt `AGENTS.md` for this product.
4. Validate baseline:
   - `./scripts/ci/preflight.sh`
5. Create your first sprint task with `.github/ISSUE_TEMPLATE/agentic-sprint-task.yml`.

## Repository workflow

- Clone managed product repositories using `klever add <repo-url>`.
- Repositories are stored under `repositories/`.
- Run `klever scan --write` to generate repository context artifacts under `context-engineering/sources/repositories/`.

## Profiles

This scaffold supports three setup profiles:

- `foundation`: sprint-1 baseline (governance, preflight, intake, safety, KPIs).
- `context-ops`: foundation + context inventory/collection/maintenance artifacts.
- `full`: context-ops + MCP/skills governance and setup templates.

## Core paths

- `AGENTS.md`
- `agent-context.json`
- `context-engineering/`
- `doc/agents/playbooks/`
- `doc/agents/handoffs/`
- `doc/operations/agent-safety-boundaries.md`
- `doc/operations/llm-provider-setup.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/workflows/`

## Initialization metadata

- Generated on: `__DATE__`
- Intended org: `__ORG_NAME__`
- Intended repo: `__REPO_NAME__`
