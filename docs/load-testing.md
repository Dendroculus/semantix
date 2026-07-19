# Load testing and runtime observability

Semantix includes isolated k6 workloads and a process-local JSON metrics
endpoint. Run load tests only against a local or otherwise disposable instance.

## Safe test configuration

Mock providers are the recommended default for load testing because they are
deterministic, require no network, and cannot incur provider charges:

```env
EMBEDDING_PROVIDER=mock
GENERATION_PROVIDER=mock
MOCK_EMBEDDING_DIMENSIONS=384

CACHE_BACKEND=memory
MAX_CACHE_SIZE=500
CACHE_TTL_SECONDS=3600
RATE_LIMIT=100000/minute
PROMPT_TYPO_CORRECTION_ENABLED=false
```

Recreate the backend after changing `backend/.env`:

```powershell
docker compose up --build --force-recreate -d backend frontend
```

Use pgvector only when the storage backend itself is under test. Do not point
the load test at production data. The near-capacity scenario can evict entries
across namespaces because cache capacity applies to the active embedding
space, not to one namespace.

Every run requires:

```text
LOAD_ACKNOWLEDGE_PROVIDER_CALLS=true
```

This acknowledgement is required even with mock providers so changing the
provider configuration cannot silently create billable traffic.

## Scenarios

| `SCENARIO` | Workload | What it proves |
|---|---|---|
| `repeated-identical` | Five VUs repeat one prompt | A warm cache reduces provider calls |
| `mixed-hits-misses` | Repeated and distinct prompts | Hit/miss counters and mixed latency remain coherent |
| `concurrent-identical-misses` | Twenty VUs submit one cold prompt once | In-flight request coalescing limits duplicate generation |
| `high-cardinality` | Unique prompts at a fixed arrival rate | Miss-heavy traffic remains stable |
| `threshold-changes` | Traffic runs while one VU alternates thresholds | Threshold updates remain safe during query traffic |
| `near-capacity` | Writes `MAX_CACHE_SIZE + 25` unique prompts | Cache size stays bounded and evictions are recorded |

The threshold scenario requires
`LOAD_ALLOW_THRESHOLD_CHANGES=true`. It records the current threshold and
restores it during teardown.

The capacity scenario requires `LOAD_ALLOW_CACHE_EVICTION=true`. Use it only
against an isolated cache because evicted entries cannot be restored.

Mock embeddings are not semantically meaningful. They test concurrency,
instrumentation, limits, and endpoint stability. Use a real embedding provider
only when evaluating semantic threshold quality, after reviewing its cost,
rate limits, and data-handling requirements.

## Run with an installed k6

From the repository root in PowerShell:

```powershell
$env:BASE_URL = "http://localhost:8000"
$env:LOAD_ACKNOWLEDGE_PROVIDER_CALLS = "true"
$env:SCENARIO = "repeated-identical"
k6 run .\load-tests\k6\semantix.js
```

Change `SCENARIO` to run the other workloads. For the protected scenarios:

```powershell
$env:SCENARIO = "threshold-changes"
$env:LOAD_ALLOW_THRESHOLD_CHANGES = "true"
k6 run .\load-tests\k6\semantix.js
```

```powershell
$env:SCENARIO = "near-capacity"
$env:CACHE_CAPACITY = "500"
$env:LOAD_ALLOW_CACHE_EVICTION = "true"
k6 run .\load-tests\k6\semantix.js
```

`CACHE_CAPACITY` must match `MAX_CACHE_SIZE`. `P95_LIMIT_MS` controls the k6
P95 threshold and defaults to `5000`.

## Run k6 through Docker

Start Semantix first so the `semantix_default` network exists. Then run:

```powershell
docker run --rm `
  --network semantix_default `
  --volume "${PWD}\load-tests\k6:/scripts:ro" `
  --env BASE_URL=http://backend:8000 `
  --env LOAD_ACKNOWLEDGE_PROVIDER_CALLS=true `
  --env SCENARIO=repeated-identical `
  grafana/k6 run /scripts/semantix.js
```

Docker downloads the k6 image on the first run. The bind mount is read-only.

## Runtime metrics

The backend exposes:

```text
GET /api/v1/metrics
```

Inspect it from PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/metrics |
  ConvertTo-Json
```

Response fields:

| Field | Meaning |
|---|---|
| `request_count` | Interactive query requests started in this process |
| `error_count` | Query workflows that completed with an error |
| `cache_hits` | Actual cache lookups served from cache |
| `cache_misses` | Actual cache lookups that missed |
| `provider_calls` | Generation attempts, including failed attempts |
| `in_flight_coalesced_requests` | Followers currently sharing leader work |
| `average_latency_ms` | Mean completed-query latency since startup |
| `p95_latency_ms` | Nearest-rank P95 from the bounded recent sample |
| `latency_sample_size` | Samples currently retained for P95 |
| `cache_size` | Current entries in the active embedding space |
| `evictions` | Entries removed by the configured size limit |
| `expirations` | Entries removed after TTL expiry |
| `uptime_seconds` | Age of the metrics collector |
| `observed_at` | UTC snapshot timestamp |

Average and P95 latency are `null` before a query completes. The P95 window is
bounded to 2,048 completed requests. Counters reset when the backend process
restarts and are not stored in pgvector.

Validation errors and rate-limit rejections happen before `QueryService` and
are therefore not included in `request_count` or `error_count`. HTTP-level
errors remain visible in k6's `http_req_failed` metric.

## Reading results

k6 checks require:

- more than 99% successful checks;
- less than 1% failed HTTP requests;
- HTTP P95 below `P95_LIMIT_MS`.

The script also reports:

- `semantix_cache_hits`;
- `semantix_cache_misses`;
- `semantix_provider_calls`;
- `semantix_query_errors`;
- `semantix_query_latency_ms`.

The k6 hit and miss counters describe the decision returned to each caller.
The backend counters describe actual cache lookups. Coalesced followers can
therefore receive a miss response without performing another lookup or
provider call. During concurrent traffic, use the backend `cache_misses` and
`provider_calls` counters to measure work avoided by coalescing.

At teardown, k6 prints the backend metrics snapshot and clears its generated
namespace. Compare both views:

- repeated traffic should have substantially more hits than provider calls;
- concurrent identical misses should normally produce one provider call;
- high-cardinality traffic should be miss-heavy;
- cache size must not exceed `MAX_CACHE_SIZE`;
- the capacity run should increase evictions;
- the coalesced gauge returns to zero after traffic stops.

Provider speed, model warm-up, hardware, Docker resource limits, database
latency, and network conditions all affect absolute latency. Record the
environment with every performance result rather than treating one local run
as a universal benchmark.
