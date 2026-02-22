# Default Workflow

This is the recommended operator flow for multi-repository agentic workspaces.

## 0. Install

```bash
npm install -g @klever/agentic-environment
klever --help
```

## 1. Initialize workspace

```bash
klever init ./my-agentic-workspace --profile full --llm-provider openai
```

Expected outputs:

- `AGENTS.md`
- `agent-context.json`
- `context-engineering/`
- `.vscode/mcp.json`, `.mcp.json`, `.codex/mcp.json`

## 2. Set persistent defaults

Use workspace defaults so future commands stay short and predictable.

```bash
klever config init ./my-agentic-workspace
klever config show ./my-agentic-workspace --json
```

Default merge order:

1. Global config (`~/.config/klever/config.json`)
2. Workspace config (`.klever/config.json`)
3. Explicit CLI flags

## 3. Add repositories

```bash
klever add https://github.com/your-org/service-a ./my-agentic-workspace
klever add https://github.com/your-org/service-b ./my-agentic-workspace
```

By default, `add` uses shallow clone (`--depth 1`) for speed.
Use `--full-history` only when historical analysis is required.

## 4. Run the default operation

```bash
klever up ./my-agentic-workspace
```

`klever up` runs:

1. `scan` with deep defaults
2. trusted MCP installation (if enabled by config/flags)

Primary artifacts after `up`:

- `context-engineering/scan/scan-summary.json`
- `context-engineering/sources/repositories/source-map.json`
- `context-engineering/sources/repositories/mcp-suggestions.json`
- `context-engineering/sources/repositories/*.intelligence.md`
- `context-engineering/sources/system-map.md`
- `context-engineering/sources/addon-suggestions.md`

## 5. Optional: install recommended MCP servers

```bash
klever mcp suggest ./my-agentic-workspace
klever mcp install ./my-agentic-workspace --all --client all --register-mode auto
```

Trusted catalogs currently used:

- Docker Desktop MCP Toolkit
- VSCode `@mcp` servers catalog

## 6. Optional: install and run addons

```bash
klever addons list ./my-agentic-workspace
klever addons install klever-addon-odoo-business-model ./my-agentic-workspace
klever addons run klever-addon-odoo-business-model ./my-agentic-workspace --repo odoo
```

## 7. Refresh context after major code changes

```bash
klever scan ./my-agentic-workspace --write
```

Recommended cadence:

- after adding/removing repositories
- after major architectural changes
- before asking an agent for implementation planning

## One-command variant

For most daily use, this is enough:

```bash
klever up ./my-agentic-workspace
```

With defaults configured, `up` should be the primary command.
