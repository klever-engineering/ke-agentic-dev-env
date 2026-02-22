# Changelog

All notable changes to this project are documented in this file.

The format is inspired by Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

- New simplified operator workflow command:
  - `klever up [target-dir]`
  - runs scan with sensible mode presets and can continue to trusted MCP setup.
- Command aliases for faster usage:
  - `u`, `s`, `m`, `a`, `ad`
- Scan preset flag:
  - `klever scan --mode quick|balanced|deep`

### Changed

- CLI help expanded to document simplified flow and mode presets.

## [0.3.1] - 2026-02-21

### Added

- New MCP command family:
  - `klever mcp suggest [target-dir]`
  - `klever mcp install [target-dir] --servers <ids> --client <vscode|codex|claude|all>`
- Trusted MCP recommendation model from:
  - Docker Desktop MCP Toolkit
  - VSCode `@mcp` servers catalog
- Dynamic MCP suggestions derived from scanned technology signals in repository source maps.
- MCP registration outputs for client conventions:
  - `.vscode/mcp.json`
  - `.mcp.json` (Claude project scope)
  - `.codex/mcp.json`
- Installation summary artifacts:
  - `context-engineering/scan/mcp-install-summary.json`
  - `context-engineering/scan/mcp-install-summary.md`

### Changed

- `mcp-suggestions` generation now uses trusted-source catalog mappings instead of ad-hoc server identifiers.
- CLI help updated with MCP options (`--servers`, `--client`, `--all`, `--register-mode`).

## [0.3.0] - 2026-02-20

### Added

- Open-source governance baseline:
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`
  - GitHub issue templates (`bug_report`, `feature_request`)
  - pull request template
  - Dependabot configuration for npm and GitHub Actions
- Packaging hardening:
  - explicit `files` allowlist in `package.json`
  - `publishConfig.access=public` for npm scoped publish

### Changed

- Repository naming and metadata updated from `ke-agentic-dev-env-codex` to `ke-agentic-dev-env`.
- `package.json` repository/homepage/issues URLs updated to the new repository path.
- README badges and release line updated to `v0.3.0`.

### Removed

- `ROADMAP.md` removed from repository history and current tree.

## [0.2.0] - 2026-02-18

### Added

- `klever scan` executor orchestration:
  - detect local coding agents (`codex`, `copilot`, `claude`, `gemini`)
  - choose executor interactively or via flags (`--scan-executor`, `--scan-method`)
  - delegate scan work by generating `context-engineering/scan/delegated-scan-request.md`
- Deep scan artifact generation:
  - `context-engineering/sources/repositories/source-map.json`
  - `context-engineering/sources/repositories/mcp-suggestions.json`
  - `context-engineering/sources/repositories/mcp-suggestions.md`
- Scan reporting enhancements for execution mode, deep artifacts, and scan roots.
- Automatic root `AGENTS.md` managed section refresh after `scan` and `add`.

### Changed

- Repository discovery for `klever scan` now auto-detects both `repository/` and `repositories/` folders.
- `klever add` continues to clone into `repositories/` while scan supports legacy/singular layouts.

## [0.1.0] - 2026-02-18

### Added

- New primary CLI binary name: `klever` (while keeping `klever-agentic` compatibility alias).
- New CLI commands:
  - `klever scan [target-dir]` for workspace readiness inspection plus repository artifact generation.
  - `klever add <git-repository-url> [target-dir]` for cloning repositories into `/repositories` and registering source entries in context catalog.
- Initial npm CLI scaffold package `@klever/agentic-environment` with `init` and `wrap` commands.
- Profile-based module system:
  - `foundation`
  - `context-ops`
  - `full`
- Core agentic baseline templates:
  - `AGENTS.md`, playbooks, handoff templates, safety boundaries, KPI templates.
  - issue/PR templates and foundational GitHub workflows.
- Context-engineering framework:
  - source catalog and ownership matrix
  - collectors for code, environment, infrastructure, AWS, Grafana, and network
  - context validation (freshness, required domains)
  - scheduled context refresh workflow
- LLM major-provider support in scaffold flow (OpenAI, Anthropic, Gemini):
  - interactive provider selection on init/wrap
  - runtime-only API key handling (no secret persistence to generated files)
  - provider validation script for preflight
- Knowledge-layer build tooling:
  - `scripts/context/build_knowledge_layer.mjs`
  - optional integration via `collect_all.sh --build-knowledge`
- MCP and skills governance templates for `full` profile.

### Changed

- Standardized GitHub token naming in templates and scripts to `GITHUB_API_TOKEN`.

### Security

- Added stronger guidance and checks to keep API tokens out of repository files.
- Redaction and secret-scan policies integrated into context workflows.
