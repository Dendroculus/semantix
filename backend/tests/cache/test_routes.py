from collections.abc import Sequence

from fastapi.testclient import TestClient

from app.cache.keys import prompt_cache_key
from app.cache.service import SemanticCache
from app.core.config import Settings
from app.factory import create_app
from app.query.service import QueryService
from tests.support import memory_backend, unit_vector


class RouteEmbeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return unit_vector()


class Provider:
    async def generate(self, prompt: str) -> str:
        return f"Generated for {prompt}"


def test_cache_inspector_routes(settings: Settings) -> None:
    app = create_app(settings)
    cache = SemanticCache(
        RouteEmbeddings(),
        memory_backend(),
        0.92,
    )
    provider = Provider()

    with TestClient(app) as client:
        app.state.semantic_cache = cache
        app.state.query_service = QueryService(
            cache,
            provider,
        )

        assert (
            client.post(
                "/api/v1/query",
                json={"prompt": "source prompt"},
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/v1/query",
                json={"prompt": "similar prompt"},
            ).json()["cache_hit"]
            is True
        )

        listing_response = client.get(
            "/api/v1/cache/entries",
            params={
                "search": "source",
                "sort": "most_hit",
                "limit": 10,
            },
        )
        listing = listing_response.json()
        assert listing_response.status_code == 200
        assert listing["total"] == 1
        assert listing["has_more"] is False
        assert listing["items"][0]["prompt"] == "source prompt"
        assert listing["items"][0]["hit_count"] == 1
        assert listing["items"][0]["last_accessed_at"] is not None
        assert "embedding" not in listing["items"][0]

        cache_key = prompt_cache_key("source prompt")
        detail_response = client.get(f"/api/v1/cache/entries/{cache_key}")
        assert detail_response.status_code == 200
        assert detail_response.json()["cache_key"] == cache_key
        assert "embedding" not in detail_response.json()

        delete_response = client.delete(f"/api/v1/cache/entries/{cache_key}")
        assert delete_response.json() == {
            "deleted": True,
            "cache_key": cache_key,
        }

        missing_response = client.get(f"/api/v1/cache/entries/{cache_key}")
        assert missing_response.status_code == 404
        assert missing_response.json()["error"] == "cache_entry_not_found"

        client.post(
            "/api/v1/query",
            json={"prompt": "new source"},
        )
        assert client.delete("/api/v1/cache").json() == {"cleared": True}
        assert client.get("/api/v1/cache/entries").json()["items"] == []
        assert (
            client.get(
                "/api/v1/cache/entries",
                params={"sort": "unsupported"},
            ).status_code
            == 422
        )


def test_threshold_routes(settings: Settings) -> None:
    app = create_app(settings)
    cache = SemanticCache(
        RouteEmbeddings(),
        memory_backend(),
        0.92,
    )

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
