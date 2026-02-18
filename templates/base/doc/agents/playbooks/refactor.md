# Refactor Playbook

## Required inputs

- refactor objective and non-goals
- stability constraints
- acceptance tests

## Execution flow

1. lock expected behavior with tests
2. refactor incrementally
3. keep commits small and reversible
4. verify no behavior regression
5. update architecture notes if needed

## Validation commands

- `./scripts/qa/run_qa.sh --scope refactor`
- `./scripts/ci/preflight.sh`

## Rollback strategy

- revert last refactor commit set
- re-run baseline tests

## Done criteria

- behavior unchanged
- complexity/maintainability improved
- tests and docs reflect new structure
