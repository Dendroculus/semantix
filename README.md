<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6">
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11 or newer">
  <img src="https://img.shields.io/badge/Node.js-20-5FA04E?logo=nodedotjs&logoColor=white" alt="Node.js 20">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL with pgvector">
  <img src="https://img.shields.io/badge/Hugging%20Face-Default-FFD21E?logo=huggingface&logoColor=black" alt="Hugging Face default provider">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose">
  <img src="https://img.shields.io/badge/License-MIT-22C55E?logo=opensourceinitiative&logoColor=white" alt="MIT License">
</p>

<div align="center">

# 🧠 Semantix

### Observe, measure, and tune semantic caching instead of treating it like a black box

An observable semantic-cache laboratory for evaluating latency, provider-call
savings, cache quality, eviction policies, and similarity thresholds across
replaceable model and storage providers.

<sub>Monitor · Cache Inspector · Benchmark Lab · Runtime Observability</sub>

</div>

---

## 🚀 Why Semantix?

Semantic caching can reduce repeated AI inference, but an unexplained cache hit
is risky. A similar-looking prompt may represent a different intent, while a
harmless paraphrase may be unnecessarily regenerated.

Semantix makes every decision inspectable:

- 🔎 **Explainable decisions** — inspect the matched prompt, similarity score,
  threshold, cache age, and provider-call evidence
- ⚡ **Measured savings** — compare cache-hit and cache-miss latency
- 🎛️ **Threshold evaluation** — measure false positives and false negatives
  instead of guessing a safe threshold
- 🧱 **Replaceable infrastructure** — independently select embedding,
  generation, and cache providers
- 🛡️ **Explicit policies** — namespaces, private requests, read/write controls,
  TTL, LRU eviction, and embedding-space isolation
- 🔁 **Request coalescing** — identical in-flight misses share one provider call
- 📈 **Runtime observability** — inspect aggregate latency, cache activity,
  provider calls, coalescing, expirations, and evictions
- 🧪 **Safe experimentation** — use deterministic mock providers without API
  keys, external calls, or usage charges

Semantix is designed as a local-first laboratory where developers can explore
the trade-off between **reuse, latency, provider cost, and answer quality**
before adding semantic caching to a larger application.

## 🔬 See it in action

A typical Semantix flow looks like this:

| Request | Decision | What Semantix shows |
|---|---|---|
| `What is semantic caching?` | Cache miss | Provider called, response generated, entry stored |
| `Explain how semantic caches work.` | Possible semantic hit | Nearest prompt, similarity score, threshold, cache age, generation skipped |
| `What is database indexing?` | Cache miss | Nearest score may be shown, but generation runs when the threshold is not met |

A cache hit is never returned only because two prompts contain similar words.
The embedding provider creates a semantic representation, the selected cache
backend searches within the active namespace and embedding space, and the
response is reused only when the nearest score meets the configured threshold.

```text
Prompt
  │
  ▼
Normalize matching text
  │
  ▼
Create embedding
  │
  ▼
Search compatible cache entries
  │
  ├── score >= threshold ──► return cached response
  │
  └── score < threshold ───► call generation provider ─► store response
```

## 🎯 Workspaces

| Workspace | What it helps you evaluate |
|---|---|
| **Monitor** | Submit prompts, inspect decision evidence, compare latency, and explore similarity traces |
| **Cache Inspector** | Search live entries, inspect TTL and recency, delete records, and clear namespaces |
| **Benchmark Lab** | Measure precision, recall, false hits, false misses, provider savings, and threshold trade-offs |
| **Observability** | Track request volume, provider calls, cache activity, latency, coalescing, expirations, and evictions |

For complete behavior contracts, see
[API documentation](docs/api.md) and [Cache policies](docs/cache-policies.md).

## 📊 Measured benchmark

A real local Phase 4 run used the eight-query **Quick semantic safety set**,
Hugging Face providers, typo normalization, an isolated empty cache, and a
`0.92` threshold:

| Provider calls avoided | Average cache hit | Average cache miss | Precision / Recall / F1 |
|---:|---:|---:|---:|
| **4 of 8 (50%)** | **330.3 ms** | **3772.7 ms** | **1.0 / 1.0 / 1.0** |

The run produced **zero false positives and zero false negatives**.

This is one dated local measurement from July 19, 2026—not a universal
performance guarantee. Provider load, selected models, hardware, network
conditions, dataset ordering, prompt normalization, and threshold configuration
all affect results.

For the run ID, complete metrics, dataset composition, and reproduction steps,
see [Benchmarking](docs/benchmarking.md).

## 💡 Use cases

Semantix can be used to:

- evaluate whether semantic caching is appropriate for an AI application;
- compare similarity thresholds against controlled expected hit/miss datasets;
- measure latency and generation-provider calls avoided;
- inspect false-positive and false-negative cache decisions;
- compare process-local memory storage with persistent pgvector storage;
- test hosted model providers against local Ollama models;
- verify request coalescing under concurrent traffic;
- demonstrate semantic-cache architecture, policies, and observability.

## 🧠 Architecture highlights

- **Independent provider selection** — embedding and generation providers are
  composed separately behind typed ports
- **Feature-owned behavior** — query, cache, benchmark, and provider concerns
  own their API, application, domain, and infrastructure responsibilities
- **Compatible vector spaces** — provider, model, and dimensions isolate
  embeddings that must never be compared
- **Request coalescing** — concurrent identical misses share one provider call
- **Replaceable cache backend** — start with memory or persist entries through
  PostgreSQL and pgvector
- **Honest telemetry** — metrics contain aggregate behavior without exposing
  prompts, responses, provider URLs, model names, or secrets

```mermaid
flowchart LR
    UI["React workspaces"] --> API["FastAPI feature routes"]
    API --> Query["Query application service"]
    Query --> Embedding["Embedding provider"]
    Query --> Cache["Semantic cache port"]
    Query --> Generation["Generation provider"]
    Cache --> Memory["Memory"]
    Cache --> Pgvector["PostgreSQL + pgvector"]
    Query --> Metrics["Runtime metrics"]
```

For the complete runtime sequence, ownership boundaries, and project structure,
see [Architecture](docs/architecture.md).

## 🏗️ Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS | Feature workspaces, evidence, charts, and controls |
| Backend | FastAPI, Pydantic, HTTPX | Validation, orchestration, errors, and rate limiting |
| Providers | Hugging Face, OpenAI, Anthropic, Gemini, Ollama, mock | Replaceable embedding and generation |
| Cache | NumPy memory store or PostgreSQL + pgvector | Similarity lookup, TTL, LRU, namespaces, and persistence |
| Quality | Pytest, Vitest, Ruff, mypy, ESLint, TypeScript | Regression coverage and strict validation |
| Runtime | Docker Compose | Reproducible local services and optional profiles |
| Load testing | k6 | Guarded concurrency and capacity scenarios |

## ⚡ Quick start

### Prerequisites

Install:

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker
  Engine with Compose

Clone the repository and create the backend environment file:

```bash
git clone https://github.com/Dendroculus/semantix.git
cd semantix
cp backend/.env.example backend/.env
```

Windows PowerShell:

```powershell
git clone https://github.com/Dendroculus/semantix.git
Set-Location semantix
Copy-Item backend\.env.example backend\.env
```

### Option A — Zero-key local demo

Mock providers require no credentials, external API access, or model downloads.

Set these values in `backend/.env`:

```env
EMBEDDING_PROVIDER=mock
GENERATION_PROVIDER=mock
MOCK_EMBEDDING_DIMENSIONS=384

CACHE_BACKEND=memory
```

Start Semantix:

```bash
docker compose up --build -d
```

### Option B — Hugging Face providers

Set a valid Hugging Face inference token and keep the configured model values:

```env
EMBEDDING_PROVIDER=huggingface
GENERATION_PROVIDER=huggingface
HF_API_KEY=your_token_here

CACHE_BACKEND=memory
```

Then start Semantix:

```bash
docker compose up --build -d
```

### Option C — Project-scoped Ollama

Ollama can run as an optional Docker Compose service, so no global Windows
installation is required.

Start the Ollama service:

```bash
docker compose --profile ollama up -d ollama
```

Pull the embedding and generation models:

```bash
docker compose --profile ollama exec ollama ollama pull embeddinggemma
docker compose --profile ollama exec ollama ollama pull gemma3:4b
docker compose --profile ollama exec ollama ollama list
```

Configure `backend/.env`:

```env
EMBEDDING_PROVIDER=ollama
GENERATION_PROVIDER=ollama

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=embeddinggemma
OLLAMA_GENERATION_MODEL=gemma3:4b
OLLAMA_EMBEDDING_DIMENSIONS=768

CACHE_BACKEND=memory
```

Start Semantix with the Ollama profile:

```bash
docker compose --profile ollama up --build -d
```

Downloaded models remain in the `ollama_data` named volume. Semantix never
downloads models automatically during application startup.

### Add persistent pgvector storage

Configure:

```env
CACHE_BACKEND=pgvector
DATABASE_URL=postgresql://semantix:semantix@postgres:5432/semantix
```

Start the pgvector profile:

```bash
docker compose --profile pgvector up --build -d
```

Use Ollama and pgvector together:

```bash
docker compose --profile ollama --profile pgvector up --build -d
```

## 🌐 Local services

| Service | Address |
|---|---|
| Frontend | <http://localhost:4173> |
| Backend | <http://localhost:8000> |
| FastAPI documentation | <http://localhost:8000/docs> |
| Health endpoint | <http://localhost:8000/health> |
| Runtime metrics | <http://localhost:8000/api/v1/metrics> |
| Ollama API | <http://localhost:11434> when the Ollama profile is active |
| PostgreSQL | `localhost:5433` when the pgvector profile is active |

Check running services:

```bash
docker compose ps
```

Include active profiles when inspecting optional services:

```bash
docker compose --profile ollama --profile pgvector ps
```

View logs:

```bash
docker compose logs -f backend
docker compose logs -f ollama
```

Stop the stack without deleting named volumes:

```bash
docker compose down
```

## 🔌 Provider capabilities

Embedding and generation providers can be selected independently.

| Provider | Embeddings | Generation | Credentials required |
|---|:---:|:---:|:---:|
| Hugging Face | Yes | Yes | Yes |
| OpenAI | Yes | Yes | Yes |
| Anthropic | No | Yes | Yes |
| Gemini | Yes | Yes | Yes |
| Ollama | Yes | Yes | No for a local server |
| Mock | Yes | Yes | No |

Examples:

```env
# Hugging Face embeddings with Ollama generation
EMBEDDING_PROVIDER=huggingface
GENERATION_PROVIDER=ollama
```

```env
# OpenAI embeddings with Anthropic generation
EMBEDDING_PROVIDER=openai
GENERATION_PROVIDER=anthropic
```

```env
# Fully local and deterministic
EMBEDDING_PROVIDER=mock
GENERATION_PROVIDER=mock
```

Only settings required by the selected capabilities are validated. See
[Providers](docs/providers.md) for configuration, model compatibility, Docker
networking, security considerations, and smoke tests.

## 📨 Query API example

Submit a query:

```bash
curl --request POST \
  --url http://localhost:8000/api/v1/query \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Explain semantic caching",
    "namespace": "default",
    "cache_enabled": true,
    "cache_read_enabled": true,
    "cache_write_enabled": true,
    "private": false
  }'
```

A response includes the generated or cached answer together with evidence such
as:

```json
{
  "response": "A semantic cache stores reusable AI responses...",
  "cache_hit": false,
  "similarity_score": null,
  "similarity_threshold": 0.92,
  "matched_prompt": null,
  "generation_skipped": false,
  "provider_called": true,
  "latency_ms": 1240.6
}
```

On an eligible hit, Semantix reports the matched prompt, score, cache age, and
that generation was skipped.

See [API documentation](docs/api.md) for all endpoints and stable response
contracts.

## 📁 Project structure

```text
semantix/
├── backend/
│   ├── app/
│   ├── scripts/
│   └── tests/
├── frontend/
│   ├── src/
│   └── tests/
├── docs/
├── load-tests/k6/
├── docker-compose.yml
└── README.md
```

The backend and frontend use feature-first ownership. Tests mirror production
feature boundaries. Concrete provider and storage behavior remains behind
application-facing protocols.

## ⚠️ Important limitations

- Semantix is a local-first laboratory, not a production-ready multi-tenant
  gateway.
- Cache-management endpoints are intentionally unauthenticated.
- Rate limiting, runtime metrics, and in-flight coalescing are process-local.
- Semantic similarity is probabilistic; every model and dataset needs
  threshold evaluation.
- Hosted providers may receive prompts and add latency, usage cost, and data
  handling considerations.
- Ollama keeps inference local but its API must not be exposed to an untrusted
  network.
- Benchmark savings and token estimates are evaluation aids, not billing
  records or service-level guarantees.
- Changing the embedding provider, model, or dimensions creates an incompatible
  vector space.
- Mock providers are intended for tests, demonstrations, and UI development;
  they do not produce production-quality answers or semantic embeddings.

Review [Provider trade-offs](docs/providers.md),
[Cache policies](docs/cache-policies.md), and
[Architecture limitations](docs/architecture.md) before adapting Semantix for a
shared or public deployment.

## 📚 Documentation

| Guide | Details |
|---|---|
| [Getting started](docs/getting-started.md) | Docker, environment files, local setup, and troubleshooting |
| [Architecture](docs/architecture.md) | Runtime flow, feature ownership, boundaries, and structure |
| [API](docs/api.md) | Endpoints, query policies, response evidence, and metrics |
| [Benchmarking](docs/benchmarking.md) | Datasets, safeguards, metrics, exports, and measured results |
| [Cache policies](docs/cache-policies.md) | Thresholds, TTL/LRU, namespaces, privacy, and coalescing |
| [Providers](docs/providers.md) | Capability matrix, hosted providers, Ollama, mocks, and smoke tests |
| [pgvector](docs/pgvector.md) | Persistent storage, migrations, verification, and integration tests |
| [Prompt normalization](docs/prompt-typo-normalization.md) | Optional typo correction and limitations |
| [Load testing](docs/load-testing.md) | Guarded k6 scenarios and metric interpretation |
| [Development](docs/development.md) | Toolchains, tests, quality checks, and contributions |

## 🤝 Contributors

Made with ❤️ by the Semantix team:

<table>
  <tr>
    <td align="center" width="180">
      <a href="https://github.com/Dendroculus">
        <img src="https://github.com/Dendroculus.png?size=96" width="96" alt="Hans avatar"><br>
        <b>Hans</b>
      </a><br>
      <sub><b>Contributor</b></sub>
    </td>
    <td align="center" width="180">
      <a href="https://github.com/Kasanee-Teto">
        <img src="https://github.com/Kasanee-Teto.png?size=96" width="96" alt="Louis avatar"><br>
        <b>Louis</b>
      </a><br>
      <sub><b>Contributor</b></sub>
    </td>
  </tr>
</table>

## 📜 License

Licensed under the [MIT License](LICENSE).
