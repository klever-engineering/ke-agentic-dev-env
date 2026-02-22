# Workspace Migrations

Klever supports versioned workspace migrations so repositories initialized with older releases can be upgraded safely.

## Why this exists

Without migration metadata, each workspace becomes a snowflake. `klever migrate` adds:

- explicit source/target version handling
- deterministic migration planning
- idempotent apply behavior
- local backup/rollback safety
- machine-readable reports for automation

## Workspace manifest

Klever writes `.klever/workspace.json` during `init`/`wrap`.

Core fields:

- `klever_version_applied`
- `profile`
- `init_mode`
- `artifact_schema_versions`
- `migration_history`

This manifest is the primary source for migration version inference.

## Command model

```bash
# preview changes
klever migrate . --plan

# CI/automation check
klever migrate . --check --json

# execute migration
klever migrate . --apply

# rollback from snapshot id
klever migrate . --rollback <snapshot-id>
```

Optional version overrides:

```bash
klever migrate . --from 0.3.0 --to 0.4.0 --plan
```

Defaults:

- `--to` defaults to `0.4.0`
- `--from` is inferred from `.klever/workspace.json`
- if manifest is missing, Klever uses `0.3.0` heuristic when legacy workspace markers exist

## Safety model

Before apply, Klever snapshots files that will change:

- backups: `.klever/backups/<snapshot-id>/...`
- reports: `.klever/migrations/<snapshot-id>.json`

Rollback restores from backup snapshot:

```bash
klever migrate . --rollback <snapshot-id>
```

## Current supported migration path

Implemented now:

- `0.3.0 -> 0.4.0`

Current operation:

- upsert `.klever/workspace.json` with applied version `0.4.0`
- append migration history/timestamps

Future releases should add explicit migration modules for each supported step.

## Operational workflow for many repositories

For each workspace:

1. `klever migrate <workspace> --check --json`
2. if `pending_operations > 0`, run `--apply`
3. archive migration report artifact
4. optional post-check: run `klever scan --write`

Recommended batching:

- migrate by repository cohort (5-20 at a time)
- monitor failures/conflicts
- keep snapshot ids in rollout notes

## Failure and recovery

Typical failure classes:

- unsupported version path
- missing/invalid workspace target
- manual file drift creating semantic conflicts in future migrations

Recovery:

1. inspect `.klever/migrations/<snapshot-id>.json`
2. rollback with snapshot id
3. retry with explicit `--from/--to` if needed

## Authoring policy for future migrations

Every new migration should be:

- idempotent
- deterministic
- non-destructive by default
- report-producing
- rollback-capable

Do not ship a breaking scaffold change without a migration path or explicit incompatibility note.
