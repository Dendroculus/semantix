# Phase 8 — Local provider adapters

## Objective

Complete optional local-provider support without redesigning the existing
ports-and-adapters architecture. Hugging Face remains the default while Ollama
and deterministic mock providers become independently selectable for
embeddings and generation.

## Original scope

- Native Ollama generation and embedding adapters.
- Capability-specific Ollama configuration validation.
- A narrow local HTTP exception without weakening hosted-provider HTTPS rules.
- Network-free mock embedding and generation providers.
- Provider selection through the existing factory and provider bundle.
- Additive provider names in `/health`.
- Generic smoke-script support.
- Provider documentation and focused automated tests.

Load testing and observability remain Phase 9.

## Existing work preserved

Before this phase, Semantix already had:

- `EmbeddingProvider` and `GenerationProvider` ports;
- independent embedding and generation selectors;
- Hugging Face, OpenAI, Anthropic, and Gemini adapters;
- a shared `httpx.AsyncClient`, retry transport, and vector parser;
- provider-specific embedding dimensions and embedding-space isolation;
- a provider factory, bundle, lifespan composition, and smoke script.

Phase 8 extended those components instead of replacing them.

## Work completed

### Ollama

`OllamaProvider` implements both existing provider ports:

- generation uses `POST /api/generate`, disables streaming, and maps the shared
  maximum generation length to Ollama's `options.num_predict`;
- embeddings use `POST /api/embed` with one input and the configured output
  dimensions;
- the shared transport handles network failures, retryable statuses, malformed
  JSON, and application provider exceptions;
- the shared vector parser rejects missing, empty, non-numeric, non-finite, and
  dimensionally invalid vectors;
- errors do not include prompts or upstream response bodies.

### Mock providers

- `MockEmbeddingProvider` creates deterministic unit vectors from stable
  SHA-256 token features.
- `MockGenerationProvider` returns deterministic responses prefixed with
  `[mock provider]`.
- Neither mock provider accepts a client or performs network I/O.
- Both work through the normal factory, query service, embedding service, and
  semantic cache.

### Configuration

Embedding providers now accept:

```text
huggingface | openai | gemini | ollama | mock
```

Generation providers now accept:

```text
huggingface | openai | anthropic | gemini | ollama | mock
```

Ollama validates only the fields required by its selected capability. Mock
providers require no credentials.

Provider configuration was kept feature-owned:

- `app/core/config.py` retains environment-backed fields and application-wide
  settings composition;
- `app/providers/configuration.py` owns provider selection rules and embedding
  identity;
- `app/providers/urls.py` owns hosted and local-provider URL policies.

This reduced `app/core/config.py` from 396 lines during implementation to 212
lines without adding a registry or dependency-injection framework.

### URL policy

Hosted Hugging Face, OpenAI, Anthropic, and Gemini URLs remain HTTPS-only.
Ollama accepts absolute HTTP or HTTPS origins such as:

```text
http://localhost:11434
http://127.0.0.1:11434
http://host.docker.internal:11434
http://ollama:11434
```

Ollama URLs reject credentials, relative or malformed values, unsupported
schemes, paths, queries, fragments, empty hosts, and invalid ports.

### Health contract

`GET /health` remains a fast configuration report and does not call a provider:

```json
{
  "status": "ok",
  "embedding_provider": "huggingface",
  "generation_provider": "ollama"
}
```

Only provider type names are returned. Keys, URLs, and model names are not
included.

### Docker decision

Ollama is available through an opt-in Compose profile. Normal Hugging Face,
hosted-provider, and mock workflows do not activate or download it. The
backend reaches the optional service through:

```env
OLLAMA_BASE_URL=http://ollama:11434
```

Models are pulled explicitly and persist in `semantix_ollama_data`; application
startup never downloads models automatically. Setup, storage requirements,
exact model tags, and safe cleanup that preserves pgvector data are documented.

## Supported provider matrix

| Provider | Embeddings | Generation | Credentials required |
|---|:---:|:---:|:---:|
| Hugging Face | Yes | Yes | Yes |
| OpenAI | Yes | Yes | Yes |
| Anthropic | No | Yes | Yes |
| Gemini | Yes | Yes | Yes |
| Ollama | Yes | Yes | No for a local server |
| Mock | Yes | Yes | No |

Embedding and generation remain independently selectable. Verified factory
combinations include:

- Hugging Face embeddings with Ollama generation;
- Ollama embeddings with Anthropic generation;
- Ollama for both capabilities with one reused adapter instance;
- mock embeddings with mock generation.

## Environment changes

Added:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_EMBEDDING_MODEL=
OLLAMA_GENERATION_MODEL=
OLLAMA_EMBEDDING_DIMENSIONS=
MOCK_EMBEDDING_DIMENSIONS=384
```

No existing environment variable was renamed or removed.

## Files added

- `backend/app/providers/adapters/ollama.py`
- `backend/app/providers/adapters/mock.py`
- `backend/app/providers/configuration.py`
- `backend/app/providers/urls.py`
- `backend/tests/api/__init__.py`
- `backend/tests/api/test_health.py`
- `backend/tests/providers/adapters/test_ollama.py`
- `backend/tests/providers/adapters/test_mock.py`
- `backend/tests/providers/test_config.py`
- `backend/tests/providers/test_local_factory.py`
- `docs/providers.md`
- `docs/phases/phase-8-provider-adapters-report.md`

## Files modified

- `README.md`
- `backend/.env.example`
- `backend/app/api/health.py`
- `backend/app/api/schemas.py`
- `backend/app/core/config.py`
- `backend/app/factory.py`
- `backend/app/providers/factory.py`
- `backend/tests/conftest.py`
- `docker-compose.yml`

The smoke script required no code change because it already selected adapters
through the generic provider factory. Factory support made Ollama and mock
providers available to it automatically.

## Tests added

- Ollama request endpoints, models, payloads, generation parsing, embedding
  parsing, vector dimensions, invalid response shapes, empty output, retryable
  server/network failures, and prompt/body redaction.
- Ollama generation-only, embedding-only, and combined configuration.
- Local URL acceptance and unsafe URL rejection.
- Hosted-provider HTTP rejection.
- Mock determinism, normalization, dimensions, generation identity, and
  cache/query integration without network access.
- Ollama, mixed hosted/local, and mock factory selection.
- Reuse of one Ollama instance for both capabilities.
- Health provider names and absence of URLs/models.

## Commands and results

From `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Result: `132 passed, 6 skipped, 1 warning`. The six pgvector integration
parameters were skipped because `PGVECTOR_TEST_DATABASE_URL` was not configured.
The warning is the existing FastAPI/Starlette `httpx` deprecation warning.

```powershell
.\.venv\Scripts\python.exe -m ruff check .
```

Result: all checks passed.

```powershell
.\.venv\Scripts\python.exe -m ruff format --check .
```

Result: 102 files already formatted.

```powershell
.\.venv\Scripts\python.exe -m mypy .
```

Result: success with no issues in 102 source files.

```powershell
.\.venv\Scripts\python.exe -m pip check
```

Result: no broken requirements.

From the repository root:

```powershell
docker compose config --quiet
git diff --check
```

Result: both passed.

The generic smoke script was run with mock providers:

```text
generation_provider=mock
[mock provider] Explain semantic caching
embedding_provider=mock dimensions=384
```

## Real Ollama verification

A real Ollama request was not performed. The local environment check reported
`ollama_cli=not_installed`. All Ollama adapter tests used
`httpx.MockTransport`; no external provider or local model server was called.

## Limitations

- Ollama must be installed, running, reachable, and have the configured models
  pulled before a real smoke test.
- Model dimension values are explicit configuration and are validated against
  every returned embedding.
- Mock embeddings are predictable development fixtures, not production
  semantic models.
- The basic health endpoint reports configuration, not external readiness.
- The Ollama container is opt-in, and model downloads and lifecycle remain
  explicit rather than being performed during application startup.

## Scope confirmation

Phase 8 changed provider adapters, provider configuration, health metadata,
tests, and provider documentation only. Phase 9 load testing and observability
work was not started.

## Completion

Phase 8 is complete. Hugging Face remains the default, provider capabilities
remain independently selectable, Ollama and mock adapters satisfy the existing
ports, and all available required quality checks pass.
