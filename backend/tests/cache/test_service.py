import asyncio
from collections.abc import Sequence

import pytest

from app.cache.service import SemanticCache
from tests.support import (
    TEST_EMBEDDING_DIMENSIONS,
    memory_backend,
    unit_vector,
)


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        if text == "near":
            return [0.8, 0.6] + [0.0] * (TEST_EMBEDDING_DIMENSIONS - 2)

        return unit_vector() if text in {"one", "similar"} else unit_vector(1)


@pytest.mark.asyncio
async def test_semantic_hit() -> None:
    cache = SemanticCache(
        Embeddings(),
        memory_backend(),
        0.92,
    )
    miss = await cache.lookup("one")
    await cache.store("one", "answer", miss.embedding)
    hit = await cache.lookup("similar")

    assert hit.cache_hit
    assert hit.response == "answer"
    assert hit.similarity_threshold == pytest.approx(0.92)
    assert hit.matched_prompt == "one"
    assert hit.matched_cache_key is not None
    assert hit.cache_entry_created_at is not None


@pytest.mark.asyncio
async def test_ttl_expiry() -> None:
    cache = SemanticCache(
        Embeddings(),
        memory_backend(ttl_seconds=0.01),
        0.92,
    )
    miss = await cache.lookup("one")
    await cache.store("one", "answer", miss.embedding)
    await asyncio.sleep(0.02)
    assert not (await cache.lookup("similar")).cache_hit


@pytest.mark.asyncio
async def test_clear_resets_stats() -> None:
    cache = SemanticCache(
        Embeddings(),
        memory_backend(),
        0.92,
    )
    await cache.lookup("one")
    await cache.clear()
    assert (await cache.stats()).misses == 0


@pytest.mark.asyncio
async def test_updated_threshold_changes_lookup_rule() -> None:
    cache = SemanticCache(
        Embeddings(),
        memory_backend(),
        0.9,
    )
    initial_lookup = await cache.lookup("one")
    await cache.store("one", "answer", initial_lookup.embedding)

    miss = await cache.lookup("near")
    assert not miss.cache_hit
    assert miss.similarity_threshold == pytest.approx(0.9)
    assert miss.matched_prompt is None
    assert miss.matched_cache_key is None
    assert miss.cache_entry_created_at is None

    assert cache.update_similarity_threshold(0.75) == 0.75
    hit = await cache.lookup("near")
    assert hit.cache_hit
    assert hit.similarity_threshold == pytest.approx(0.75)
