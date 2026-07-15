import asyncio
from collections.abc import Sequence
from datetime import UTC, datetime

import pytest

from app.models.schemas import CacheEntry, EMBEDDING_DIMENSIONS
from app.services.cache_backend import InMemoryCacheBackend, prompt_cache_key
from app.services.cache_service import SemanticCache


def vector(index: int) -> list[float]:
    result = [0.0] * EMBEDDING_DIMENSIONS
    result[index] = 1.0
    return result


class FakeEmbeddingService:
    async def embed(self, text: str) -> Sequence[float]:
        return vector(0) if text in {"How are you?", "How are things?"} else vector(1)


@pytest.mark.asyncio
async def test_semantic_hit_returns_cached_response() -> None:
    backend = InMemoryCacheBackend(10, 60)
    cache = SemanticCache(FakeEmbeddingService(), backend, 0.92)
    first = await cache.lookup("How are you?")
    await cache.store("How are you?", "I am well.", first.embedding)
    second = await cache.lookup("How are things?")
    assert second.cache_hit is True
    assert second.response == "I am well."
    assert second.similarity_score == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_ttl_expiration_invalidates_entry() -> None:
    backend = InMemoryCacheBackend(10, 0.01)
    cache = SemanticCache(FakeEmbeddingService(), backend, 0.92)
    lookup = await cache.lookup("How are you?")
    await cache.store("How are you?", "Cached", lookup.embedding)
    await asyncio.sleep(0.02)
    assert (await cache.lookup("How are things?")).cache_hit is False


@pytest.mark.asyncio
async def test_lru_evicts_least_recently_used_entry() -> None:
    backend = InMemoryCacheBackend(2, None)
    entries = [
        CacheEntry(
            cache_key=prompt_cache_key(name),
            prompt=name,
            response=name + " response",
            embedding=vector(index),
            created_at=datetime.now(UTC),
        )
        for index, name in enumerate(("first", "second", "third"))
    ]
    await backend.put(entries[0])
    await backend.put(entries[1])
    assert await backend.record_hit(entries[0].cache_key) is True
    await backend.put(entries[2])
    candidate = await backend.find_nearest(vector(1))
    assert candidate is not None
    assert candidate.similarity_score < 1.0
