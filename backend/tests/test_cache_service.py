import asyncio
from collections.abc import Sequence
import pytest
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.cache_backend import InMemoryCacheBackend
from app.services.cache_service import SemanticCache


def vector(index: int) -> list[float]:
    result = [0.0] * EMBEDDING_DIMENSIONS
    result[index] = 1.0
    return result


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        if text == "near":
            return [0.8, 0.6] + [0.0] * (EMBEDDING_DIMENSIONS - 2)

        return vector(0) if text in {"one", "similar"} else vector(1)


@pytest.mark.asyncio
async def test_semantic_hit() -> None:
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 60), 0.92)
    miss = await cache.lookup("one")
    await cache.store("one", "answer", miss.embedding)
    hit = await cache.lookup("similar")
    assert hit.cache_hit and hit.response == "answer"


@pytest.mark.asyncio
async def test_ttl_expiry() -> None:
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 0.01), 0.92)
    miss = await cache.lookup("one")
    await cache.store("one", "answer", miss.embedding)
    await asyncio.sleep(0.02)
    assert not (await cache.lookup("similar")).cache_hit


@pytest.mark.asyncio
async def test_clear_resets_stats() -> None:
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 60), 0.92)
    await cache.lookup("one")
    await cache.clear()
    assert (await cache.stats()).misses == 0


@pytest.mark.asyncio
async def test_updated_threshold_changes_lookup_rule() -> None:
    cache = SemanticCache(Embeddings(), InMemoryCacheBackend(10, 60), 0.9)
    initial_lookup = await cache.lookup("one")
    await cache.store("one", "answer", initial_lookup.embedding)

    assert not (await cache.lookup("near")).cache_hit
    assert cache.update_similarity_threshold(0.75) == 0.75
    assert (await cache.lookup("near")).cache_hit
