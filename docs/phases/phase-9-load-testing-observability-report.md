# Phase 9 report: load testing and observability

## Outcome

Phase 9 is complete. Semantix now exposes process-local runtime metrics, has a
lazy-loaded observability page with skeleton loading, and includes guarded k6
workloads for the six required traffic patterns.

The backend was also reorganized into the requested feature-first structure.
Query, cache, and benchmark code now separates API, application, domain, and
infrastructure responsibilities only where those responsibilities exist.
Provider utilities live under `providers/shared`, and backend tests mirror the
production structure.

## Backend observability

`GET /api/v1/metrics` returns an additive aggregate snapshot containing:

- query request and error counts;
- actual cache lookup hits and misses;
- provider generation attempts;
- the live in-flight coalesced-follower gauge;
- average and bounded nearest-rank P95 query latency;
- current cache size;
- eviction and expiration counts;
- collector uptime and observation time.

Metrics contain no prompts, responses, API keys, provider URLs, or model
identifiers. They reset on process restart and are not persisted in pgvector.
Validation and rate-limit failures occur before the query application service,
so they remain HTTP-level metrics rather than query-workflow counters.

Cache event recording is exposed through a small domain protocol. Both memory
and pgvector backends report actual eviction and expiration removals without
coupling domain or application code to a concrete metrics implementation.
Pgvector uses PostgreSQL command counts; no schema migration was required.

## Frontend

The new `/observability` route is lazy-loaded and linked from the application
navigation. Its dashboard:

- fetches the metrics endpoint on entry;
- refreshes every five seconds;
- supports manual refresh;
- presents latency, cache, provider, coalescing, and lifecycle metrics;
- uses a dedicated skeleton while the initial request is pending;
- shows an explicit error state instead of substituting demo data.

## Load-testing safety

The k6 suite is located in `load-tests/k6` and requires
`LOAD_ACKNOWLEDGE_PROVIDER_CALLS=true` for every run. Destructive or
configuration-changing workloads require additional explicit acknowledgements:

- `LOAD_ALLOW_THRESHOLD_CHANGES=true`;
- `LOAD_ALLOW_CACHE_EVICTION=true`.

Every run uses a unique namespace, clears that namespace during setup and
teardown, and restores the original similarity threshold after the threshold
scenario. Mock providers are the documented default so ordinary load
validation does not incur external traffic or cost.

## Load-test results

All scenarios were run through the official `grafana/k6` Docker image against
a disposable backend using mock embedding and generation providers with a
memory cache:

| Scenario | Completed work | HTTP failures | Checks | HTTP P95 | Key observation |
|---|---:|---:|---:|---:|---|
| Repeated identical | 965 queries | 0 | 100% | 5.06 ms | One provider call |
| Mixed hits/misses | 950 queries | 0 | 100% | 7.06 ms | 932 caller hits, four provider calls |
| Concurrent identical misses | 20 queries | 0 | 100% | 24.93 ms | One provider call |
| High cardinality | 201 queries | 0 | 100% | 3.27 ms | 197 provider calls |
| Threshold changes | 952 queries plus controller work | 0 | 100% | 6.51 ms | Threshold changed under traffic and was restored |
| Near capacity | 35 writes | 0 | 100% | 33.86 ms | Size 10, exactly 25 evictions |

k6 hit and miss values are caller decisions. Backend hit and miss counters are
actual lookups, so coalesced followers can return a miss without increasing the
backend miss or provider-call count. Mock embeddings are deterministic but not
a semantic-quality benchmark.

## Verification

- Backend tests: `161 passed, 6 skipped`
- Backend Ruff lint: passed
- Backend Ruff format check: passed
- Backend mypy: passed for 138 source files
- Frontend Vitest: 46 tests passed across 11 files
- Frontend ESLint, including Tailwind rules: passed
- Frontend import-boundary check: passed for 88 files
- Frontend production build: passed
- k6 JavaScript syntax checks: passed
- Docker Compose configuration validation: passed
- Git whitespace validation: passed

The six skipped backend tests require
`PGVECTOR_TEST_DATABASE_URL`; no external database or provider was contacted by
the Phase 9 validation suite.

## Contract and configuration notes

- The only public API addition is `GET /api/v1/metrics`.
- Existing response shapes and environment variables are unchanged.
- No database migration is included.
- Absolute performance values depend on provider speed, model warm-up,
  hardware, Docker limits, database latency, and network conditions.

## Commit message

```text
feat(observability): add runtime metrics and load testing

- expose process-local query, cache, provider, coalescing, and latency metrics
- record cache eviction and expiration events across memory and pgvector backends
- add a lazy observability dashboard with live refresh and skeleton loading
- add guarded k6 scenarios for cache, concurrency, threshold, and capacity workloads
- organize backend features into API, application, domain, and infrastructure layers
- mirror feature ownership in backend tests and isolate provider shared utilities
- document safe local load testing and metric interpretation
```
