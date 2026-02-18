# Changelog

All notable changes to this project are documented in this file.

The format is inspired by Keep a Changelog and this project follows Semantic Versioning.

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
