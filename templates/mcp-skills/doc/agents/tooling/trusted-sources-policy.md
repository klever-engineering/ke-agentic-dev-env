# Trusted-Source Policy for MCP and Skills

## Trust tiers

1. Tier A: official/vendor-maintained
2. Tier B: vetted OSS (reviewed, pinned versions)
3. Tier C: unverified or disallowed sources

## Rules

- Default allow: Tier A
- Tier B requires security review and version pin
- Tier C blocked by default

## Mandatory checks

- provenance and owner recorded
- scopes/permissions minimized
- read-only by default where feasible
- upgrade cadence and rollback plan documented
