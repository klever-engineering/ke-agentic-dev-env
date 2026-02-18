# __PROJECT_NAME__ Agent Handbook

This handbook is the operational baseline for autonomous and human contributors.

## 1. Startup Checklist

1. Read this file and `agent-context.json` before any change.
2. Confirm scope, risk level, and rollback strategy.
3. Run `./scripts/ci/preflight.sh` before commit/PR.
4. Use issue/PR templates in `.github/`.
5. Record validation evidence in issue comments and PR body.

## 2. Standard Workflows

- Playbooks: `doc/agents/playbooks/`
- Handoff protocol: `doc/agents/handoffs/`
- Safety boundaries: `doc/operations/agent-safety-boundaries.md`
- LLM setup: `doc/operations/llm-provider-setup.md`
- KPI model: `doc/agents/metrics/kpi-definitions.md`

## 3. Risk and HITL

Use risk classes from the safety boundaries doc:

- Low: docs/tests/local safe edits.
- Medium: non-prod reversible changes.
- High: shared infra/prod-facing operations -> requires HITL approval.
- Critical: destructive/irreversible operations -> blocked without explicit human authorization.

## 4. Issue Intake Rules

All implementation issues should include:

- Goal
- Scope (in/out)
- Affected paths
- Deliverables
- Acceptance criteria
- Risk level
- Rollback strategy

## 5. PR Requirements

All PRs must include:

- linked issue(s)
- risk classification
- test and validation evidence
- migration/env impacts
- rollback notes

## 6. Context Engineering Policy

- Canonical context workspace: `context-engineering/`
- Store raw input under `context-engineering/input/`
- Store curated context under `context-engineering/sources/`
- Keep processing notes under `context-engineering/support/`
- If `context-ops` profile is enabled, maintain source registry in `context-engineering/sources/catalog.yaml`

## 7. Security Baseline

- Never commit secrets.
- Use `.env`/secret managers, not source files.
- For GitHub automation, keep `GITHUB_API_TOKEN` only in local `.env`.
- For LLM operations, provide `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` at runtime; do not persist keys in repo files.
- Run `scripts/secret-scan.sh` locally before pushing.
- Keep security-sensitive operations auditable.

## 8. Continuous Improvement

At sprint close, produce a report from `doc/agents/metrics/sprint-report-template.md` and record KPI trends.
