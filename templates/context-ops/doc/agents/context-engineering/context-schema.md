# Context Schema Guide

## Contracts

- workspace contract: `agent-context.json`
- snapshot contract: `schemas/context-snapshot.schema.json`
- source registry: `context-engineering/sources/catalog.yaml`

## Snapshot requirements

Required fields:

- `version`
- `snapshot_id`
- `timestamp`
- `domain`
- `source`
- `status`
- `data`

## Domain values

Supported snapshot domains:

- `code`
- `environment`
- `infrastructure`
- `aws`
- `grafana`
- `network`

## Freshness logic

- fresh: `age <= ttl`
- warning: `ttl < age <= 2 * ttl`
- error: `age > 2 * ttl`

## Required domain gate

Validation fails if required domains are missing:

- `code`
- `environment`
- `infrastructure`
- `network`

Optional domains can be enforced with env flags:

- `REQUIRE_AWS_CONTEXT=true`
- `REQUIRE_GRAFANA_CONTEXT=true`

## Versioning

Use semantic versioning for all context contracts.
