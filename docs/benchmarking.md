# Benchmarking

The Benchmark workspace measures cache quality, latency, and provider-call
savings against ordered prompts with explicit expected `HIT` or `MISS`
decisions. It uses an isolated in-memory cache and never reads or writes the
interactive cache.

## Measured reference run

The README result came from an actual Phase 4 benchmark API run:

| Run property | Value |
|---|---|
| Run ID | `0488b35e487b4d0f94e151a97271847b` |
| Started | July 19, 2026 at 08:15:30 UTC |
| Dataset | Quick semantic safety set |
| Queries | 8 |
| Repetitions | 1 |
| Cache reset | Yes |
| Threshold | `0.92` |
| Providers | Hugging Face embeddings and generation |
| Prompt typo correction | Enabled |

Measured metrics:

| Metric | Result |
|---|---:|
| Cache hits / misses | 4 / 4 |
| Provider calls / avoided | 4 / 4 |
| Hit rate | 50% |
| Average latency | 2051.5 ms |
| Median latency | 1314.3 ms |
| P95 latency | 5550.0 ms |
| Average hit latency | 330.3 ms |
| Average miss latency | 3772.7 ms |
| Estimated latency saved | 13,769.6 ms |
| False positives / negatives | 0 / 0 |
| Precision / recall / F1 | 1.0 / 1.0 / 1.0 |

This is one local observation, not a service-level claim. The application
reported provider types but intentionally does not expose model identifiers in
health or benchmark responses. Provider load, selected models, network,
normalization, machine resources, and dataset ordering affect results.

At projected threshold `0.70`, the same observed scores produced one false
positive. At `0.98`, they produced one false negative. That is why the README
reports the evaluated threshold and quality errors alongside latency.

## Built-in datasets

| Dataset | Queries | Expected hits | Expected misses | Coverage |
|---|---:|---:|---:|---|
| `quick` | 8 | 4 | 4 | Seed, exact duplicate, paraphrase, typo, unrelated, negation, different intent |
| `extended` | 12 | 6 | 6 | Quick set plus more paraphrase, typo, negation, and intent boundaries |

Cases are ordered because earlier misses seed later expected hits. Every case
has an explicit expected classification.

## Run from the frontend

1. Open <http://localhost:4173/benchmarks>.
2. Select a dataset and threshold.
3. Keep one repetition and reset enabled for a short independent run.
4. Review the expected external generation-call warning.
5. Confirm the run.
6. Inspect summary metrics, per-query evidence, threshold projections, and
   similarity distributions.
7. Export JSON for the complete result or CSV for per-query evidence.

Benchmark requests may call the selected generation provider. Review provider
cost, rate limits, and data handling before confirming.

## Run through the API

PowerShell:

```powershell
$body = @{
    dataset_id = "quick"
    threshold = 0.92
    repetitions = 1
    reset_cache_before_run = $true
    estimated_cost_per_request_usd = 0
    estimated_cost_per_1k_tokens_usd = 0
    allow_external_provider_calls = $true
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8000/api/v1/benchmarks/run" `
    -ContentType "application/json" `
    -Body $body
```

`allow_external_provider_calls=true` is mandatory. It prevents an accidental
benchmark from silently creating provider traffic.

## Metric interpretation

- **Provider calls avoided** equals queries served from the benchmark cache.
- **Precision** answers: of returned hits, how many were expected hits?
- **Recall** answers: of expected hits, how many were returned as hits?
- **False positive** means the cache returned a response where the dataset
  expected a miss.
- **False negative** means the cache generated a new response where reuse was
  expected.
- **Estimated latency saved** uses the run's observed average hit/miss latency.
- **Estimated token savings** uses a simple character-based approximation.
- **Estimated costs** use the optional values supplied by the operator.

Cost and token estimates are evaluation aids, not provider billing records.

Threshold charts reclassify already observed nearest-match scores and do not
make more provider calls. Their projected latency uses the run's average hit
and miss latency.

## Comparing runs responsibly

Record at least:

- timestamp and run ID;
- dataset and ordering;
- threshold and repetition count;
- cache-reset policy;
- embedding and generation providers/models;
- prompt normalization settings;
- backend and database mode;
- local hardware and Docker resource limits;
- relevant provider or network conditions.

Do not compare runs as though only the threshold changed when another item in
that list also changed.
