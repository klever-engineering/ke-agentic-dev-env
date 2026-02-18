# Agent Context Contract

`agent-context.json` is the machine-readable contract for workspace layout and validation expectations.

## Contract goals

- reduce ambiguity for cloud agents
- centralize canonical paths
- define risk-sensitive areas
- provide deterministic validation commands

## How to validate

```bash
./scripts/validate_agent_context.sh
```

## Update rules

- Increment `version` when structure changes.
- Keep `$schema` path in sync with `schemas/agent-context.schema.json`.
- Only list canonical paths; avoid aliases.
