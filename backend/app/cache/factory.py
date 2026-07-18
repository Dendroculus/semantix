from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.cache.backends.memory import InMemoryCacheBackend
from app.cache.backends.pgvector import PgVectorCacheBackend
from app.cache.database import apply_migrations, create_database_pool
from app.cache.protocols import CacheBackend
from app.core.config import Settings


@asynccontextmanager
async def cache_backend_lifespan(
    settings: Settings,
    *,
    dimensions: int,
) -> AsyncIterator[CacheBackend]:
    if settings.cache_backend == "memory":
        yield InMemoryCacheBackend(
            settings.max_cache_size,
            settings.cache_ttl_seconds,
            dimensions=dimensions,
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
        )
    finally:
        await pool.close()
