#!/usr/bin/env bash
set -euo pipefail

# Scan tracked text files for accidental local path leakage.
# Keep this list focused on high-signal patterns that should never be committed.
PATTERNS=(
  '/home/'
  '/media/'
)

echo "Running leak guard against tracked files..."

files="$(git ls-files)"
if [ -z "${files}" ]; then
  echo "No tracked files found."
  exit 0
fi

fail=0
for pattern in "${PATTERNS[@]}"; do
  # -I skips binary files; --fixed-strings avoids regex surprises.
  if matches="$(printf '%s\n' "$files" | xargs -r rg -n -I --fixed-strings "$pattern" 2>/dev/null)"; then
    if [ -n "$matches" ]; then
      echo "Leak guard violation: found pattern '$pattern'"
      echo "$matches"
      fail=1
    fi
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Leak guard failed."
  exit 1
fi

echo "Leak guard passed."
