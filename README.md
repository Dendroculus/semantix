<div align="center">

<p>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6">
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white" alt="Python 3.11">
  <img src="https://img.shields.io/badge/Hugging%20Face-Inference-FFD21E?logo=huggingface&logoColor=black" alt="Hugging Face">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose">
</p>

<p>
  <img src="https://img.shields.io/badge/Cache-In--Memory-7C3AED" alt="In-memory cache">
  <img src="https://img.shields.io/badge/License-MIT-22C55E?logo=opensourceinitiative&logoColor=white" alt="MIT License">
  <img src="https://img.shields.io/badge/Deployment-Local%20Docker-2563EB" alt="Local Docker deployment">
</p>

# 🧠 Semantix

### A Docker-first semantic cache that reuses AI answers by meaning instead of exact text

</div>

## 🚀 Why Semantix

Semantix is a full-stack reference project for reducing repeated AI inference calls. It embeds each incoming query, compares it with cached vectors, and returns an existing response when the semantic similarity is high enough. Cache misses are sent to a Hugging Face chat model and stored for later reuse.

The project is intentionally designed as a **single-instance, local-first Docker application** that collaborators can run without manually matching Python and Node.js versions.

- 🧠 **Semantic matching** — reuses answers for meaningfully similar queries
- ⚡ **Lower inference usage** — avoids repeated generation calls on cache hits
- 🧹 **TTL and LRU eviction** — expires old entries and limits memory growth
- 🔌 **Replaceable service boundaries** — embedding, generation, and cache concerns stay separated
- 🐳 **Docker-first setup** — starts the frontend and backend with one command
- 🧪 **Typed and tested** — TypeScript, Vitest, Pytest, Ruff, and mypy are included

## ⚡ Quick Start with Docker

### Prerequisites

Install:

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows or macOS, or Docker Engine with Compose on Linux
- A Hugging Face account with an inference-enabled access token

> Docker installs the runtime dependencies inside isolated images. A local Python virtual environment and local `node_modules` are not required for the Docker-only workflow.

### 1. Clone the repository

```bash
git clone <repository-url>
cd semantix
```

### 2. Create the backend environment file

Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
```

macOS or Linux:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and configure the Hugging Face token and a chat model currently available to your account:

```env
HF_API_KEY=hf_your_inference_token

HF_INFERENCE_BASE_URL=https://router.huggingface.co/hf-inference/models
HF_CHAT_BASE_URL=https://router.huggingface.co/v1

HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_GENERATION_MODEL=Qwen/Qwen3-4B-Instruct-2507:nscale

HF_TIMEOUT_SECONDS=30
GENERATION_MAX_NEW_TOKENS=512

SIMILARITY_THRESHOLD=0.92
MAX_CACHE_SIZE=500
CACHE_TTL_SECONDS=3600

ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:4173"]
RATE_LIMIT=20/minute
LOG_LEVEL=INFO
```

The generation model above was used during local verification. Provider availability can change, so replace it with another supported model when Hugging Face returns `model_not_supported`.

Create a Hugging Face token from **Settings → Access Tokens**. Use a dedicated fine-grained token with inference permission. Never commit the real token.

### 3. Build and start both services

```bash
docker compose up --build -d
```

### 4. Verify the containers

```bash
docker compose ps
```

Expected local services:

| Service | URL |
|---|---|
| Frontend | http://localhost:4173 |
| Backend | http://localhost:8000 |
| FastAPI documentation | http://localhost:8000/docs |
| Health endpoint | http://localhost:8000/health |

### 5. View logs or stop the project

```bash
# Follow all logs
docker compose logs -f

# Follow one service
docker compose logs -f backend
docker compose logs -f frontend

# Stop and remove the containers
docker compose down
```

## 🧪 Try the Semantic Cache

Submit a query through the frontend:

```text
What is semantic caching?
```

Then submit a meaningfully similar query:

```text
Explain how a semantic cache works.
```

The first request should normally create a cache entry. The second may reuse it when the similarity score meets the configured threshold.

Cache behavior depends on:

```env
SIMILARITY_THRESHOLD=0.92
MAX_CACHE_SIZE=500
CACHE_TTL_SECONDS=3600
```

A higher similarity threshold makes cache matching stricter. A lower threshold increases the chance of reuse but also increases the risk of returning a response for a query that is not similar enough.

### Dashboard metric definitions

The dashboard starts with an empty local trace and never inserts simulated queries.
Its current readings use these formulas:

- **Frontend projected hit rate** = scored visible traces at or above the selected
  threshold divided by all scored visible traces. Traces without a similarity
  score are excluded from this projection and reported separately.
- **Actual backend hit rate** = backend hits divided by backend hits plus misses,
  counted since the backend cache was last cleared or restarted.
- **Mean latency** = total latency of visible successful traces divided by the
  number of visible successful traces.
- **Provider calls (visible)** = visible successful traces whose backend
  `cache_hit` value is `false`.
- **Cache entries** = the backend's current in-memory cache size.

The similarity radar is secondary visual evidence. It plots only scored traces,
with similarity `1.0` at the center and `0.0` at the edge. A point's angle is
stable for that trace but has no semantic meaning; changing the threshold only
changes the threshold ring and the projected hit/miss color. The plotted count
always states how many visible traces have scores.

### Query decision evidence

Every successful query response reports the cache decision that was actually
made. The dashboard shows the similarity score, the threshold used for that
request, whether generation and the provider call ran, and the total latency.
A cache hit also identifies the cached prompt and reports the entry's age. On a
miss, all matched-entry fields are `null`; the nearest similarity may still be
present when an entry existed but did not qualify.

### Cache inspector

The cache inspector shows the live contents of the current in-memory cache
without exposing embeddings or full cached responses. Each row includes the
cache key, original prompt, a response preview, creation and expiration times,
remaining TTL, per-entry hit count, last-access time, and LRU recency rank.
Expired entries are purged under the cache backend lock before inspector data is
returned.

Prompt search and sorting are handled by the backend so they remain correct
across paginated results. Available sorts are newest, oldest, most-hit, and
nearest-expiry. Deleting one entry leaves historical aggregate hit/miss counters
unchanged; clearing the whole cache removes every entry and resets those
counters. The dashboard asks for confirmation before either destructive action
and refreshes both inspector data and aggregate statistics afterward.

## 🔄 Runtime Flow

1. The frontend sends a query to the FastAPI backend.
2. `EmbeddingService` requests and validates the query embedding.
3. The embedding is normalized for cosine-similarity comparison.
4. `CacheBackend` removes expired entries and searches for the nearest cached vector.
5. If the best score meets `SIMILARITY_THRESHOLD`, the cached response is returned.
6. Otherwise, `HuggingFaceService` requests a new chat completion.
7. The query vector and generated response are stored in the in-memory cache.
8. TTL expiry and LRU eviction keep cache growth bounded.

```text
Query
  │
  ▼
Embedding service
  │
  ▼
Semantic cache lookup
  ├── Match above threshold ──► Cached response
  │
  └── Cache miss
          │
          ▼
    Hugging Face chat
          │
          ▼
    Store response in cache
          │
          ▼
      New response
```

## 🧠 Architecture Highlights

- **Embedding boundary** — `EmbeddingService` validates provider output and produces normalized NumPy vectors.
- **Cache boundary** — `CacheBackend` owns similarity lookup, TTL expiry, LRU eviction, inspector metadata, statistics, and invalidation.
- **Generation boundary** — `HuggingFaceService` owns external HTTP calls, authentication, timeouts, retries, and provider error handling.
- **Application orchestration** — `CacheService` coordinates embedding, lookup, generation, and insertion without coupling API routes to implementation details.
- **Typed API contract** — Pydantic schemas and TypeScript API types keep frontend/backend payloads explicit.
- **Single-instance storage** — cache entries live in process memory and are reset when the backend container restarts.

A persistent vector database can later implement the cache interface without rewriting the query routes or orchestration flow.

## 🏗️ Project Structure

```text
semantix/
├── docker-compose.yml                 # Starts the backend and frontend
├── LICENSE
├── README.md
├── backend/
│   ├── .dockerignore
│   ├── .env.example                   # Backend configuration template
│   ├── Dockerfile
│   ├── pyproject.toml                 # Runtime and development dependencies
│   ├── app/
│   │   ├── main.py                    # FastAPI application entrypoint
│   │   ├── api/
│   │   │   ├── deps.py                # Shared route dependencies
│   │   │   └── routes/
│   │   │       ├── cache.py           # Cache statistics and invalidation
│   │   │       ├── health.py          # Health endpoint
│   │   │       └── query.py           # Semantic query workflow
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic settings
│   │   │   ├── exceptions.py          # Stable application errors
│   │   │   └── logging.py             # Logging configuration
│   │   ├── middleware/
│   │   │   └── rate_limit.py          # Per-client API rate limiting
│   │   ├── models/
│   │   │   └── schemas.py             # Request and response schemas
│   │   └── services/
│   │       ├── cache_backend.py        # In-memory vector cache
│   │       ├── cache_service.py        # Cache orchestration
│   │       ├── embedding_service.py    # Embedding validation
│   │       └── huggingface_service.py  # Hugging Face client
│   └── tests/                          # Backend unit and route tests
└── frontend/
    ├── .dockerignore
    ├── .env.example                    # Local frontend configuration
    ├── Dockerfile
    ├── eslint.config.js
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── src/
    │   ├── components/                 # Query, response, and cache-stat UI
    │   ├── config/env.ts               # Browser environment validation
    │   ├── hooks/useQuery.ts            # Query state workflow
    │   ├── services/apiClient.ts        # Typed backend client
    │   └── types/api.ts                 # API types
    └── tests/
        ├── setup.ts
        └── useQuery.test.tsx
```

## 🏗️ Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 6 | Query UI, response state, cache statistics, API calls |
| Backend | FastAPI, Pydantic, HTTPX | Validation, orchestration, errors, rate limiting |
| Embeddings | Hugging Face Inference | Converts queries into semantic vectors |
| Generation | Hugging Face chat completion router | Generates responses on cache misses |
| Cache | NumPy in-memory vector store | Cosine similarity, TTL expiry, LRU eviction |
| Testing | Vitest, Testing Library, Pytest | Frontend hooks, backend services, API routes |
| Quality | ESLint, TypeScript, Ruff, mypy | Linting, formatting, and static analysis |
| Runtime | Docker Compose | Reproducible local frontend/backend environment |

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/query` | Submit a query and receive a cached or generated response |
| `GET` | `/api/v1/cache/stats` | Read current cache statistics |
| `GET` | `/api/v1/cache/threshold` | Read the active similarity threshold |
| `PUT` | `/api/v1/cache/threshold` | Update the active similarity threshold |
| `GET` | `/api/v1/cache/entries` | Search, sort, and paginate safe cache-entry metadata |
| `GET` | `/api/v1/cache/entries/{cache_key}` | Read one cache entry's safe metadata |
| `DELETE` | `/api/v1/cache/entries/{cache_key}` | Delete one cache entry |
| `DELETE` | `/api/v1/cache` | Clear all in-memory cache entries |
| `GET` | `/health` | Check whether the backend is healthy |
| `GET` | `/docs` | Open interactive FastAPI documentation |

Successful `POST /api/v1/query` responses use this additive explainability
contract:

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

For a cache miss, `matched_prompt`, `matched_cache_key`,
`cache_entry_created_at`, and `cache_entry_age_seconds` are all `null`;
`generation_skipped` is `false` and `provider_called` is `true`. Embeddings are
internal cache data and are never included in this response.

`GET /api/v1/cache/entries` accepts:

- `search`: optional case-insensitive prompt fragment
- `sort`: `newest`, `oldest`, `most_hit`, or `nearest_expiry`
- `offset`: zero-based result offset
- `limit`: page size from 1 through 100

Its response contains `items`, `total`, `offset`, `limit`, and `has_more`.
Inspector items intentionally contain only a truncated `response_preview`;
neither full responses nor embeddings are returned. An expired or unknown key
returns the stable `cache_entry_not_found` error.

All application errors use a stable JSON structure containing `error` and `detail`.

## ⚙️ Environment Variables

### Backend

| Variable | Required | Description |
|---|---:|---|
| `HF_API_KEY` | Yes | Hugging Face inference token |
| `HF_INFERENCE_BASE_URL` | Yes | Feature-extraction endpoint prefix |
| `HF_CHAT_BASE_URL` | Yes | OpenAI-compatible chat endpoint prefix |
| `HF_EMBEDDING_MODEL` | Yes | Model used to generate query vectors |
| `HF_GENERATION_MODEL` | Yes | Chat model and optional provider suffix |
| `HF_TIMEOUT_SECONDS` | No | External request timeout |
| `GENERATION_MAX_NEW_TOKENS` | No | Maximum generated response length |
| `SIMILARITY_THRESHOLD` | No | Minimum cosine similarity required for a hit |
| `MAX_CACHE_SIZE` | No | Maximum number of in-memory entries |
| `CACHE_TTL_SECONDS` | No | Entry lifetime in seconds |
| `ALLOWED_ORIGINS` | No | Browser origins allowed by CORS |
| `RATE_LIMIT` | No | Per-client request limit |
| `LOG_LEVEL` | No | Application log level |

### Frontend

For local development, create the frontend environment file:

Windows PowerShell:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

macOS or Linux:

```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_BASE_URL=http://localhost:8000
```

> Every `VITE_*` value is embedded into the browser bundle and is publicly visible. Never place API tokens or provider secrets in frontend environment variables.

Docker Compose passes `VITE_API_BASE_URL` as a frontend build argument, so `frontend/.env` is only required for the non-Docker development workflow.

## 💻 Local Development Without Docker

Use this workflow for IDE integration, hot reload, local linting, and tests.

### Backend

The Docker image uses Python 3.11. Using Python 3.11 locally gives the closest environment match.

Windows PowerShell:

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -e ".[dev]"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS or Linux:

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
pip install -e ".[dev]"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

Open another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The local Vite development server is available at:

```text
http://localhost:5173
```

## 🧪 Testing and Quality

### Backend

```bash
cd backend

ruff check .
ruff format --check .
mypy app tests
pytest
```

Apply Ruff fixes and formatting:

```bash
ruff check . --fix
ruff format .
```

### Frontend

```bash
cd frontend

npm run lint
npm run typecheck
npm test
npm run build
```

Normal tests should mock provider calls so test runs do not consume Hugging Face inference credits.

## 🧯 Troubleshooting

| Problem | What to check |
|---|---|
| `docker` is not recognized | Install and start Docker Desktop or Docker Engine |
| Docker daemon is unavailable | Wait for Docker Engine to report running, then retry |
| Frontend cannot be reached | `docker compose ps` should show `4173->4173/tcp` |
| `VITE_API_BASE_URL must be configured` | Rebuild the frontend image because Vite variables are embedded at build time |
| Frontend uses an old API URL | Run `docker compose build frontend --no-cache`, then recreate the container |
| Backend rejects browser requests | Ensure `ALLOWED_ORIGINS` contains the active frontend URL |
| Hugging Face reports `model_not_supported` | Choose a model/provider currently enabled for the account |
| Hugging Face returns an authentication error | Verify the token has inference permission and was copied without quotes or spaces |
| Similar queries miss the cache | Review the embedding model and lower the similarity threshold carefully |
| Unrelated queries hit the cache | Increase the similarity threshold |
| Cache disappears after restart | The current cache is intentionally in memory and is not persistent |

Useful commands:

```bash
docker compose ps
docker compose logs --tail 100
docker compose logs -f backend
docker compose logs -f frontend
docker system df
```

After dependency, Dockerfile, or frontend build-variable changes:

```bash
docker compose down
docker compose up --build -d
```

For a completely clean rebuild:

```bash
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d
```

## 🛡️ Reliability and Security

- Hugging Face secrets are loaded only by the backend.
- Frontend `VITE_*` values contain public configuration only.
- `.env` files, virtual environments, dependencies, caches, and build output are excluded from Docker build contexts.
- External provider calls use explicit timeouts and retry handling.
- Embeddings are validated before entering the cache.
- Cache size and entry lifetime are bounded.
- Prompts and generated responses are not written to INFO logs.
- Provider stack traces are not returned to clients.
- Public API routes are rate-limited per client IP.
- CORS does not allow wildcard origins.
- `DELETE /api/v1/cache` has no authentication because this project is intended for local use.

Add authentication and persistent shared storage before exposing the cache-management endpoint or running multiple backend instances publicly.

## 🤝 Contributing

1. Create a focused branch:

   ```bash
   git switch -c feat/short-description
   ```

2. Keep provider logic behind the existing service boundaries.
3. Add or update tests for changed cache, provider, route, or frontend behavior.
4. Run the backend and frontend quality checks.
5. Verify the Docker build:

   ```bash
   docker compose build
   ```

6. Open a pull request that explains the behavior change, testing performed, and any environment-variable updates.

## 📜 License

Licensed under the MIT License. See [LICENSE](./LICENSE).

## 🙏 Acknowledgements

- [Hugging Face](https://huggingface.co/) for hosted embedding and chat inference
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://react.dev/) and [Vite](https://vite.dev/) for the frontend toolchain
- [Docker](https://www.docker.com/) for reproducible local environments

## 👤 Author

<table>
  <tr>
    <td align="center" width="180">
      <a href="https://github.com/Dendroculus">
        <img src="https://github.com/Dendroculus.png?size=96" width="96" alt="Hans avatar" style="border-radius: 50%;"><br/>
        <b>Hans</b><br/>
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://github.com/Kasanee-Teto">
        <img src="https://github.com/Kasanee-Teto.png?size=96" width="96" alt="Louis avatar" style="border-radius: 50%;"><br/>
        <b>Louis</b><br/>
      </a>
    </td>
  </tr>
</table>
