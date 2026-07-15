from collections.abc import Sequence
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.cache_backend import InMemoryCacheBackend
from app.services.cache_service import SemanticCache


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)


class Provider:
    def __init__(self) -> None:
        self.call_count = 0

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        return "answer"


def test_hit_skips_provider(settings: Settings) -> None:
    app = create_app(settings)
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 60), 0.92)
    provider = Provider()
    with TestClient(app) as client:
        app.state.semantic_cache = cache
        app.state.huggingface_service = provider
        assert client.post("/api/v1/query", json={"prompt": "one"}).status_code == 200
        provider.call_count = 0
        assert (
            client.post("/api/v1/query", json={"prompt": "similar"}).json()["cache_hit"]
            is True
        )
        assert provider.call_count == 0


def test_empty_prompt(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.post("/api/v1/query", json={"prompt": "   "})
    assert response.status_code == 422


def test_threshold_can_be_read_and_updated(settings: Settings) -> None:
    app = create_app(settings)
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 60), 0.92)

    with TestClient(app) as client:
        app.state.semantic_cache = cache

        assert client.get("/api/v1/cache/threshold").json() == {"threshold": 0.92}
        assert client.put(
            "/api/v1/cache/threshold",
            json={"threshold": 0.84},
        ).json() == {"threshold": 0.84}
        assert (
            client.put(
                "/api/v1/cache/threshold",
                json={"threshold": 1.1},
            ).status_code
            == 422
        )
