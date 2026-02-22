# Agent-Friendly Examples

This page uses explicit command + input/output patterns that coding agents can parse quickly.

## Example A: bootstrap a new workspace

Goal:

- create agentic environment
- add repositories
- generate deep context

Commands:

```bash
klever init ./ws --profile full --llm-provider openai
klever config init ./ws
klever add https://github.com/odoo/odoo ./ws
klever up ./ws --json
```

Artifacts to read next:

- `ws/AGENTS.md`
- `ws/context-engineering/scan/scan-summary.json`
- `ws/context-engineering/sources/repositories/source-map.json`
- `ws/context-engineering/sources/repositories/odoo.intelligence.md`

## Example B: delegate scan to local coding agent

Goal:

- use installed local agent instead of direct LLM API

Command:

```bash
klever scan ./ws --scan-executor codex --scan-method deep --write
```

Delegation artifact:

- `ws/context-engineering/scan/delegated-scan-request.md`

## Example C: auto-detect repositories folder

Goal:

- run scan without target argument

Commands:

```bash
cd ./ws
klever scan --json
```

Behavior:

- scans current workspace
- discovers and scans `./repositories/*`

## Example D: MCP setup for all supported clients

Goal:

- register MCPs in VSCode, Codex, and Claude conventions

Commands:

```bash
klever mcp suggest ./ws
klever mcp install ./ws --all --client all --register-mode auto
```

Registration files:

- `ws/.vscode/mcp.json`
- `ws/.codex/mcp.json`
- `ws/.mcp.json`

Summary artifact:

- `ws/context-engineering/scan/mcp-install-summary.json`

## Example E: refresh and regenerate context after refactor

Goal:

- re-sync context after major changes

Commands:

```bash
klever scan ./ws --mode deep --write
```

Expected updates:

- refreshed repository intelligence
- refreshed system map
- refreshed addon suggestions
- updated managed context block in `AGENTS.md`

## Prompt template for coding agents

Use this prompt after running scan:

```text
Read these files in order and propose a high-confidence implementation plan with risks:
1) AGENTS.md
2) context-engineering/scan/scan-summary.json
3) context-engineering/sources/repositories/source-map.json
4) context-engineering/sources/repositories/*.intelligence.md
5) context-engineering/sources/system-map.json

Constraints:
- cite exact file paths you rely on
- separate known facts from assumptions
- include rollback and test strategy
```
