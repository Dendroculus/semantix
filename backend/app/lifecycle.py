from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

import httpx
from fastapi import FastAPI

from app.benchmark.service import BenchmarkService
from app.cache.backends.memory import InMemoryCacheBackend
from app.cache.service import SemanticCache
from app.core.config import Settings
from app.embedding.service import EmbeddingService
from app.providers.factory import create_provider_bundle
from app.query.service import QueryService

Lifespan = Callable[
    [FastAPI],
    AbstractAsyncContextManager[None],
]


def create_lifespan(settings: Settings) -> Lifespan:
    @asynccontextmanager
    async def lifespan(
        application: FastAPI,
    ) -> AsyncIterator[None]:
        timeout = httpx.Timeout(
            settings.provider_timeout_seconds,
        )

        async with httpx.AsyncClient(timeout=timeout) as client:
            providers = create_provider_bundle(
                client,
                settings,
            )
            backend = InMemoryCacheBackend(
                settings.max_cache_size,
                settings.cache_ttl_seconds,
                dimensions=providers.embedding_dimensions,
            )
            embedding_service = EmbeddingService(
                providers.embedding_provider,
                dimensions=providers.embedding_dimensions,
            )

            semantic_cache = SemanticCache(
                embedding_service,
                backend,
                settings.similarity_threshold,
            )
            application.state.embedding_provider = providers.embedding_provider
            application.state.generation_provider = providers.generation_provider
            application.state.semantic_cache = semantic_cache
            application.state.query_service = QueryService(
                semantic_cache,
                providers.generation_provider,
            )
            application.state.benchmark_service = BenchmarkService(
                embedding_service,
                providers.generation_provider,
                max_cache_size=settings.max_cache_size,
                cache_ttl_seconds=settings.cache_ttl_seconds,
                initial_threshold=settings.similarity_threshold,
                embedding_dimensions=providers.embedding_dimensions,
            )

            yield

    return lifespan
