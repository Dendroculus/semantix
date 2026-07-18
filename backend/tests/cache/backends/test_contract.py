import asyncio
import os
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from uuid import uuid4

import pytest

from app.cache.factory import cache_backend_lifespan
from app.cache.keys import prompt_cache_key
from app.cache.namespaces import DEFAULT_CACHE_NAMESPACE
from app.cache.protocols import CacheBackend
from app.core.config import Settings
from app.core.exceptions import CacheStorageError
from app.core.limits import MAX_RESPONSE_PREVIEW_LENGTH
from tests.cache.backends.support import cache_entry
from tests.support import TEST_EMBEDDING_DIMENSIONS, unit_vector

BackendBuilder = Callable[
    [int, float | None],
    AbstractAsyncContextManager[CacheBackend],
]


@pytest.fixture(
    params=[
        "memory",
        pytest.param(
            "pgvector",
            marks=pytest.mark.pgvector,
        ),
    ]
)
def backend_builder(
    request: pytest.FixtureRequest,
) -> BackendBuilder:
    backend_name = str(request.param)
    database_url = os.getenv("PGVECTOR_TEST_DATABASE_URL")
    if backend_name == "pgvector" and not database_url:
        pytest.skip("PGVECTOR_TEST_DATABASE_URL is not configured")

    @asynccontextmanager
    async def build(
        max_size: int,
        ttl_seconds: float | None,
    ) -> AsyncIterator[CacheBackend]:
        settings = Settings(
            cache_backend=backend_name,
            database_url=database_url,
            max_cache_size=max_size,
            cache_ttl_seconds=ttl_seconds,
            hf_api_key="test-only-placeholder",
            hf_embedding_model=f"phase7-contract-{uuid4().hex}",
            hf_embedding_dimensions=TEST_EMBEDDING_DIMENSIONS,
            allowed_origins=["http://localhost:5173"],
        )
        async with cache_backend_lifespan(
            settings,
            dimensions=TEST_EMBEDDING_DIMENSIONS,
        ) as backend:
            try:
                yield backend
            finally:
                await backend.clear(None)

    return build


@pytest.mark.asyncio
async def test_similarity_and_entry_metadata(
    backend_builder: BackendBuilder,
) -> None:
    async with backend_builder(10, 60) as backend:
        alpha = cache_entry(
            "alpha prompt",
            "a" * 300,
            vector_index=0,
        )
        beta = cache_entry(
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
async def test_sort_pagination_delete_and_clear(
    backend_builder: BackendBuilder,
) -> None:
    async with backend_builder(10, None) as backend:
        prompts = ("alpha", "beta", "gamma")
        for index, prompt in enumerate(prompts):
            await backend.put(
                cache_entry(
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
async def test_expiry_and_lru_capacity(
    backend_builder: BackendBuilder,
) -> None:
    async with backend_builder(1, 1) as backend:
        expiring = cache_entry(
            "expiring",
            "response",
            vector_index=0,
        )
        await backend.put(expiring)
        await asyncio.sleep(1.05)
        assert await backend.get_entry(expiring.cache_key) is None

    async with backend_builder(1, None) as backend:
        alpha = cache_entry(
            "alpha",
            "alpha response",
            vector_index=0,
        )
        beta = cache_entry(
            "beta",
            "beta response",
            vector_index=1,
        )
        await backend.put(alpha)
        await backend.put(beta)
        assert await backend.get_entry(alpha.cache_key) is None
        assert await backend.get_entry(beta.cache_key) is not None


@pytest.mark.asyncio
async def test_namespace_filtering_stats_and_clear(
    backend_builder: BackendBuilder,
) -> None:
    async with backend_builder(10, None) as backend:
        alpha = cache_entry(
            "shared prompt",
            "alpha response",
            namespace="tenant-alpha",
            vector_index=0,
        )
        beta = cache_entry(
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


@pytest.mark.asyncio
async def test_invalid_vectors_are_rejected_consistently(
    backend_builder: BackendBuilder,
) -> None:
    async with backend_builder(10, None) as backend:
        with pytest.raises(CacheStorageError, match="Zero magnitude"):
            await backend.find_nearest(
                [0.0] * TEST_EMBEDDING_DIMENSIONS,
                namespace=DEFAULT_CACHE_NAMESPACE,
            )
