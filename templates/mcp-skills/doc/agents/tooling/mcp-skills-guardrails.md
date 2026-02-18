# MCP and Skills Guardrails

## Action classes

- read-only
- low-risk write
- high-risk write

## Enforcement

- read-only: allowed by default
- low-risk write: requires linked issue + rollback notes
- high-risk write: requires HITL explicit approval and audit log entry

## Audit requirements

Record tool/skill used, command intent, impacted resource, and outcome.
