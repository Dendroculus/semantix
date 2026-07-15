import logging
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_huggingface_service, get_semantic_cache
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.models.schemas import QueryRequest, QueryResponse
from app.services.cache_service import SemanticCache
from app.services.huggingface_service import HuggingFaceService

router = APIRouter(prefix="/api/v1", tags=["query"])
logger = logging.getLogger(__name__)


@router.post("/query", response_model=QueryResponse)
@limiter.limit(lambda: get_settings().rate_limit)  # type: ignore[untyped-decorator]
async def query(
    request: Request,
    payload: QueryRequest,
    cache: Annotated[SemanticCache, Depends(get_semantic_cache)],
    provider: Annotated[HuggingFaceService, Depends(get_huggingface_service)],
) -> QueryResponse:
    started_at = perf_counter()
    lookup = await cache.lookup(payload.prompt)

    if lookup.cache_hit:
        if lookup.response is None:
            raise RuntimeError("Validated cache hit had no response")
        response_text = lookup.response
    else:
        response_text = await provider.generate(payload.prompt)
        await cache.store(payload.prompt, response_text, lookup.embedding)

    latency_ms = (perf_counter() - started_at) * 1_000
    logger.info(
        "Query completed cache_hit=%s latency_ms=%.2f",
        lookup.cache_hit,
        latency_ms,
    )
    return QueryResponse(
        response=response_text,
        cache_hit=lookup.cache_hit,
        similarity_score=lookup.similarity_score,
        latency_ms=latency_ms,
    )
