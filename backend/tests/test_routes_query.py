from collections.abc import Sequence

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.cache_backend import InMemoryCacheBackend
from app.services.cache_service import SemanticCache


class IdenticalEmbeddingService:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)


class FakeHuggingFaceService:
    def __init__(self) -> None:
        self.call_count = 0

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        return "Generated response"


def test_cache_hit_skips_huggingface_call(settings: Settings) -> None:
    application = create_app(settings)
    cache = SemanticCache(
        IdenticalEmbeddingService(),
        InMemoryCacheBackend(10, 60),
        0.92,
    )
    provider = FakeHuggingFaceService()
    with TestClient(application) as client:
        application.state.semantic_cache = cache
        application.state.huggingface_service = provider
        assert client.post("/api/v1/query", json={"prompt": "Original question"}).status_code == 200
        assert provider.call_count == 1
        provider.call_count = 0
        second = client.post("/api/v1/query", json={"prompt": "Equivalent question"})
        assert second.status_code == 200
        assert second.json()["cache_hit"] is True
        assert provider.call_count == 0


def test_rejects_empty_prompt(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.post("/api/v1/query", json={"prompt": "\u0000 \n\t"})
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"
