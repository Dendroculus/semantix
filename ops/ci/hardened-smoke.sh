#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -f docker-compose.prod.yml)
python_command="${PYTHON_COMMAND:-python3}"

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT

"${compose[@]}" up --build --detach --wait --wait-timeout 180

curl --fail --silent --show-error http://127.0.0.1:18080/health
curl --fail --silent --show-error http://127.0.0.1:18080/ready

first="$(
  curl --fail --silent --show-error \
    --header "Authorization: Bearer phase-a-smoke-token" \
    --header "Content-Type: application/json" \
    --data '{"prompt":"Phase A hardened smoke"}' \
    http://127.0.0.1:18080/api/v1/query
)"
second="$(
  curl --fail --silent --show-error \
    --header "Authorization: Bearer phase-a-smoke-token" \
    --header "Content-Type: application/json" \
    --data '{"prompt":"Phase A hardened smoke"}' \
    http://127.0.0.1:18080/api/v1/query
)"

"$python_command" -c \
  'import json, sys; payload = json.loads(sys.argv[1]); assert payload["cache_hit"] is False; assert payload["provider_called"] is True' \
  "$first"
"$python_command" -c \
  'import json, sys; payload = json.loads(sys.argv[1]); assert payload["cache_hit"] is True; assert payload["provider_called"] is False' \
  "$second"

if (( $# > 0 )); then
  "$@"
fi
