import asyncio
from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.exceptions import CacheEntryNotFoundError
from app.main import create_app
from app.cache.keys import prompt_cache_key
from app.cache.memory import InMemoryCacheBackend
from app.cache.service import SemanticCache
from app.core.schemas import EMBEDDING_DIMENSIONS, MAX_RESPONSE_PREVIEW_LENGTH


def vector(index: int) -> list[float]:
    result = [0.0] * EMBEDDING_DIMENSIONS
    result[index] = 1.0
    return result


class InspectorEmbeddings:
    async def embed(self, text: str) -> Sequence[float]:
        if "alpha" in text:
            return vector(0)
        if "beta" in text:
            return vector(1)
        return vector(2)


class RouteEmbeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return vector(0)


class Provider:
    async def generate(self, prompt: str) -> str:
        return f"Generated for {prompt}"


async def seed(
    cache: SemanticCache,
    prompt: str,
    response: str,
) -> None:
    lookup = await cache.lookup(prompt)
    assert not lookup.cache_hit
    await cache.store(prompt, response, lookup.embedding)


@pytest.mark.asyncio
async def test_listing_search_sort_pagination_and_access_metadata() -> None:
    cache = SemanticCache(
        InspectorEmbeddings(),
        InMemoryCacheBackend(10, 60),
        0.95,
    )
    await seed(cache, "alpha prompt", "a" * 300)
    await asyncio.sleep(0.002)
    await seed(cache, "beta prompt", "beta response")
    await asyncio.sleep(0.002)
    await seed(cache, "gamma prompt", "gamma response")

    hit = await cache.lookup("alpha related")
    assert hit.cache_hit

    newest = await cache.list_entries(
        offset=0,
        limit=2,
        search=None,
        sort="newest",
    )
    assert [item.prompt for item in newest.items] == [
        "gamma prompt",
        "beta prompt",
    ]
    assert newest.total == 3
    assert newest.has_more is True

    second_page = await cache.list_entries(
        offset=2,
        limit=2,
        search=None,
        sort="newest",
    )
    assert [item.prompt for item in second_page.items] == ["alpha prompt"]
    assert second_page.has_more is False

    oldest = await cache.list_entries(
        offset=0,
        limit=10,
        search=None,
        sort="oldest",
    )
    assert [item.prompt for item in oldest.items] == [
        "alpha prompt",
        "beta prompt",
        "gamma prompt",
    ]

    most_hit = await cache.list_entries(
        offset=0,
        limit=10,
        search=None,
        sort="most_hit",
    )
    alpha = most_hit.items[0]
    assert alpha.prompt == "alpha prompt"
    assert alpha.hit_count == 1
    assert alpha.last_accessed_at is not None
    assert alpha.recency_rank == 1
    assert len(alpha.response_preview) == MAX_RESPONSE_PREVIEW_LENGTH
    assert alpha.response_preview.endswith("...")
    assert alpha.expires_at is not None
    assert alpha.remaining_ttl_seconds is not None
    assert alpha.remaining_ttl_seconds > 0
    assert alpha.is_expired is False
    assert "embedding" not in alpha.model_dump()

    nearest_expiry = await cache.list_entries(
        offset=0,
        limit=10,
        search=None,
        sort="nearest_expiry",
    )
    assert nearest_expiry.items[0].prompt == "alpha prompt"

    search_result = await cache.list_entries(
        offset=0,
        limit=10,
        search=" BETA ",
        sort="newest",
    )
    assert [item.prompt for item in search_result.items] == ["beta prompt"]


@pytest.mark.asyncio
async def test_read_delete_and_clear_entry_metadata() -> None:
    cache = SemanticCache(
        InspectorEmbeddings(),
        InMemoryCacheBackend(10, None),
        0.95,
    )
    await seed(cache, "alpha prompt", "alpha response")
    await seed(cache, "beta prompt", "beta response")

    alpha_key = prompt_cache_key("alpha prompt")
    alpha = await cache.get_entry(alpha_key)
    assert alpha.prompt == "alpha prompt"
    assert alpha.expires_at is None
    assert alpha.remaining_ttl_seconds is None

    await cache.delete_entry(alpha_key)
    with pytest.raises(CacheEntryNotFoundError):
        await cache.get_entry(alpha_key)

    remaining = await cache.list_entries(
        offset=0,
        limit=10,
        search=None,
        sort="newest",
    )
    assert [item.prompt for item in remaining.items] == ["beta prompt"]

    await cache.clear()
    cleared = await cache.list_entries(
        offset=0,
        limit=10,
        search=None,
        sort="newest",
    )
    assert cleared.total == 0
    assert cleared.items == []


@pytest.mark.asyncio
async def test_inspector_purges_expired_entries() -> None:
    cache = SemanticCache(
        InspectorEmbeddings(),
        InMemoryCacheBackend(10, 0.01),
        0.95,
    )
    await seed(cache, "alpha prompt", "alpha response")
    cache_key = prompt_cache_key("alpha prompt")

    await asyncio.sleep(0.02)

    listing = await cache.list_entries(
        offset=0,
        limit=10,
        search=None,
        sort="newest",
    )
    assert listing.total == 0
    with pytest.raises(CacheEntryNotFoundError):
        await cache.get_entry(cache_key)


def test_cache_inspector_routes(settings: Settings) -> None:
    app = create_app(settings)
    cache = SemanticCache(
        RouteEmbeddings(),
        InMemoryCacheBackend(10, 60),
        0.92,
    )

    with TestClient(app) as client:
        app.state.semantic_cache = cache
        app.state.huggingface_service = Provider()

        assert (
            client.post("/api/v1/query", json={"prompt": "source prompt"}).status_code
            == 200
        )
        assert (
            client.post("/api/v1/query", json={"prompt": "similar prompt"}).json()[
                "cache_hit"
            ]
            is True
        )

        listing_response = client.get(
            "/api/v1/cache/entries",
            params={"search": "source", "sort": "most_hit", "limit": 10},
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
        assert delete_response.json() == {"deleted": True, "cache_key": cache_key}

        missing_response = client.get(f"/api/v1/cache/entries/{cache_key}")
        assert missing_response.status_code == 404
        assert missing_response.json()["error"] == "cache_entry_not_found"

        client.post("/api/v1/query", json={"prompt": "new source"})
        assert client.delete("/api/v1/cache").json() == {"cleared": True}
        assert client.get("/api/v1/cache/entries").json()["items"] == []
        assert (
            client.get(
                "/api/v1/cache/entries",
                params={"sort": "unsupported"},
            ).status_code
            == 422
        )
