# Context Inventory and Ownership Matrix

The authoritative source registry lives in:

- `context-engineering/sources/catalog.yaml`

Use this matrix as the operator view. Keep IDs aligned with the catalog.

| Domain | Source ID | Source Path | Human Owner | Agent Owner | Cadence | TTL | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | `code-repo-map` | `context-engineering/snapshots/code_*.json` | engineering lead | software-process-agent | per merge + weekly | 168h | active |
| code | `github-delivery-state` | `context-engineering/snapshots/code_*.json` | delivery lead | software-process-agent | daily | 24h | active |
| environment | `local-toolchain-environment` | `context-engineering/snapshots/environment_*.json` | platform lead | software-process-agent | on change | 720h | active |
| infrastructure | `runtime-infrastructure` | `context-engineering/snapshots/infrastructure_*.json` | platform lead | software-process-agent | daily | 24h | active |
| aws | `cloud-aws-topology` | `context-engineering/snapshots/aws_*.json` | platform lead | software-process-agent | weekly | 168h | optional |
| grafana | `observability-grafana` | `context-engineering/snapshots/grafana_*.json` | observability lead | software-process-agent | daily | 24h | optional |
| network | `network-dns-edge` | `context-engineering/snapshots/network_*.json` | platform lead | software-process-agent | daily | 24h | active |
| code | `curated-product-docs` | `context-engineering/sources/odoo-docs/` | product owner | software-process-agent | on change | 720h | active |
| code | `database-model-context` | `context-engineering/sources/database-model/` | data owner | software-process-agent | weekly | 168h | active |
| code | `ai-knowledge-layer` | `context-engineering/sources/knowledge/knowledge-layer.*` | software-process-agent | software-process-agent | on demand | 168h | active |

## Required domain baseline

The default context baseline requires snapshots for:

- `code`
- `environment`
- `infrastructure`
- `network`

`aws` and `grafana` are optional by default and can be enforced by setting:

- `REQUIRE_AWS_CONTEXT=true`
- `REQUIRE_GRAFANA_CONTEXT=true`

## Escalation path

1. collector failure -> software-process-agent
2. repeated failure (>3 runs) -> human owner
3. security exposure or critical drift -> security reviewer + human owner
