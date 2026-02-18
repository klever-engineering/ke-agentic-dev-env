# Context Maintenance

## Scheduled workflow

- workflow: `.github/workflows/context-refresh.yml`
- default cadence: daily
- baseline flow: collect -> validate -> commit snapshots

## Weekly checks

- review stale snapshot warnings
- review collector failures
- verify credential health (GitHub, AWS, Grafana)
- run knowledge-layer refresh after significant context-source changes
- confirm `context-engineering/sources/catalog.yaml` owners/cadence are still accurate

## Monthly checks

- review redaction patterns and findings
- review TTL settings and required domains
- prune old snapshots if needed
- update source inventory for new systems/repositories

## Incident scenarios

- collector failure
- stale or missing required domain snapshots
- secret detected in snapshot
- unexpected drift between source-of-truth and snapshots

## Escalation rule

If the same collector fails in 3 consecutive runs, escalate to source owner and platform lead.
