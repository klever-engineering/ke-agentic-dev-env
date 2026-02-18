# Agent Safety Boundaries

Define safe automation limits for autonomous execution.

## Risk classes

- Low: local/docs/tests, reversible.
- Medium: non-prod writes, reversible with clear rollback.
- High: shared infra/prod-adjacent changes, HITL required.
- Critical: destructive or irreversible operations, blocked without explicit human approval.

## Prohibited without explicit human approval

- production data deletion/truncation
- force-push to protected branches
- destructive cloud infrastructure actions
- credential rotation in production

## Guardrail model

1. classify operation risk before execution
2. require HITL for high/critical
3. prefer read-only and dry-run defaults
4. log action, evidence, and rollback context

## Safe alternatives

- run in local/staging first
- use non-destructive validations
- keep reversible commits and documented rollback steps
