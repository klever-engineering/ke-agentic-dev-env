# Endpoint/Service Change Playbook

## Required inputs

- API/service contract change summary
- compatibility and migration requirements
- impacted consumers

## Execution flow

1. define target contract
2. implement change with backward-compat plan
3. update tests and docs
4. run validation suite
5. communicate release notes

## Validation commands

- `./scripts/qa/run_qa.sh --scope api`
- `./scripts/ci/preflight.sh`

## Rollback strategy

- feature flag or revert commit
- restore previous contract behavior

## Done criteria

- contract verified
- consumer impacts documented
- rollback path tested or confirmed
