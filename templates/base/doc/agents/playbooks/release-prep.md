# Release Prep Playbook

## Required inputs

- release scope and issue list
- risk classification
- deployment window constraints

## Execution flow

1. verify merged scope and freeze risky changes
2. run full quality gates
3. validate migration/env readiness
4. prepare rollback and communication plan
5. publish release checklist

## Validation commands

- `./scripts/qa/run_qa.sh --scope release`
- `./scripts/ci/preflight.sh`

## Rollback strategy

- restore previous release/tag
- run smoke checks after rollback

## Done criteria

- release checklist complete
- risk and rollback documented
- handoff to deploy owner complete
