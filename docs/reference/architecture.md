# Architecture

Semantix is a feature-first full-stack application. Features own their API,
orchestration, domain rules, and infrastructure only where those
responsibilities exist. Shared packages contain cross-feature composition and
utilities rather than feature behavior.

## Runtime flow

```mermaid
sequenceDiagram
    participant UI as React client
    participant API as Query API
    participant Query as QueryService
    participant Embed as EmbeddingProvider
    participant Cache as CacheBackend
    participant Generate as GenerationProvider

    UI->>API: POST /api/v1/query
    API->>Query: validated query
    Query->>Embed: create embedding
    Embed-->>Query: validated vector
    Query->>Cache: nearest lookup
    alt score meets threshold
        Cache-->>Query: cached response
    else cache miss
        Query->>Generate: generate original prompt
        Generate-->>Query: response
        Query->>Cache: store vector and response
    end
    Query-->>API: response and decision evidence
    API-->>UI: stable JSON contract
```

Identical in-flight requests are coalesced before repeated provider work.
Runtime counters observe the query path without storing prompt or response
content.

## Backend ownership

- `app/api` composes feature routers and cross-feature dependencies.
- `app/query/api` owns the query HTTP contract.
- `app/query/application` coordinates lookup, generation, storage, timing, and
  request coalescing.
- `app/query/domain` owns prompt normalization and effective cache policies.
- `app/cache/api` owns inspection, statistics, threshold, and invalidation
  routes.
- `app/cache/application` exposes semantic lookup and storage behavior.
- `app/cache/domain` owns keys, namespaces, metadata, vector validation, models,
  and backend ports.
- `app/cache/infrastructure` owns memory and pgvector adapters, database
  connectivity, and migrations.
- `app/benchmark` mirrors API, application, and domain responsibilities for the
  isolated evaluation laboratory.
- `app/providers` owns application-facing protocols, startup composition, and
  concrete external adapters.
- `app/observability` stays flat because it is a small cohesive feature with one
  endpoint and one process-local collector.
- `app/core` owns configuration, errors, logging, and shared limits.

Routes and application services depend on protocols rather than concrete
provider or storage adapters. Startup composition in `app/lifecycle.py` and
provider/cache factories selects implementations from validated settings.

## Provider and cache ports

Embedding and generation use separate ports:

```python
class EmbeddingProvider(Protocol):
    async def create_embedding(self, text: str) -> Sequence[float]: ...


class GenerationProvider(Protocol):
    async def generate(self, prompt: str) -> str: ...
```

This permits combinations such as OpenAI embeddings with Anthropic generation.
The selected embedding dimensions flow into validation and cache composition;
vectors are never padded or truncated.

The cache application layer uses one backend port implemented by memory and
pgvector adapters. Both enforce compatible lookup, TTL, LRU, namespaces,
inspection, and statistics behavior.

## Frontend ownership

The React application has four lazy product workspaces and a not-found
fallback:

| Route | Feature |
|---|---|
| `/` | Query monitor, decision evidence, similarity trace, and session log |
| `/cache` | Cache inspection, search, sorting, deletion, and clearing |
| `/evaluations` | Isolated controlled evaluation |
| `/observability` | Process-local runtime metrics |
| `*` | Not-found page |

`/benchmarks` remains a compatibility URL. It replace-redirects to
`/evaluations` while preserving query parameters and fragments, so the
Evaluations workspace has one page implementation and one active navigation
item.

Each feature owns its pages, components, hooks, API adapter, types, and route
registry. `src/app/router` composes those registries and provides the shared
lazy loader. Shared providers keep cache statistics, threshold state, and the
monitor trace session alive across client-side navigation.

Monitor traces intentionally live in browser memory. Reloading starts a new
trace session; backend cache entries follow the configured cache lifecycle.
Evaluation result state is route-local. Backend evaluation execution is
serialized and creates a fresh in-memory semantic cache per run, so completion,
failure, timeout, or cancellation cannot seed a later run or modify the
interactive cache and its runtime counters. Threshold alternatives are
frozen-candidate projections from one measured run, not repeated provider
executions.

Imported evaluation definitions follow the same route-local boundary. The
frontend holds the selected parsed JSON object only in React state and clears
it on removal, unmount, sign-out, or principal change. Validation and execution
carry the object in bounded JSON requests; the backend validates into an
immutable request-local dataset and retains no catalog entry. Canonical
`/api/v1/evaluations/*` routes are additive, while legacy built-in
`/api/v1/benchmarks/*` routes remain compatible.

## Project structure

```text
semantix/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── benchmark/{api,application,domain}/
│   │   ├── cache/{api,application,domain,infrastructure}/
│   │   ├── embedding/
│   │   ├── observability/
│   │   ├── providers/{adapters,shared}/
│   │   ├── query/{api,application,domain}/
│   │   ├── core/
│   │   ├── factory.py
│   │   ├── lifecycle.py
│   │   └── main.py
│   └── tests/                    # Mirrors feature ownership
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   └── shared/
│   └── tests/                    # Mirrors app and features
├── ops/
│   ├── postgres/
│   └── load-testing/
├── docs/
└── docker-compose.yml
```

## Deployment boundary

The supplied deployment is intentionally single-instance and local-first:

- rate limiting, coalescing, and runtime metrics are process-local;
- cache-management endpoints are unauthenticated;
- CORS is configured for known local frontend origins;
- no distributed lock, message bus, or external metrics platform is included.

Production adaptation requires authentication, secret management, TLS,
distributed coordination where multiple replicas share work, and an explicit
data-retention model.
