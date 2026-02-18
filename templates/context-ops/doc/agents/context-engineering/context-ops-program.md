# Context Ops Program

## Objective

Ensure agents execute with reliable, fresh, and secure context across code, environment, runtime, cloud, observability, and network domains.

## Principles

1. Canonical source per domain
2. Human + machine-readable artifacts
3. TTL-driven freshness policy
4. Ownership and escalation path
5. Schema validation and drift detection
6. Security-first redaction

## Lifecycle

1. discover and register sources in `context-engineering/sources/catalog.yaml`
2. collect snapshots via `scripts/context/*`
3. validate structure and freshness via `scripts/context/validate_context.sh`
4. publish in canonical paths under `context-engineering/snapshots/`
5. synthesize knowledge layer via `scripts/context/build_knowledge_layer.mjs`
6. refresh on schedule using `.github/workflows/context-refresh.yml`
7. audit drift, ownership gaps, and security findings

## Domain baseline

Required domains:

- code
- environment
- infrastructure
- network

Optional domains:

- aws
- grafana

## Recommended freshness SLOs

- code: 168h
- environment: 720h
- infrastructure: 24h
- grafana: 24h
- network: 24h
- aws: 168h
