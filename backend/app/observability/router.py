from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_runtime_metrics, get_semantic_cache
from app.cache.application.service import SemanticCache
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.observability.metrics import RuntimeMetrics
from app.observability.schemas import MetricsResponse
from app.security.auth import ViewerPrincipal

router = APIRouter(prefix="/api/v1", tags=["observability"])
MetricsDependency = Annotated[RuntimeMetrics, Depends(get_runtime_metrics)]
CacheDependency = Annotated[SemanticCache, Depends(get_semantic_cache)]


@router.get("/metrics", response_model=MetricsResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def metrics(
    request: Request,
    runtime_metrics: MetricsDependency,
    cache: CacheDependency,
    principal: ViewerPrincipal,
) -> MetricsResponse:
    cache_stats = await cache.stats()
    return MetricsResponse.from_snapshot(
        runtime_metrics.snapshot(cache_size=cache_stats.size)
    )
