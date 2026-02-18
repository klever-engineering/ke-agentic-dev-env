# Incident Response Playbook

## Required inputs

- incident identifier
- impacted systems/users
- alert/timeline evidence

## Execution flow

1. classify severity and risk level
2. stabilize system (containment first)
3. collect evidence and identify likely cause
4. apply minimal safe remediation
5. validate recovery and open follow-up tasks

## Validation commands

- `./scripts/monitor/deployment_health.sh`
- `./scripts/ci/preflight.sh --quick`

## Rollback strategy

- restore last known good state
- revert emergency changes if needed

## Done criteria

- service stabilized
- incident notes captured
- remediation and prevention tasks created
