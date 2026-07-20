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
from app.security.auth import (
    AdminPrincipal,
    GlobalAdminPrincipal,
    ViewerPrincipal,
    ensure_namespace_access,
    resolve_namespace,
)

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])
SemanticCacheDependency = Annotated[SemanticCache, Depends(get_semantic_cache)]
CacheKeyPath = Annotated[str, Path(pattern=r"^[a-f0-9]{64}$")]
CacheNamespaceQuery = Annotated[CacheNamespace | None, Query()]


@router.get("/stats", response_model=CacheStatsResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def cache_stats(
    request: Request,
    cache: SemanticCacheDependency,
    principal: ViewerPrincipal,
    namespace: CacheNamespaceQuery = None,
) -> CacheStatsResponse:
    authorized_namespace = resolve_namespace(principal, namespace, allow_global=True)
    return await cache.stats(authorized_namespace)


@router.get("/entries", response_model=CacheEntryListResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def list_cache_entries(
    request: Request,
    cache: SemanticCacheDependency,
    principal: ViewerPrincipal,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    namespace: CacheNamespaceQuery = None,
    search: Annotated[str | None, Query(max_length=MAX_PROMPT_LENGTH)] = None,
    sort: Annotated[CacheEntrySort, Query()] = "newest",
) -> CacheEntryListResponse:
    authorized_namespace = resolve_namespace(principal, namespace, allow_global=True)
    return await cache.list_entries(
        offset=offset,
        limit=limit,
        namespace=authorized_namespace,
        search=search,
        sort=sort,
    )


@router.get("/entries/{cache_key}", response_model=CacheEntryMetadata)
@limiter.limit(lambda: get_settings().rate_limit)
async def get_cache_entry(
    request: Request,
    cache_key: CacheKeyPath,
    cache: SemanticCacheDependency,
    principal: ViewerPrincipal,
) -> CacheEntryMetadata:
    entry = await cache.get_entry(cache_key)
    ensure_namespace_access(principal, entry.namespace)
    return entry


@router.delete("/entries/{cache_key}", response_model=DeleteCacheEntryResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def delete_cache_entry(
    request: Request,
    cache_key: CacheKeyPath,
    cache: SemanticCacheDependency,
    principal: AdminPrincipal,
) -> DeleteCacheEntryResponse:
    if not principal.has_global_namespace_access:
        entry = await cache.get_entry(cache_key)
        ensure_namespace_access(principal, entry.namespace)
    await cache.delete_entry(cache_key)
    return DeleteCacheEntryResponse(deleted=True, cache_key=cache_key)


@router.delete("", response_model=ClearCacheResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def clear_cache(
    request: Request,
    cache: SemanticCacheDependency,
    principal: AdminPrincipal,
    namespace: CacheNamespaceQuery = None,
) -> ClearCacheResponse:
    authorized_namespace = resolve_namespace(principal, namespace, allow_global=True)
    await cache.clear(authorized_namespace)
    return ClearCacheResponse(cleared=True)


@router.get("/threshold", response_model=CacheThresholdResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def get_threshold(
    request: Request,
    cache: SemanticCacheDependency,
    principal: ViewerPrincipal,
) -> CacheThresholdResponse:
    return CacheThresholdResponse(threshold=cache.similarity_threshold)


@router.put("/threshold", response_model=CacheThresholdResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def update_threshold(
    request: Request,
    payload: CacheThresholdRequest,
    cache: SemanticCacheDependency,
    principal: GlobalAdminPrincipal,
) -> CacheThresholdResponse:
    threshold = cache.update_similarity_threshold(payload.threshold)
    return CacheThresholdResponse(threshold=threshold)
