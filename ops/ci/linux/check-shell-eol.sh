#!/usr/bin/env bash
set -euo pipefail

failed=0
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  if LC_ALL=C grep -q $'\r' "$file"; then
    echo "::error file=${file}::Tracked shell script contains CR bytes"
    failed=1
  fi
done < <(git ls-files -z --cached --others --exclude-standard '*.sh')

exit "$failed"
