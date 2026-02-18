# Context-Engineering Findings

This document captures context-engineering capabilities extracted from shared repositories and sprint tasks, and how they were encoded in the scaffold.

## Sources analyzed

- `[REDACTED_SOURCE_REPO_06]` context ops docs/scripts and sprint task descriptions (`#13`-`#18`)
- `[REDACTED_SOURCE_REPO_09]` context catalog, sync pipeline, DB model extraction
- `[REDACTED_SOURCE_REPO_05]` lightweight context-ready/context-wip split
- `[REDACTED_SOURCE_REPO_01]` context-engine pilot and infrastructure context builder patterns

## Capabilities extracted

1. Canonical lifecycle split
- `input` (raw)
- `sources` (curated)
- `support` (logs/templates/scripts)
- `snapshots` for generated machine-readable artifacts

2. Domain-based context model
- code
- environment
- infrastructure
- aws
- grafana
- network

3. Source registry as control plane
- explicit source ID, owner, cadence, TTL, collector mapping
- required vs optional domains
- dependency mapping (credentials/tools)

4. Ownership and freshness governance
- owner per source/domain
- refresh cadence per source
- TTL/SLO-based freshness checks

5. Schema-first context contracts
- workspace contract (`agent-context.json`)
- snapshot contract (`schemas/context-snapshot.schema.json`)

6. Collection orchestration
- collector scripts per domain
- orchestrator (`collect_all.sh`)
- validation gate (`validate_context.sh`)

7. Security and redaction
- redaction helper library
- class-based data handling (safe/redact/never-store)
- secret-scan integration

8. Operationalization
- scheduled context refresh workflow
- escalation and maintenance docs
- processing logs for auditability

9. Knowledge-layer synthesis
- provider-agnostic LLM abstraction (OpenAI/Anthropic/Gemini)
- source-to-knowledge transformation under `context-engineering/sources/knowledge/`
- explicit human review step before commit

## Sprint-derived requirements (IE)

From Sprint 2 tasks (`#13`-`#18`), the generic baseline must guarantee:

- inventory + ownership matrix exists
- contracts/schemas are machine-parseable
- one command runs collection end-to-end
- validation catches missing/stale/incomplete context
- scheduled maintenance is documented and runnable
- security/redaction policy is enforceable by scripts

## Mapping to scaffold module

All capabilities above are represented in the `context-ops` module, including:

- `context-engineering/sources/catalog.yaml`
- `scripts/context/collect_{code,environment,infrastructure,aws,grafana,network}.sh`
- `scripts/context/build_knowledge_layer.mjs`
- `scripts/context/collect_all.sh`
- `scripts/context/validate_context.sh`
- `.github/workflows/context-refresh.yml`

## Non-goals in current version

- no hardcoded cloud account/project identifiers
- no write-by-default external collectors
- no mandatory adoption of one cloud/observability provider
