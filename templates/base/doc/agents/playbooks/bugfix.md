# Bugfix Playbook

## Required inputs

- issue link and reproduction steps
- affected paths/services
- expected vs actual behavior

## Execution flow

1. reproduce the bug
2. isolate root cause
3. patch with minimal blast radius
4. add or update tests
5. validate and document evidence

## Validation commands

- `./scripts/qa/run_qa.sh --scope bugfix`
- `./scripts/ci/preflight.sh`

## Rollback strategy

- revert patch commit
- confirm baseline behavior is restored

## Done criteria

- root cause fixed
- tests updated and passing
- issue/PR evidence recorded
