# @klever/addon-odoo-business-model

Generates Odoo-specific context artifacts for agentic development workspaces.

## Output

By default, writes to:

- `context-engineering/sources/odoo-business-model/module-map.json`
- `context-engineering/sources/odoo-business-model/module-map.md`

## Usage

```bash
klever-addon-odoo-business-model --workspace /path/to/workspace
```

Optional arguments:

- `--repo <name>` (default: `odoo` when present)
- `--repo-path <path>` (absolute or workspace-relative)
- `--output-dir <path>` (absolute or workspace-relative)
