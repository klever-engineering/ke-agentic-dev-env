# Context Collection Runbook

## Manual execution

```bash
./scripts/context/collect_all.sh
./scripts/context/validate_context.sh
```

Optional skips:

```bash
./scripts/context/collect_all.sh --skip-aws --skip-grafana
./scripts/context/collect_all.sh --skip-code --skip-environment
./scripts/context/collect_all.sh --build-knowledge
```

## Collector set

- `collect_code.sh`
- `collect_environment.sh`
- `collect_infrastructure.sh`
- `collect_aws.sh`
- `collect_grafana.sh`
- `collect_network.sh`
- `build_knowledge_layer.mjs` (LLM-powered knowledge synthesis)

## Source-of-truth artifacts

- source catalog: `context-engineering/sources/catalog.yaml`
- snapshot schema: `schemas/context-snapshot.schema.json`
- processing log: `context-engineering/support/processing-log.md`

## Required credentials

- GitHub delivery metrics:
  - `GITHUB_ORG`
  - `GITHUB_REPO`
  - `GITHUB_API_TOKEN` in `.env` (used by `gh` CLI)
- AWS:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or profile)
- Grafana:
  - `GRAFANA_API_TOKEN`, `GRAFANA_URL`
- Knowledge layer build:
  - `LLM_PROVIDER` (`openai`, `anthropic`, `gemini`)
  - one of: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

## Post-collection

1. run validation (`scripts/context/validate_context.sh`)
2. run secret scan (`scripts/secret-scan.sh`)
3. append run notes to processing log
4. commit snapshots only if clean
5. review AI-generated knowledge artifacts before commit
