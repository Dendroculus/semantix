# Development

Use local toolchains for IDE integration, hot reload, and quality checks. The
Docker workflow is documented in [Getting started](getting-started.md).

## Backend

The project targets Python 3.11 or newer; Python 3.11 matches the backend image.

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

The backend reads `backend/.env`. With `CACHE_BACKEND=pgvector`, a reachable
database is required before application startup completes. Memory and mock
providers are the lowest-dependency development configuration.

## Frontend

Node.js 20 matches the frontend image:

```bash
cd frontend
npm ci
npm run dev
```

The Vite server runs at <http://localhost:5173>. Configure
`VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env`.

## Quality checks

Backend:

```bash
cd backend
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy app tests scripts
```

Frontend:

```bash
cd frontend
npm run lint
npm run imports:check
npm run test
npm run build
```

`npm run build` includes strict TypeScript validation through `tsc --noEmit`.
Normal provider tests use `httpx.MockTransport` and must not call external
services.

Pgvector integration tests are opt-in and use
`PGVECTOR_TEST_DATABASE_URL`; see [pgvector](pgvector.md). Load testing has
separate safety acknowledgements; see [Load testing](load-testing.md).

## Architecture rules

- Keep feature behavior with its owning feature.
- Add `api`, `application`, `domain`, or `infrastructure` layers only when the
  feature has that distinct responsibility.
- Keep small cohesive features flat.
- Depend on provider and cache ports from application code.
- Keep concrete external API and storage behavior inside adapters.
- Mirror production feature ownership in tests.
- Prefer straightforward composition over registries or dependency-injection
  frameworks.
- Preserve strict typing; do not use `Any` to bypass contracts.

See [Architecture](architecture.md) for current ownership boundaries.

## Contributing

1. Create a focused branch:

   ```bash
   git switch -c feat/short-description
   ```

2. Keep the change within one clear concern.
3. Add or update relevant tests and documentation.
4. Run the backend and frontend checks affected by the change.
5. Validate Docker configuration:

   ```bash
   docker compose config --quiet
   docker compose build
   ```

6. Open a pull request describing behavior, validation, and configuration
   changes.

Do not commit `.env` files, provider credentials, local databases, virtual
environments, dependencies, test caches, or build output.
