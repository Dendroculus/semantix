from collections.abc import Sequence
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.cache_backend import InMemoryCacheBackend, prompt_cache_key
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


def test_query_explains_miss_and_hit(settings: Settings) -> None:
    app = create_app(settings)
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 60), 0.92)
    provider = Provider()

    with TestClient(app) as client:
        app.state.semantic_cache = cache
        app.state.huggingface_service = provider

        miss_response = client.post("/api/v1/query", json={"prompt": "one"})
        miss = miss_response.json()

        assert miss_response.status_code == 200
        assert miss["cache_hit"] is False
        assert miss["similarity_score"] is None
        assert miss["similarity_threshold"] == pytest.approx(0.92)
        assert miss["matched_prompt"] is None
        assert miss["matched_cache_key"] is None
        assert miss["cache_entry_created_at"] is None
        assert miss["cache_entry_age_seconds"] is None
        assert miss["generation_skipped"] is False
        assert miss["provider_called"] is True
        assert "embedding" not in miss
        assert provider.call_count == 1

        provider.call_count = 0

        hit_response = client.post("/api/v1/query", json={"prompt": "similar"})
        hit = hit_response.json()

        assert hit_response.status_code == 200
        assert hit["cache_hit"] is True
        assert hit["similarity_score"] == pytest.approx(1.0)
        assert hit["similarity_threshold"] == pytest.approx(0.92)
        assert hit["matched_prompt"] == "one"
        assert hit["matched_cache_key"] == prompt_cache_key("one")
        assert (
            datetime.fromisoformat(hit["cache_entry_created_at"]).utcoffset()
            is not None
        )
        assert hit["cache_entry_age_seconds"] >= 0
        assert hit["generation_skipped"] is True
        assert hit["provider_called"] is False
        assert "embedding" not in hit
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
