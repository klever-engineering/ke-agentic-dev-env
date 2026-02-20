# @klever/addon-odoo-business-model

Generates Odoo-specific expert context artifacts for agentic development workspaces.

## Output

By default, writes to:

- `context-engineering/sources/odoo-business-model/module-map.{json,md}`
- `context-engineering/sources/odoo-business-model/orm-model-map.{json,md}`
- `context-engineering/sources/odoo-business-model/security-map.{json,md}`
- `context-engineering/sources/odoo-business-model/ui-map.{json,md}`
- `context-engineering/sources/odoo-business-model/route-map.{json,md}`
- `context-engineering/sources/odoo-business-model/expert-summary.{json,md}`

## Usage

```bash
klever-addon-odoo-business-model --workspace /path/to/workspace
```

Optional arguments:

- `--repo <name>` (default: `odoo` when present)
- `--repo-path <path>` (absolute or workspace-relative)
- `--output-dir <path>` (absolute or workspace-relative)
