from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_semantic_cache
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.models.schemas import CacheStatsResponse, ClearCacheResponse
from app.services.cache_service import SemanticCache

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])


@router.get("/stats", response_model=CacheStatsResponse)
@limiter.limit(lambda: get_settings().rate_limit)  # type: ignore[untyped-decorator]
async def cache_stats(
    request: Request,
    cache: Annotated[SemanticCache, Depends(get_semantic_cache)],
) -> CacheStatsResponse:
    return await cache.stats()


@router.delete("", response_model=ClearCacheResponse)
@limiter.limit(lambda: get_settings().rate_limit)  # type: ignore[untyped-decorator]
async def clear_cache(
    request: Request,
    cache: Annotated[SemanticCache, Depends(get_semantic_cache)],
) -> ClearCacheResponse:
    await cache.clear()
    return ClearCacheResponse(cleared=True)
