#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=0

while IFS= read -r file; do
  while IFS= read -r link; do
    target="$link"
    target="${target%%#*}"

    case "$target" in
      ""|http://*|https://*|mailto:*|tel:*)
        continue
        ;;
    esac

    dir="$(dirname "$file")"
    if [ ! -e "$dir/$target" ] && [ ! -e "$target" ]; then
      echo "Broken link in $file -> $link"
      FAILED=1
    fi
  done < <(grep -oE '\[[^]]+\]\(([^)]+)\)' "$file" | sed -E 's/.*\(([^)]+)\).*/\1/' || true)
done < <(find . -type f -name '*.md' -not -path './.git/*' -not -path './node_modules/*')

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi

echo "Markdown links look valid"
