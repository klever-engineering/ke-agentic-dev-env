# Generator Architecture

## Components

- `src/cli.mjs`
  - argument parsing
  - command dispatch (`init`, `wrap`)
  - profile validation
  - interactive provider setup (OpenAI/Anthropic/Gemini)
  - optional post-scaffold knowledge-layer build

- `src/scaffold.mjs`
  - module selection by profile
  - template traversal and placeholder substitution
  - safe writes (`skip` existing files unless `--force`)
  - intra-run module override support

- `templates/`
  - `base`
  - `foundation`
  - `context-ops`
  - `mcp-skills`
  - `delivery`

## Context-engineering module architecture

`context-ops` defines a full context lifecycle:

- source control plane: `context-engineering/sources/catalog.yaml`
- collection plane: `scripts/context/collect_*.sh`
- knowledge synthesis plane: `scripts/context/build_knowledge_layer.mjs`
- validation plane: `scripts/context/validate_context.sh`
- governance plane: docs under `doc/agents/context-engineering/`
- automation plane: `.github/workflows/context-refresh.yml`

## File write behavior

- Existing files are preserved by default.
- `--force` overwrites existing files.
- Later modules in the same run can intentionally override earlier module files.

## Placeholder tokens

- `__PROJECT_NAME__`
- `__REPO_NAME__`
- `__ORG_NAME__`
- `__DATE__`
- `__YEAR__`
