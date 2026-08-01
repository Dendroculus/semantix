# Evaluations and benchmarking

The Evaluations workspace measures cache quality, latency, and provider-call
savings against ordered prompts with explicit expected `HIT` or `MISS`
decisions. Every accepted run creates a fresh isolated in-memory cache and
never reads, writes, clears, or increments counters on the interactive cache.
When reset is enabled the run-local cache is cleared before every repetition;
when disabled, later repetitions in that same run can reuse earlier state.
Completed, failed, timed-out, and cancelled runs never seed a later run.

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

| Dataset | Version | Queries | Expected hits | Expected misses | Coverage |
|---|---|---:|---:|---:|---|
| `quick` | `1.0.0` | 8 | 4 | 4 | Seed, exact duplicate, paraphrase, typo, unrelated, negation, different intent |
| `extended` | `1.0.0` | 12 | 6 | 6 | Quick set plus more paraphrase, typo, negation, and intent boundaries |

Cases are ordered because earlier misses seed later expected hits. Every case
has an explicit expected classification. The API returns a SHA-256 digest
derived from ordered case IDs, categories, prompts, and expected decisions;
display names and descriptions do not affect it.

## Run from the frontend

1. Open <http://localhost:4173/evaluations>.
2. Select a dataset and threshold.
3. Optionally disclose the advanced sweep controls and choose a start, end,
   and step. The UI shows the resulting explicit list and includes the measured
   threshold exactly once.
4. Keep one repetition and reset enabled for a short independent run.
5. Review the bounded case count and maximum generation-call warning.
6. Confirm the run.
7. Select a confusion-matrix outcome or use the false-positive and
   false-negative quick filters.
8. Search the measured cases and open a case detail to inspect its expected and
   actual decisions, match evidence, threshold, provider-call state, latency,
   and dataset identity.
9. Inspect threshold projections and similarity distributions separately from
   measured case evidence.
10. Export JSON for the complete response or CSV revision 2 for independently
    interpretable per-case evidence.

Benchmark requests may call the selected generation provider. Review provider
cost, rate limits, and data handling before confirming.

Leaving the Evaluations workspace aborts the browser request and prevents a late
response from updating the unmounted page. It does not guarantee that provider
work already accepted by the backend has stopped.

The backend separately applies `EVALUATION_TIMEOUT_SECONDS` (300 seconds by
default, validated from greater than zero through 3,600). A timeout returns the
structured `evaluation_timeout` error and discards the run-local cache. It does
not claim that a remote provider has cancelled work it already accepted.

## Run through the API

PowerShell:

```powershell
$body = @{
    dataset_id = "quick"
    threshold = 0.92
    evaluation_thresholds = @(0.80, 0.90, 0.92, 0.95)
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
- **True-positive hit** means an expected reuse was served from the cache.
- **True-negative miss** means a required generation remained a miss.
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
Measured classification and latency fields, estimated savings fields, and
projected threshold fields are named and displayed separately.

Threshold charts are **frozen-candidate projections**. They reclassify the
nearest-match scores observed in the original run without replaying cache
writes at each alternate threshold. Because the candidate set does not evolve,
their quality, provider-savings, and latency estimates can differ from a real
ordered run at that threshold. The projection makes no additional provider
calls and uses the original run's average hit and miss latency.

## Error analysis and case details

The four-cell confusion matrix is an interactive filter over the measured
cases. Each cell has a text label, count, explanation, and selected state.
False-positive and false-negative quick filters provide direct paths to the
two correctness errors, while search remains bounded to the current
session-local result. Selecting “All cases” restores the complete deterministic
sequence and repetition order.

Compact cards expose the essential evidence on mobile and tablet widths. The
wide comparison table remains available inside an explicit scroll region on
larger viewports. Both presentations open the same inline case detail. Prompts,
case IDs, categories, and matched prompts are rendered as escaped plain text,
not Markdown or HTML.

A matched evaluation key is evidence from the destroyed run-local cache. It is
shown without a link and does not identify a record in the live Cache
workspace. Case details also distinguish the measured threshold from the
frozen-candidate projection charts and never offer automatic threshold
application.

Results and filters are discarded on reload. Export is the only durable action
in this phase.

## Export formats

JSON remains a structurally complete copy of the run response. CSV export
schema revision 2 repeats the run ID, timestamps, dataset identity, measured
and projected threshold context, safe configuration fingerprint and provider
metadata on every case row, followed by complete case evidence including
repetition, outcome, provider-call state, matched prompt, and matched key.

CSV string cells beginning with `=`, `+`, `-`, or `@` are prefixed with a
single quote so spreadsheet applications treat them as text. JSON values are
not modified. New downloads use the `semantix-evaluation-<run-id>` filename
stem; the former `semantix-benchmark-<run-id>` download name was a UI filename,
not a stable API contract.

## Reproducibility metadata

Run responses include the run ID, timezone-aware timestamps, dataset version
and digest, `reproducibility.measured_threshold`, the explicit
`evaluation_thresholds` list, repetitions, reset policy, cost assumptions,
timeout, provider categories, embedding dimensions, and SHA-256 fingerprints
for the embedding space, normalization configuration, and complete safe
configuration. The metadata measured threshold must equal the response's
top-level `threshold`. It is fingerprinted separately from the complete
projection list, so runs measured at different thresholds cannot share a
configuration fingerprint even when their projection lists match.

This is a positive allowlist. It does not contain credentials, authorization
material, private provider endpoints, raw embeddings, or model identifiers.
Matched cache keys are evaluation evidence only and do not identify entries in
the live Cache workspace.

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
