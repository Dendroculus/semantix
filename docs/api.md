# API

FastAPI serves interactive documentation at <http://localhost:8000/docs>.
Application errors use a stable object containing `error` and `detail`.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/query` | Submit a query |
| `GET` | `/api/v1/cache/stats` | Read global or namespace cache statistics |
| `GET` | `/api/v1/cache/threshold` | Read the active similarity threshold |
| `PUT` | `/api/v1/cache/threshold` | Update the active threshold |
| `GET` | `/api/v1/cache/entries` | Search, sort, and paginate safe cache metadata |
| `GET` | `/api/v1/cache/entries/{cache_key}` | Read one safe cache metadata record |
| `DELETE` | `/api/v1/cache/entries/{cache_key}` | Delete one entry |
| `DELETE` | `/api/v1/cache` | Clear all entries or one namespace |
| `GET` | `/api/v1/benchmarks/datasets` | List controlled benchmark datasets |
| `POST` | `/api/v1/benchmarks/run` | Run an isolated benchmark |
| `GET` | `/api/v1/metrics` | Read process-local aggregate metrics |
| `GET` | `/health` | Read application and provider-type health |

## Query request

```json
{
  "prompt": "Explain semantic caching",
  "namespace": "default",
  "cache_enabled": true,
  "cache_read_enabled": true,
  "cache_write_enabled": true,
  "private": false
}
```

Only `prompt` is required. `cache_enabled=false` overrides both granular flags.
`private=true` also disables reads and writes. Disabling reads while keeping
writes enabled refreshes the entry from the provider; disabling writes still
permits an eligible cached response.

See [Cache policies](cache-policies.md) for precedence and namespace rules.

## Query response evidence

```json
{
  "response": "A previously generated answer",
  "cache_hit": true,
  "similarity_score": 0.967,
  "similarity_threshold": 0.92,
  "matched_prompt": "What is semantic caching?",
  "matched_cache_key": "29769c1b33db361734e377b6e20368cd58ab3d7d048545073402ad830a0513ab",
  "cache_entry_created_at": "2026-07-17T10:00:00Z",
  "cache_entry_age_seconds": 18.4,
  "generation_skipped": true,
  "provider_called": false,
  "latency_ms": 7.2
}
```

On a miss, matched-entry fields are `null`. The nearest similarity may still
be present when an entry existed but did not meet the threshold. The leader of
a generated miss reports `provider_called=true`; a coalesced follower remains
a miss but reports `generation_skipped=true` and `provider_called=false`
because it awaited the leader.

Embeddings and full inspector responses are never exposed through the query or
cache-management contracts.

## Cache inspector query

`GET /api/v1/cache/entries` accepts:

- `namespace`: optional exact namespace;
- `search`: optional case-insensitive prompt fragment;
- `sort`: `newest`, `oldest`, `most_hit`, or `nearest_expiry`;
- `offset`: zero-based result offset;
- `limit`: page size from 1 through 100.

The response contains `items`, `total`, `offset`, `limit`, and `has_more`.
Items include the original prompt and a truncated response preview, but not the
embedding or full cached response.

`GET /api/v1/cache/stats?namespace=...` and
`DELETE /api/v1/cache?namespace=...` target one namespace. Omitting the
parameter returns global statistics or clears the active embedding space.

## Runtime metrics

`GET /api/v1/metrics` returns aggregate process-local values:

```json
{
  "observed_at": "2026-07-19T08:00:00Z",
  "uptime_seconds": 3600.0,
  "request_count": 120,
  "error_count": 1,
  "cache_hits": 72,
  "cache_misses": 48,
  "provider_calls": 46,
  "in_flight_coalesced_requests": 0,
  "average_latency_ms": 325.4,
  "p95_latency_ms": 1280.2,
  "latency_sample_size": 120,
  "cache_size": 48,
  "evictions": 3,
  "expirations": 2
}
```

Counters reset on backend restart. The bounded P95 sample retains at most 2,048
completed query latencies. Validation and rate-limit failures occur before the
query application service and are not included in its request/error counters.

For load-testing semantics and the distinction between caller decisions and
actual cache lookups, see [Load testing](load-testing.md).
