# Contributing to Semantix

Thank you for taking the time to improve Semantix.

Semantix is a local-first semantic-cache laboratory built to make cache
decisions, provider behavior, latency, and quality trade-offs observable.
Contributions should preserve that goal: behavior should remain inspectable,
configuration should remain explicit, and performance claims should remain
reproducible.

Before contributing, please read:

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Architecture](docs/architecture.md)
- [Development Guide](docs/development.md)
- [Cache Policies](docs/cache-policies.md)

## Ways to contribute

Useful contributions include:

- bug fixes;
- frontend accessibility and usability improvements;
- provider or cache adapters;
- tests and load-test scenarios;
- benchmark datasets and reproducible measurements;
- documentation and examples;
- performance improvements supported by evidence;
- issue reproduction and technical review.

Security vulnerabilities must not be reported through a public issue. Follow
[SECURITY.md](SECURITY.md) instead.

## Before opening an issue

Please:

1. Search existing issues and pull requests.
2. Confirm the behavior still occurs on the latest `main` branch.
3. Check the relevant documentation and known limitations.
4. Collect the smallest reproducible example.
5. Remove API keys, access tokens, passwords, private prompts, responses, and
   personal data from logs or screenshots.

Use the repository issue forms for bugs, feature requests, and documentation
improvements.

## Development setup

### Docker development workflow

Create the backend environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

For a credential-free development setup:

```env
EMBEDDING_PROVIDER=mock
GENERATION_PROVIDER=mock
MOCK_EMBEDDING_DIMENSIONS=384
CACHE_BACKEND=memory
AUTH_MODE=disabled
```

Start the hot-reload development stack:

```powershell
docker compose -f docker-compose.dev.yml --profile pgvector up --build -d
```

Useful commands:

```powershell
docker compose -f docker-compose.dev.yml --profile pgvector ps
docker compose -f docker-compose.dev.yml --profile pgvector logs -f backend
docker compose -f docker-compose.dev.yml --profile pgvector down
```

Use the hardened stack only when validating production-oriented configuration.
See [Hardened deployment](docs/deployment.md) before starting it.

### Local backend workflow

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
. .\scripts\enable_cache.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The cache script redirects normal Python bytecode into `backend/.cache/python`
for the current terminal session. Ruff, mypy, and pytest use the cache
directories configured in `backend/pyproject.toml`.

Pytest assertion rewriting does not rely on Python's normal bytecode-cache path.
The test configuration disables writing rewritten bytecode so test runs do not
recreate scattered `__pycache__` directories.

To remove backend caches and editable-install metadata:

```powershell
.\scripts\clean_artifacts.ps1
```

### Local frontend workflow

```powershell
cd frontend
npm ci
npm run dev
```

See [Getting Started](docs/getting-started.md) and
[Development](docs/development.md) for complete setup details.

## Branches

Create a focused branch from the latest `main` branch:

```bash
git switch main
git pull --ff-only origin main
git switch -c <type>/<short-description>
```

Recommended branch prefixes:

| Prefix | Use |
|---|---|
| `feat/` | New user-facing behavior |
| `fix/` | Bug fix |
| `docs/` | Documentation-only change |
| `refactor/` | Internal restructuring without behavior changes |
| `perf/` | Measured performance improvement |
| `test/` | Test-only work |
| `chore/` | Maintenance or tooling |
| `ci/` | Continuous-integration changes |
| `build/` | Build-system or dependency changes |

Keep each branch limited to one clear concern.

## Architecture expectations

Semantix follows feature-first ownership.

- Keep query behavior inside the query feature.
- Keep cache behavior inside the cache feature.
- Keep provider-specific HTTP behavior inside provider adapters.
- Keep storage-specific behavior inside cache infrastructure adapters.
- Keep repository-level operational assets under `ops/`.
- Keep PostgreSQL bootstrap assets under `ops/postgres/`.
- Keep k6 workloads under `ops/load-tests/`.
- Depend on protocols from application code rather than concrete adapters.
- Add architectural layers only when a feature has a distinct responsibility.
- Keep small cohesive features flat.
- Preserve strict typing; do not use `Any` merely to bypass contracts.
- Do not scatter provider or cache selection conditionals through routes or
  application services.
- Do not compare embeddings from different providers, models, or dimensions.
- Do not expose prompts, full responses, provider URLs, model names, or secrets
  through aggregate telemetry.

Review [Architecture](docs/architecture.md) before making structural changes.

## Coding expectations

### Backend

- Target Python 3.11 or newer.
- Add type hints to new public functions and methods.
- Use existing Pydantic settings and validation patterns.
- Convert external-provider failures into the project's stable error types.
- Reuse shared vector validation instead of truncating or padding embeddings.
- Keep provider tests offline through `httpx.MockTransport` or deterministic
  mock providers.
- Keep migrations with the cache infrastructure that owns them.
- Add concise docstrings where behavior is not self-evident.

### Frontend

- Preserve strict TypeScript validation.
- Keep feature pages, components, hooks, API adapters, types, and routes with
  their owning feature.
- Reuse shared UI primitives where appropriate.
- Preserve accessibility for forms, controls, dialogs, tables, and charts.
- Do not expose backend secrets through `VITE_*` variables.
- Update API types whenever a public response contract changes.

### Documentation

Documentation must match implemented behavior.

Update the relevant guide when changing:

- environment variables;
- provider support;
- cache policies;
- API contracts;
- benchmark behavior;
- Docker or deployment behavior;
- migration or persistence behavior;
- load-testing safeguards;
- CI requirements;
- known limitations.

Do not report benchmark or performance results without recording the provider,
model, dataset, threshold, cache state, hardware, and relevant runtime
conditions.

## Tests and quality checks

Run the checks affected by your change before pushing.

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
. .\scripts\enable_cache.ps1
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy app tests scripts
```

### Frontend

```powershell
cd frontend
npm ci
npm run lint
npm run imports:check
npm run test
npm run build
```

### Docker Compose

From the repository root:

```powershell
docker compose config --quiet
docker compose -f docker-compose.dev.yml --profile pgvector config --quiet
docker compose --env-file .env.production.example -f docker-compose.prod.yml config --quiet
```

Pgvector integration tests are opt-in and require a disposable database:

```powershell
$env:PGVECTOR_TEST_DATABASE_URL = `
  "postgresql://semantix:semantix@localhost:5433/semantix"

cd backend
.\.venv\Scripts\python.exe -m pytest -m pgvector
```

Do not run tests against production data or billable providers unless that is
explicitly required and acknowledged.

## Continuous integration

The `Quality` GitHub Actions workflow runs for pull requests targeting `main`,
pushes to `main`, and manual dispatches.

It validates:

- backend tests, Ruff linting, Ruff formatting, and mypy;
- frontend linting, import normalization, tests, and production build;
- compatibility, development, and hardened Docker Compose configuration.

The final required status check is:

```text
Quality gate
```

`Quality gate` succeeds only when the backend, frontend, and Compose jobs all
succeed. A pending, skipped, cancelled, or failed required job must block a
normal merge.

The repository ruleset requires pull requests and the `Quality gate` check.
CODEOWNERS identifies review ownership. Ruleset bypass access is reserved for
repairing broken repository automation or another exceptional administrative
case; it must not be used to merge known product failures.

## Commit messages

Use Conventional Commits:

```text
<type>(<optional-scope>): <imperative description>
```

Examples:

```text
feat(providers): add Ollama generation adapter
fix(cache): isolate pgvector embedding spaces
refactor(repo): consolidate operational assets
ci(quality): validate development and hardened Compose files
docs(contributing): document the quality gate
```

Common types:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `chore`
- `ci`
- `build`

Write concise commit subjects in the imperative mood. Avoid mixing unrelated
changes in one commit.

## Pull requests

Before opening a pull request:

1. Update your branch from the latest `main`.
2. Remove unrelated formatting and generated-file changes.
3. Add or update relevant tests.
4. Update documentation.
5. Run the relevant local quality checks.
6. Validate Docker Compose when configuration is affected.
7. Review the diff for credentials, private prompts, responses, and personal
   data.
8. Complete the pull request template honestly.
9. Wait for `Quality gate` to pass before merging.

A good pull request should explain:

- the problem or behavior being changed;
- the implementation approach;
- public API, configuration, migration, or compatibility effects;
- verification commands and results;
- any limitation or follow-up work.

Use squash merge so the final `main` history contains one focused commit for
each pull request.

Screenshots are encouraged for visible frontend changes. Reproducible benchmark
output is required for performance claims.

Draft pull requests are welcome for early architectural feedback.

## AI-assisted contributions

AI-assisted work is allowed, but the contributor remains responsible for it.

Before submitting AI-assisted changes:

- review and understand every modified line;
- verify licenses and attribution;
- remove fabricated claims or unverified commands;
- run the relevant tests;
- confirm generated documentation matches the implementation;
- ensure no private prompts, credentials, or proprietary content are included.

Unreviewed generated code may be rejected.

## Licensing

By submitting a contribution, you agree that it may be distributed under the
project's [MIT License](LICENSE). Only submit work that you have the right to
license and redistribute.

Thank you for helping make semantic caching easier to inspect, evaluate, and
understand.
