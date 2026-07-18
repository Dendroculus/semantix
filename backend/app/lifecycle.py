from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

import httpx
from fastapi import FastAPI

from app.benchmark.service import BenchmarkService
from app.cache.memory import InMemoryCacheBackend
from app.cache.service import SemanticCache
from app.core.config import Settings
from app.providers.embedding import EmbeddingService
from app.providers.huggingface import HuggingFaceService

Lifespan = Callable[
    [FastAPI],
    AbstractAsyncContextManager[None],
]


def create_lifespan(
    settings: Settings,
    api_key: str,
) -> Lifespan:
    @asynccontextmanager
    async def lifespan(
        application: FastAPI,
    ) -> AsyncIterator[None]:
        timeout = httpx.Timeout(settings.hf_timeout_seconds)

        async with httpx.AsyncClient(timeout=timeout) as client:
            provider = HuggingFaceService(
                client=client,
                api_key=api_key,
                inference_base_url=settings.hf_inference_base_url,
                chat_base_url=settings.hf_chat_base_url,
                embedding_model=settings.hf_embedding_model,
                generation_model=settings.hf_generation_model,
                max_new_tokens=settings.generation_max_new_tokens,
            )
            backend = InMemoryCacheBackend(
                settings.max_cache_size,
                settings.cache_ttl_seconds,
            )
            embedding_service = EmbeddingService(provider)

            application.state.huggingface_service = provider
            application.state.semantic_cache = SemanticCache(
                embedding_service,
                backend,
                settings.similarity_threshold,
            )
            application.state.benchmark_service = BenchmarkService(
                embedding_service,
                provider,
                max_cache_size=settings.max_cache_size,
                cache_ttl_seconds=settings.cache_ttl_seconds,
                initial_threshold=settings.similarity_threshold,
            )

            yield

    return lifespan
