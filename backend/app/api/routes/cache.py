from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_semantic_cache
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.models.schemas import (
    CacheStatsResponse,
    CacheThresholdRequest,
    CacheThresholdResponse,
    ClearCacheResponse,
)
from app.services.cache_service import SemanticCache

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])
SemanticCacheDependency = Annotated[SemanticCache, Depends(get_semantic_cache)]


@router.get("/stats", response_model=CacheStatsResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def cache_stats(
    request: Request,
    cache: SemanticCacheDependency,
) -> CacheStatsResponse:
    return await cache.stats()


@router.delete("", response_model=ClearCacheResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def clear_cache(
    request: Request,
    cache: SemanticCacheDependency,
) -> ClearCacheResponse:
    await cache.clear()
    return ClearCacheResponse(cleared=True)


@router.get("/threshold", response_model=CacheThresholdResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def get_threshold(
    request: Request,
    cache: SemanticCacheDependency,
) -> CacheThresholdResponse:
    return CacheThresholdResponse(threshold=cache.similarity_threshold)


@router.put("/threshold", response_model=CacheThresholdResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def update_threshold(
    request: Request,
    payload: CacheThresholdRequest,
    cache: SemanticCacheDependency,
) -> CacheThresholdResponse:
    threshold = cache.update_similarity_threshold(payload.threshold)
    return CacheThresholdResponse(threshold=threshold)
