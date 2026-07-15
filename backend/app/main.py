from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api.routes import cache, health, query
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    http_error_handler,
    rate_limit_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import configure_logging
from app.middleware.rate_limit import limiter
from app.services.cache_backend import InMemoryCacheBackend
from app.services.cache_service import SemanticCache
from app.services.embedding_service import EmbeddingService
from app.services.huggingface_service import HuggingFaceService


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    api_key = resolved_settings.hf_api_key.get_secret_value()
    configure_logging(resolved_settings.log_level, (api_key,))

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        timeout = httpx.Timeout(resolved_settings.hf_timeout_seconds)

        async with httpx.AsyncClient(timeout=timeout) as client:
            provider = HuggingFaceService(
                client,
                api_key,
                resolved_settings.hf_base_url,
                resolved_settings.hf_embedding_model,
                resolved_settings.hf_generation_model,
                resolved_settings.generation_max_new_tokens,
            )
            backend = InMemoryCacheBackend(
                resolved_settings.max_cache_size,
                resolved_settings.cache_ttl_seconds,
            )

            application.state.huggingface_service = provider
            application.state.semantic_cache = SemanticCache(
                EmbeddingService(provider),
                backend,
                resolved_settings.similarity_threshold,
            )
            yield

    application = FastAPI(
        title="Semantic Cache API",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.state.limiter = limiter
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )

    application.add_exception_handler(AppError, app_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(RateLimitExceeded, rate_limit_error_handler)
    application.add_exception_handler(HTTPException, http_error_handler)
    application.add_exception_handler(Exception, unhandled_error_handler)

    application.include_router(query.router)
    application.include_router(cache.router)
    application.include_router(health.router)
    return application


app = create_app()
