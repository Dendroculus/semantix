import asyncio
from datetime import UTC, datetime

import pytest

from app.cache.keys import prompt_cache_key
from app.cache.models import CacheEntry
from app.cache.namespaces import DEFAULT_CACHE_NAMESPACE
from app.core.limits import MAX_RESPONSE_PREVIEW_LENGTH
from tests.support import memory_backend, unit_vector


def entry(
    prompt: str,
    response: str,
    *,
    namespace: str = DEFAULT_CACHE_NAMESPACE,
    vector_index: int,
) -> CacheEntry:
    return CacheEntry(
        cache_key=prompt_cache_key(prompt, namespace=namespace),
        namespace=namespace,
        prompt=prompt,
        response=response,
        embedding=unit_vector(vector_index),
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_similarity_and_entry_metadata() -> None:
    backend = memory_backend()
    alpha = entry(
        "alpha prompt",
        "a" * 300,
        vector_index=0,
    )
    beta = entry(
        "beta prompt",
        "beta response",
        vector_index=1,
    )
    await backend.put(alpha)
    await asyncio.sleep(0.002)
    await backend.put(beta)

    nearest = await backend.find_nearest(
        unit_vector(),
        namespace=DEFAULT_CACHE_NAMESPACE,
    )
    assert nearest is not None
    assert nearest.entry.prompt == "alpha prompt"
    assert nearest.similarity_score == pytest.approx(1.0)
    assert await backend.record_hit(alpha.cache_key)

    listing = await backend.list_entries(
        offset=0,
        limit=10,
        namespace=None,
        search=" ALPHA ",
        sort="most_hit",
    )
    assert listing.total == 1
    metadata = listing.items[0]
    assert metadata.hit_count == 1
    assert metadata.last_accessed_at is not None
    assert metadata.recency_rank == 1
    assert len(metadata.response_preview) == MAX_RESPONSE_PREVIEW_LENGTH
    assert metadata.response_preview.endswith("...")
    assert metadata.expires_at is not None
    assert metadata.remaining_ttl_seconds is not None
    assert metadata.remaining_ttl_seconds > 0
    assert "embedding" not in metadata.model_dump()


@pytest.mark.asyncio
async def test_sort_pagination_delete_and_clear() -> None:
    backend = memory_backend(ttl_seconds=None)
    prompts = ("alpha", "beta", "gamma")
    for index, prompt in enumerate(prompts):
        await backend.put(
            entry(
                prompt,
                f"{prompt} response",
                vector_index=index,
            )
        )
        await asyncio.sleep(0.002)

    newest = await backend.list_entries(
        offset=0,
        limit=2,
        namespace=None,
        search=None,
        sort="newest",
    )
    assert [item.prompt for item in newest.items] == [
        "gamma",
        "beta",
    ]
    assert newest.has_more

    oldest = await backend.list_entries(
        offset=0,
        limit=10,
        namespace=None,
        search=None,
        sort="oldest",
    )
    assert [item.prompt for item in oldest.items] == list(prompts)

    alpha_key = prompt_cache_key("alpha")
    alpha = await backend.get_entry(alpha_key)
    assert alpha is not None
    assert alpha.expires_at is None
    assert await backend.delete_entry(alpha_key)
    assert await backend.get_entry(alpha_key) is None

    await backend.clear(None)
    assert (
        await backend.list_entries(
            offset=0,
            limit=10,
            namespace=None,
            search=None,
            sort="newest",
        )
    ).total == 0


@pytest.mark.asyncio
async def test_expiry_and_lru_capacity() -> None:
    expiring = memory_backend(ttl_seconds=0.01)
    alpha = entry(
        "alpha",
        "alpha response",
        vector_index=0,
    )
    await expiring.put(alpha)
    await asyncio.sleep(0.02)
    assert await expiring.get_entry(alpha.cache_key) is None

    bounded = memory_backend(
        ttl_seconds=None,
        max_size=1,
    )
    await bounded.put(alpha)
    beta = entry(
        "beta",
        "beta response",
        vector_index=1,
    )
    await bounded.put(beta)
    assert await bounded.get_entry(alpha.cache_key) is None
    assert await bounded.get_entry(beta.cache_key) is not None


@pytest.mark.asyncio
async def test_namespace_filtering_stats_and_clear() -> None:
    backend = memory_backend(ttl_seconds=None)
    alpha = entry(
        "shared prompt",
        "alpha response",
        namespace="tenant-alpha",
        vector_index=0,
    )
    beta = entry(
        "shared prompt",
        "beta response",
        namespace="tenant-beta",
        vector_index=0,
    )
    await backend.put(alpha)
    await backend.put(beta)

    nearest = await backend.find_nearest(
        unit_vector(),
        namespace="tenant-alpha",
    )
    assert nearest is not None
    assert nearest.entry.response == "alpha response"
    assert await backend.record_hit(alpha.cache_key)
    await backend.record_miss("tenant-alpha")
    await backend.record_miss("tenant-beta")

    global_stats = await backend.stats(None)
    alpha_stats = await backend.stats("tenant-alpha")
    beta_stats = await backend.stats("tenant-beta")
    assert global_stats.model_dump() == {
        "size": 2,
        "hits": 1,
        "misses": 2,
        "hit_rate": pytest.approx(1 / 3),
    }
    assert alpha_stats.model_dump() == {
        "size": 1,
        "hits": 1,
        "misses": 1,
        "hit_rate": 0.5,
    }
    assert beta_stats.model_dump() == {
        "size": 1,
        "hits": 0,
        "misses": 1,
        "hit_rate": 0.0,
    }

    listing = await backend.list_entries(
        offset=0,
        limit=10,
        namespace="tenant-alpha",
        search=None,
        sort="newest",
    )
    assert [item.namespace for item in listing.items] == ["tenant-alpha"]

    await backend.clear("tenant-alpha")
    assert (await backend.stats("tenant-alpha")).model_dump() == {
        "size": 0,
        "hits": 0,
        "misses": 0,
        "hit_rate": 0.0,
    }
    assert (await backend.stats(None)).model_dump() == {
        "size": 1,
        "hits": 0,
        "misses": 1,
        "hit_rate": 0.0,
    }
