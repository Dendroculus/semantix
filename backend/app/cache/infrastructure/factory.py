from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.cache.domain.protocols import CacheBackend, CacheEventRecorder
from app.cache.infrastructure.backends.memory import InMemoryCacheBackend
from app.cache.infrastructure.backends.pgvector import PgVectorCacheBackend
from app.cache.infrastructure.database import apply_migrations, create_database_pool
from app.core.config import Settings


@asynccontextmanager
async def cache_backend_lifespan(
    settings: Settings,
    *,
    dimensions: int,
    events: CacheEventRecorder | None = None,
) -> AsyncIterator[CacheBackend]:
    if settings.cache_backend == "memory":
        yield InMemoryCacheBackend(
            settings.max_cache_size,
            settings.cache_ttl_seconds,
            dimensions=dimensions,
            events=events,
        )
        return

    pool = await create_database_pool(settings)
    try:
        await apply_migrations(pool)
        yield PgVectorCacheBackend(
            pool,
            settings.max_cache_size,
            settings.cache_ttl_seconds,
            dimensions=dimensions,
            embedding_space=settings.embedding_space,
            events=events,
        )
    finally:
        await pool.close()
