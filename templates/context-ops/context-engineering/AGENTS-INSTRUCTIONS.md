# Context Catalog

This catalog tracks authoritative context datasets and collection behavior.

- source registry: `context-engineering/sources/catalog.yaml`
- generated artifacts: `context-engineering/snapshots/`
- processing log: `context-engineering/support/processing-log.md`

## Conventions

- new material enters `input/`
- curated artifacts live in `sources/`
- generated snapshots live in `snapshots/`
- avoid aliases and duplicate canonical paths

## Agent responsibilities

- keep source IDs stable in `catalog.yaml`
- run `scripts/context/collect_all.sh` then `scripts/context/validate_context.sh`
- do not store secrets in context artifacts
- append execution notes and anomalies to `support/processing-log.md`
