# Context Security and Redaction Policy

## Data classes

1. safe to store
2. redact-required
3. never-store

## Redact-required examples

- private IPs
- cloud account IDs
- internal hostnames
- direct contact identifiers (emails)
- secret-like values (password/token/key)

## Never-store examples

- private keys
- raw tokens
- plaintext credentials
- full secret-bearing payloads from third-party APIs

## Enforcement

- collectors must call `scripts/context/lib/redaction.sh`
- `scripts/secret-scan.sh` must pass before commit
- record `metadata.redacted_fields` in snapshots
- collectors should prefer summary counts over raw operational payloads

## GitHub token handling

- use `.env` entry `GITHUB_API_TOKEN` for `gh` CLI access
- never write token values into snapshots or logs
- keep GitHub snapshots metadata-level (counts, refs) unless explicitly approved

## LLM token handling

- initialization prompts for provider keys; keys are not persisted by the scaffold CLI
- export tokens only in runtime environment or secret manager
- never commit `.env` with real LLM keys
- review AI-generated knowledge outputs for accidental secret leakage
