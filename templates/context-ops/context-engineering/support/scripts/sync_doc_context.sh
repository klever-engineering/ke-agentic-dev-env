#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${1:-$ROOT_DIR/input/incoming-doc}"
RUN_TS="$(date +%Y%m%d_%H%M%S)"
RUN_DATE="$(date +%F)"
BATCH="doc-sync-${RUN_DATE}-${RUN_TS}"

INPUT_BATCH_DIR="$ROOT_DIR/input/$BATCH"
CURATED_DIR="$ROOT_DIR/sources/odoo-docs/context"
CATALOG_FILE="$ROOT_DIR/sources/odoo-docs/catalog.md"
METADATA_FILE="$ROOT_DIR/sources/odoo-docs/metadata.md"
PROCESSING_LOG="$ROOT_DIR/support/processing-log.md"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source dir not found: $SOURCE_DIR"
  exit 1
fi

mkdir -p "$INPUT_BATCH_DIR" "$CURATED_DIR"
rsync -a "$SOURCE_DIR/" "$INPUT_BATCH_DIR/"
rsync -a --delete "$SOURCE_DIR/" "$CURATED_DIR/"

{
  echo "# Odoo Docs Catalog"
  echo
  echo "Generated on ${RUN_DATE}."
  echo
  echo "| File | Relative Path |"
  echo "| --- | --- |"
  find "$CURATED_DIR" -type f -name '*.md' | sort | while read -r abs; do
    rel="${abs#${CURATED_DIR}/}"
    file="$(basename "$rel")"
    printf '| `%s` | `%s` |\n' "$file" "$rel"
  done
} > "$CATALOG_FILE"

{
  echo "# Odoo Docs Metadata"
  echo
  echo "Generated on ${RUN_DATE}."
  echo
  echo "| Path | Priority |"
  echo "| --- | --- |"
  find "$CURATED_DIR" -type f -name '*.md' | sort | while read -r abs; do
    rel="${abs#${CURATED_DIR}/}"
    printf '| `%s` | `normal` |\n' "$rel"
  done
} > "$METADATA_FILE"

{
  echo
  echo "## ${RUN_DATE}"
  echo
  echo "- Synced docs from \\`$SOURCE_DIR\\`"
  echo "- Input snapshot: \\`input/$BATCH/\\`"
  echo "- Curated docs refreshed in \\`sources/odoo-docs/context/\\`"
} >> "$PROCESSING_LOG"

echo "Doc context sync complete"
