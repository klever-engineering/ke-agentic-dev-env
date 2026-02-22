# Changelog

All notable changes to this project are documented in this file.

The format is inspired by Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

- Workspace migration framework:
  - `klever migrate --plan|--check|--apply|--rollback`
  - workspace manifest `.klever/workspace.json`
  - backup snapshots and migration reports

### Changed

- Security hardening defaults:
  - safe mode enabled by default
  - GitHub-only repository source policy in safe mode
  - vetted addon policy (`@klever/*` and bundled local addons)
  - MCP CLI registration restricted to file mode in safe mode
  - rollback snapshot-id validation
  - repository-intelligence prompt-injection guardrails

- Project metadata moved to unreleased state.
