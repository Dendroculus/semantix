# Semantic Cache System

A single-instance semantic caching middleware built with FastAPI, React,
Hugging Face, and an in-memory NumPy vector store.

## Architecture

SemanticCache coordinates three replaceable responsibilities:

1. EmbeddingService validates and normalizes provider embeddings.
2. CacheBackend performs vector search and cache invalidation.
3. HuggingFaceService handles external API calls and retry policy.

The in-memory backend uses cosine similarity, LRU eviction, and TTL expiry.
A future vector database can implement CacheBackend without changing routes
or request orchestration.

## Configuration

Copy backend/.env.example to backend/.env and provide a valid Hugging Face
API token. Copy frontend/.env.example to frontend/.env. Never commit either
populated .env file.

## Backend development

From backend, create a Python 3.11 virtual environment, install the project,
then run:

    python -m venv .venv
    .venv/Scripts/pip install -e ".[dev]"
    .venv/Scripts/mypy app tests
    .venv/Scripts/pytest
    .venv/Scripts/uvicorn app.main:app --reload

## Frontend development

From frontend:

    npm install
    npm run build
    npm run lint:no-any
    npm test
    npm run dev

## Docker

After creating both .env files:

    docker compose up --build

API: http://localhost:8000
Frontend: http://localhost:5173

## API

- POST /api/v1/query
- GET /api/v1/cache/stats
- DELETE /api/v1/cache
- GET /health

All errors contain error and detail fields.

## Security notes

- API tokens are read only from environment configuration.
- CORS rejects wildcard origins.
- Prompts and responses are not written to INFO logs.
- Provider errors and stack traces are not returned to clients.
- Public endpoints are rate-limited per client IP.
- Add authentication before exposing DELETE /api/v1/cache publicly.
