#!/usr/bin/env bash
set -euo pipefail

compose=(
  docker compose
  -f docker-compose.dev.yml
  -f ops/ci/docker-compose.dev-smoke.yml
)
backend_port="${BACKEND_PORT:-8000}"

cleanup() {
  "${compose[@]}" --profile pgvector down --volumes --remove-orphans
}
trap cleanup EXIT

export EMBEDDING_PROVIDER=mock
export GENERATION_PROVIDER=mock
export CACHE_BACKEND=memory

"${compose[@]}" up --build --detach --wait --wait-timeout 180
curl --fail --silent --show-error "http://127.0.0.1:${backend_port}/health"
"${compose[@]}" down --volumes --remove-orphans

export CACHE_BACKEND=pgvector
export DATABASE_URL=postgresql://semantix:semantix@postgres:5432/semantix

"${compose[@]}" --profile pgvector up --build --detach --wait --wait-timeout 180
curl --fail --silent --show-error "http://127.0.0.1:${backend_port}/ready"
"${compose[@]}" --profile pgvector down --volumes --remove-orphans

export CACHE_BACKEND=memory
export MOCK_EMBEDDING_DIMENSIONS=0

if "${compose[@]}" up --build --detach --wait --wait-timeout 45; then
  echo "Invalid backend configuration unexpectedly became healthy" >&2
  exit 1
fi
