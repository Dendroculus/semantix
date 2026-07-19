# Getting started

This guide covers complete local setup. The repository README intentionally
keeps only the shortest Docker path.

## Prerequisites

For the Docker workflow, install:

- [Git](https://git-scm.com/);
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows
  or macOS, or Docker Engine with Compose on Linux;
- credentials for any hosted AI providers you select.

Docker supplies Python, Node.js, and application dependencies. Local toolchains
are needed only for the non-Docker development workflow.

Hugging Face is the recommended starting provider because it avoids local model
downloads and inference hardware requirements. See
[Providers](providers.md) before selecting OpenAI, Anthropic, Gemini, Ollama, or
the deterministic mock adapters.

## Configure the backend

Clone the repository:

```bash
git clone https://github.com/Dendroculus/semantix.git
cd semantix
```

Create the backend environment file.

Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
```

macOS or Linux:

```bash
cp backend/.env.example backend/.env
```

For the default configuration, replace the placeholder `HF_API_KEY` in
`backend/.env` with a dedicated Hugging Face token that has inference
permission. Never commit the token.

The checked-in [`backend/.env.example`](../backend/.env.example) is the
canonical environment reference. Its settings are grouped into:

- embedding and generation providers;
- provider request limits;
- optional prompt normalization;
- similarity, cache size, and TTL;
- optional pgvector connectivity;
- CORS, rate limiting, and logging.

Only the selected provider capabilities require credentials and models.
Provider-specific settings are documented in [Providers](providers.md);
database settings are documented in [pgvector](pgvector.md); matching behavior
is documented in [Cache policies](cache-policies.md).

## Start with the memory cache

Keep:

```env
CACHE_BACKEND=memory
```

Build and start the frontend and backend:

```bash
docker compose up --build -d
```

The memory cache requires no database and resets when the backend process
restarts.

## Start with pgvector

Configure the container-internal database address:

```env
CACHE_BACKEND=pgvector
DATABASE_URL=postgresql://semantix:semantix@postgres:5432/semantix
```

Activate the optional profile:

```bash
docker compose --profile pgvector up --build -d
```

Compose starts PostgreSQL, waits for its health check, and then starts the
backend. The backend applies pending migrations before becoming ready. Compose
profiles are selected per command, so include `--profile pgvector` whenever
bringing this stack up or inspecting it.

For database ports, pgAdmin, migration behavior, persistence, and integration
tests, see [Persistent pgvector cache](pgvector.md).

## Verify the application

For the memory stack:

```bash
docker compose ps
```

For pgvector:

```bash
docker compose --profile pgvector ps
```

Expected endpoints:

| Service | Local address |
|---|---|
| Frontend | <http://localhost:4173> |
| Backend | <http://localhost:8000> |
| FastAPI documentation | <http://localhost:8000/docs> |
| Health | <http://localhost:8000/health> |
| PostgreSQL host port | `localhost:5433` with the pgvector profile |

Check backend health from PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Submit a query in the Monitor workspace, then try a paraphrase. A hit occurs
only when the nearest score meets the active threshold.

## Logs, rebuilds, and shutdown

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

When dependencies or Dockerfiles change:

```bash
docker compose up --build --force-recreate -d
```

If Docker reused a stale backend dependency layer:

```bash
docker compose build --no-cache backend
docker compose up -d
```

For pgvector, add `--profile pgvector` to the final `up` command. `--no-cache`
controls image-layer reuse; it does not activate Compose profiles.

Running `docker compose down` preserves named volumes. Adding `--volumes`
permanently removes their data, including PostgreSQL cache entries.

## Frontend environment

Docker passes the API URL during the frontend build. A frontend environment
file is needed only for local Vite development:

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

Every `VITE_*` value is embedded in the browser bundle and is publicly visible.
Never place credentials in frontend environment variables.

## Troubleshooting

| Symptom | Check |
|---|---|
| Docker command is unavailable | Install and start Docker Desktop or Docker Engine |
| Frontend cannot be reached | Confirm `docker compose ps` shows `4173->4173/tcp` |
| Frontend uses an old API URL or UI bundle | Rebuild and force-recreate the frontend, then hard-refresh |
| Backend rejects browser requests | Add the active frontend origin to `ALLOWED_ORIGINS` |
| Hosted provider authentication fails | Check the selected provider key and its permissions |
| Hugging Face reports `model_not_supported` | Select a model available to the configured account |
| Similar prompts miss | Review the embedding model and evaluate a lower threshold carefully |
| Unrelated prompts hit | Evaluate a higher threshold |
| Cache disappears after restart | Memory storage is process-local; use pgvector for persistence |
| pgvector startup fails | Check the database URL, health, permissions, and backend startup logs |

Provider-specific failures are covered in [Providers](providers.md). Load and
latency diagnosis is covered in [Load testing](load-testing.md).
