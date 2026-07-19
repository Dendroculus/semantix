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

### Docker workflow

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
```

Start the application:

```powershell
docker compose up --build -d
```

Optional profiles:

```powershell
# Persistent pgvector cache
docker compose --profile pgvector up --build -d

# Local Ollama provider
docker compose --profile ollama up --build -d

# Ollama and pgvector together
docker compose --profile ollama --profile pgvector up --build -d
```

### Local backend workflow

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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
git pull --ff-only
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

Keep each branch limited to one clear concern.

## Architecture expectations

Semantix follows feature-first ownership.

- Keep query behavior inside the query feature.
- Keep cache behavior inside the cache feature.
- Keep provider-specific HTTP behavior inside provider adapters.
- Keep storage-specific behavior inside cache infrastructure adapters.
- Depend on protocols from application code rather than concrete adapters.
- Add architectural layers only when the feature has a distinct
  responsibility that needs them.
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
- Docker profiles;
- migration or persistence behavior;
- load-testing safeguards;
- known limitations.

Do not report benchmark or performance results without recording the provider,
model, dataset, threshold, cache state, hardware, and relevant runtime
conditions.

## Tests and quality checks

Run the checks affected by your change.

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

Docker:

```bash
docker compose config --quiet
docker compose build
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

## Commit messages

Use Conventional Commits:

```text
<type>(<optional-scope>): <imperative description>
```

Examples:

```text
feat(providers): add Ollama generation adapter
fix(cache): isolate pgvector embedding spaces
perf(query): coalesce identical in-flight misses
docs(readme): add zero-key local setup
test(benchmark): cover threshold false positives
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

1. Rebase or update your branch from the latest `main`.
2. Remove unrelated formatting or generated-file changes.
3. Add or update tests.
4. Update documentation.
5. Run the relevant quality checks.
6. Review the diff for secrets and private data.
7. Complete the pull request template honestly.

A good pull request should explain:

- the problem or behavior being changed;
- the implementation approach;
- public API, configuration, migration, or compatibility effects;
- verification commands and results;
- any limitation or follow-up work.

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
