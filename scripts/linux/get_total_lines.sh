#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

declare -a records=()
declare -A extension_files=()
declare -A extension_lines=()
declare -A ignored_tracked=()

extension_label() {
  local path="$1"
  local name="${path##*/}"

  if [[ "$name" == .* && "$name" != .*.* ]]; then
    printf '%s' "$name" | tr '[:upper:]' '[:lower:]'
  elif [[ "$name" == *.* ]]; then
    printf '.%s' "${name##*.}" | tr '[:upper:]' '[:lower:]'
  else
    printf '<none>'
  fi
}

line_count() {
  awk 'END { print NR + 0 }' "$1"
}

is_text_file() {
  local path="$1"
  [[ ! -s "$path" ]] || LC_ALL=C grep -Iq '' "$path"
}

while IFS= read -r -d '' ignored_path; do
  ignored_tracked["$ignored_path"]=1
done < <(
  git -C "$repo_root" ls-files \
    --cached \
    --ignored \
    --exclude-standard \
    -z
)

while IFS= read -r -d '' relative_path; do
  [[ -z "${ignored_tracked[$relative_path]+present}" ]] || continue
  case "${relative_path##*/}" in
    package.json|package-lock.json)
      continue
      ;;
  esac

  absolute_path="$repo_root/$relative_path"
  [[ -f "$absolute_path" ]] || continue
  is_text_file "$absolute_path" || continue

  extension="$(extension_label "$relative_path")"
  lines="$(line_count "$absolute_path")"
  records+=("${extension}"$'\t'"${lines}"$'\t'"${relative_path}")
  extension_files["$extension"]=$(( ${extension_files["$extension"]:-0} + 1 ))
  extension_lines["$extension"]=$(( ${extension_lines["$extension"]:-0} + lines ))
done < <(
  git -C "$repo_root" ls-files \
    --cached \
    --others \
    --exclude-standard \
    -z
)

if (( ${#records[@]} == 0 )); then
  echo "No non-ignored text files were found."
  exit 0
fi

total_lines=0
largest_extension=""
largest_lines=-1

for extension in "${!extension_lines[@]}"; do
  lines="${extension_lines[$extension]}"
  total_lines=$((total_lines + lines))
  if (( lines > largest_lines )); then
    largest_extension="$extension"
    largest_lines="$lines"
  fi
done

printf '%s\n' '========================================================================'
printf 'SEMANTIX PROJECT LINE REPORT\n'
printf '%s\n' '========================================================================'
printf 'Scope: Git-tracked and unignored text files\n'
printf 'Excluded: binary files, package.json, and package-lock.json\n'
printf 'Files: %s\n' "${#records[@]}"
printf 'Lines: %s\n' "$total_lines"
printf 'Largest extension: %s (%s lines)\n\n' \
  "$largest_extension" "$largest_lines"
printf 'EXTENSION SUMMARY\n'
printf '%s\n' '------------------------------------------------------------------------'
printf '%-14s %8s %12s %8s\n' "Extension" "Files" "Lines" "Share"
printf '%-14s %8s %12s %8s\n' "---------" "-----" "-----" "-----"

while IFS=$'\t' read -r lines files extension; do
  share="$(awk -v lines="$lines" -v total="$total_lines" \
    'BEGIN { printf "%.1f%%", (lines / total) * 100 }')"
  printf '%-14s %8s %12s %8s\n' \
    "$extension" "$files" "$lines" "$share"
done < <(
  for extension in "${!extension_lines[@]}"; do
    printf '%s\t%s\t%s\n' \
      "${extension_lines[$extension]}" \
      "${extension_files[$extension]}" \
      "$extension"
  done | sort -t $'\t' -k1,1nr -k3,3
)

while IFS= read -r extension; do
  upper_extension="$(printf '%s' "$extension" | tr '[:lower:]' '[:upper:]')"
  file_label="files"
  (( extension_files["$extension"] == 1 )) && file_label="file"
  printf '\n[%s] %s %s | %s lines\n' \
    "$upper_extension" \
    "${extension_files[$extension]}" \
    "$file_label" \
    "${extension_lines[$extension]}"
  printf '%s\n' '------------------------------------------------------------------------'
  printf '%8s  %s\n' "Lines" "File"
  printf '%8s  %s\n' "-----" "----"

  printf '%s\n' "${records[@]}" |
    awk -F '\t' -v extension="$extension" '$1 == extension { print $2 "\t" $3 }' |
    sort -t $'\t' -k1,1nr -k2,2 |
    while IFS=$'\t' read -r lines path; do
      printf '%8s  %s\n' "$lines" "$path"
    done
  done < <(printf '%s\n' "${!extension_lines[@]}" | sort)
