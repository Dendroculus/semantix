# AI providers

Semantix selects embedding and generation providers independently behind the
`EmbeddingProvider` and `GenerationProvider` ports. Application routes, cache
logic, benchmarks, and query orchestration do not import concrete adapters.
Hugging Face remains the default for both capabilities.

## Capabilities

| Provider | Embeddings | Generation | Credentials required |
|---|:---:|:---:|:---:|
| Hugging Face | Yes | Yes | Yes |
| OpenAI | Yes | Yes | Yes |
| Anthropic | No | Yes | Yes |
| Gemini | Yes | Yes | Yes |
| Ollama | Yes | Yes | No for a local server |
| Mock | Yes | Yes | No |

Set the providers independently:

```env
EMBEDDING_PROVIDER=huggingface
GENERATION_PROVIDER=ollama
```

Only fields required by the selected capabilities are validated. For example,
Ollama generation does not require an Ollama embedding model or dimensions.
Anthropic cannot be selected for embeddings.

## Hosted providers

Hosted-provider base URLs must be absolute HTTPS URLs without embedded
credentials, queries, or fragments. Store API keys only in `backend/.env` or a
deployment secret store.

### Hugging Face

```env
EMBEDDING_PROVIDER=huggingface
GENERATION_PROVIDER=huggingface

HF_API_KEY=
HF_INFERENCE_BASE_URL=https://router.huggingface.co/hf-inference/models
HF_CHAT_BASE_URL=https://router.huggingface.co/v1
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_GENERATION_MODEL=Qwen/Qwen3-4B-Instruct-2507:nscale
HF_EMBEDDING_DIMENSIONS=384
```

### OpenAI

```env
EMBEDDING_PROVIDER=openai
GENERATION_PROVIDER=openai

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=
OPENAI_GENERATION_MODEL=
OPENAI_EMBEDDING_DIMENSIONS=
```

### Anthropic

Anthropic supports generation only:

```env
GENERATION_PROVIDER=anthropic

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_GENERATION_MODEL=
```

### Gemini

```env
EMBEDDING_PROVIDER=gemini
GENERATION_PROVIDER=gemini

GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_EMBEDDING_MODEL=
GEMINI_GENERATION_MODEL=
GEMINI_EMBEDDING_DIMENSIONS=
```

## Ollama

Hugging Face is the recommended default for most users because it avoids local
model downloads and inference hardware requirements. Choose Ollama when local
inference is specifically required and the machine has sufficient disk,
memory, and compute capacity.

For a backend running directly on the host:

```env
EMBEDDING_PROVIDER=ollama
GENERATION_PROVIDER=ollama

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=embeddinggemma
OLLAMA_GENERATION_MODEL=gemma3:4b
OLLAMA_EMBEDDING_DIMENSIONS=768
```

The repository includes an optional Ollama Compose profile. Start the service
and pull models explicitly:

```bash
docker compose --profile ollama up -d ollama
docker compose --profile ollama exec ollama ollama pull embeddinggemma
docker compose --profile ollama exec ollama ollama pull gemma3:4b
```

Configure container-to-container access with:

```env
OLLAMA_BASE_URL=http://ollama:11434
```

Start the application with Ollama and the memory cache:

```bash
docker compose --profile ollama up --build -d
```

Activate both optional profiles for Ollama with pgvector:

```bash
docker compose --profile pgvector --profile ollama up --build -d
```

Semantix never pulls models during application startup. Model names and tags
must exactly match `ollama list`; for example, configuring `gemma3` does not
select an installed model named `gemma3:4b`.

Semantix calls the native Ollama API:

- `POST /api/embed` for embeddings;
- `POST /api/generate` with streaming disabled for generation.

The profile remains opt-in, so normal Hugging Face, hosted-provider, and mock
workflows do not download Ollama. Ollama models persist in
`semantix_ollama_data` and may consume several gigabytes.

To stop using Ollama, restore the provider selectors in `backend/.env`, start
the stack without the `ollama` profile, and remove only the Ollama resources:

```bash
docker compose --profile ollama stop ollama
docker compose --profile ollama rm -f ollama
docker volume rm semantix_ollama_data
docker image rm ollama/ollama:latest
```

Volume removal permanently deletes downloaded Ollama models but leaves
`semantix_pgvector_data` intact. Do not use `docker compose down --volumes`
when the PostgreSQL cache must be preserved.

## Mock providers

Mock providers make the complete application usable without credentials or
network calls:

```env
EMBEDDING_PROVIDER=mock
GENERATION_PROVIDER=mock
MOCK_EMBEDDING_DIMENSIONS=384
```

Mock embeddings use deterministic SHA-256 token features and are unit
normalized. Mock generation returns a deterministic response prefixed with
`[mock provider]`. They are intended for automated tests, demonstrations, and
UI development—not production-quality semantic embeddings or answers.

## Embedding compatibility

Embedding dimensions must match the exact vector returned by the configured
model. Semantix rejects malformed, non-finite, empty, and dimensionally invalid
vectors rather than truncating or padding them.

Changing the embedding provider, model, or dimensions creates a different
embedding space. The pgvector backend separates those spaces so incompatible
vectors are not compared. The in-memory backend starts empty when the process
restarts.

## Smoke tests

The generic smoke script exercises whichever provider is selected in
`backend/.env`:

```powershell
cd backend

python scripts/smoke_provider.py generation "Explain semantic caching"
python scripts/smoke_provider.py embedding "Explain semantic caching"
```

Mock smoke tests require no external service. Ollama smoke tests require Ollama
to be running with the configured models already available.

## Tradeoffs and security

- Hosted providers are operationally simple but require credentials and may
  incur latency, usage charges, and data-processing considerations.
- Ollama keeps inference local but requires model storage, sufficient hardware,
  and local lifecycle management.
- Mock providers are deterministic and free but do not produce meaningful
  production answers.
- Never commit API keys or database credentials.
- Do not expose an unauthenticated Ollama API to an untrusted network.
- The `/health` endpoint reports provider type names only. It does not expose
  provider URLs, models, keys, or perform external readiness calls.

## Ollama troubleshooting

| Symptom | Check |
|---|---|
| Connection refused | Confirm `ollama serve` is running and port `11434` is reachable |
| Docker cannot reach Ollama | With the Compose profile, use `http://ollama:11434`; for a host installation, check `host.docker.internal` and `OLLAMA_HOST` |
| Model not found | Run `ollama list` and configure the exact installed tag, or pull the configured model |
| Embedding dimension error | Set `OLLAMA_EMBEDDING_DIMENSIONS` to the exact model output size |
| Request times out | Increase `PROVIDER_TIMEOUT_SECONDS` within its validated limit or use a smaller model |
| Backend fails during startup | Check selected-provider model fields and the Ollama base URL |

See the official Ollama documentation for the
[local API](https://docs.ollama.com/api/introduction),
[generation endpoint](https://docs.ollama.com/api/generate),
[embedding endpoint](https://docs.ollama.com/api/embed), and
[network configuration](https://docs.ollama.com/faq).
