from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request

from app.api.deps import get_semantic_cache
from app.cache.api.schemas import (
    CacheEntryListResponse,
    CacheEntryMetadata,
    CacheEntrySort,
    CacheStatsResponse,
    CacheThresholdRequest,
    CacheThresholdResponse,
    ClearCacheResponse,
    DeleteCacheEntryResponse,
)
from app.cache.application.service import SemanticCache
from app.cache.domain.namespaces import CacheNamespace
from app.core.config import get_settings
from app.core.limits import MAX_PROMPT_LENGTH
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])
SemanticCacheDependency = Annotated[SemanticCache, Depends(get_semantic_cache)]
CacheKeyPath = Annotated[str, Path(pattern=r"^[a-f0-9]{64}$")]
CacheNamespaceQuery = Annotated[CacheNamespace | None, Query()]


@router.get("/stats", response_model=CacheStatsResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def cache_stats(
    request: Request,
    cache: SemanticCacheDependency,
    namespace: CacheNamespaceQuery = None,
) -> CacheStatsResponse:
    return await cache.stats(namespace)


@router.get("/entries", response_model=CacheEntryListResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def list_cache_entries(
    request: Request,
    cache: SemanticCacheDependency,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    namespace: CacheNamespaceQuery = None,
    search: Annotated[str | None, Query(max_length=MAX_PROMPT_LENGTH)] = None,
    sort: Annotated[CacheEntrySort, Query()] = "newest",
) -> CacheEntryListResponse:
    return await cache.list_entries(
        offset=offset,
        limit=limit,
        namespace=namespace,
        search=search,
        sort=sort,
    )


@router.get("/entries/{cache_key}", response_model=CacheEntryMetadata)
@limiter.limit(lambda: get_settings().rate_limit)
async def get_cache_entry(
    request: Request,
    cache_key: CacheKeyPath,
    cache: SemanticCacheDependency,
) -> CacheEntryMetadata:
    return await cache.get_entry(cache_key)


@router.delete("/entries/{cache_key}", response_model=DeleteCacheEntryResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def delete_cache_entry(
    request: Request,
    cache_key: CacheKeyPath,
    cache: SemanticCacheDependency,
) -> DeleteCacheEntryResponse:
    await cache.delete_entry(cache_key)
    return DeleteCacheEntryResponse(deleted=True, cache_key=cache_key)


@router.delete("", response_model=ClearCacheResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def clear_cache(
    request: Request,
    cache: SemanticCacheDependency,
    namespace: CacheNamespaceQuery = None,
) -> ClearCacheResponse:
    await cache.clear(namespace)
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
