#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/sources/database-model/context"
mkdir -p "$OUT_DIR"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-app}"
DB_PASSWORD="${DB_PASSWORD:-}"

export PGPASSWORD="$DB_PASSWORD"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)

"${PSQL[@]}" -Atqc "select 1" >/dev/null

"${PSQL[@]}" -AtF"," -c "
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
" > "$OUT_DIR/tables.csv"

"${PSQL[@]}" -AtF"," -c "
SELECT table_schema, table_name, ordinal_position, column_name, data_type, is_nullable, COALESCE(column_default, '')
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
" > "$OUT_DIR/columns.csv"

TABLE_COUNT=$(wc -l < "$OUT_DIR/tables.csv" | tr -d ' ')
COLUMN_COUNT=$(wc -l < "$OUT_DIR/columns.csv" | tr -d ' ')

cat > "$OUT_DIR/schema_summary.md" <<MD
# Database Model Summary

Generated at (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)
Database: $DB_NAME
Connection: $DB_USER@$DB_HOST:$DB_PORT

- Tables: $TABLE_COUNT
- Columns: $COLUMN_COUNT

Artifacts:

- tables.csv
- columns.csv
MD

echo "Database model context generated at $OUT_DIR"
