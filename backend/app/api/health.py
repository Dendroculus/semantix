from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app.api.schemas import HealthResponse, ReadinessResponse
from app.core.exceptions import CacheStorageError

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        embedding_provider=request.app.state.embedding_provider_name,
        generation_provider=request.app.state.generation_provider_name,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Not ready"}},
)
async def ready(request: Request) -> ReadinessResponse | JSONResponse:
    try:
        await request.app.state.semantic_cache.stats()
    except CacheStorageError:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "not_ready",
                "detail": "A required cache dependency is unavailable.",
            },
        )
    return ReadinessResponse(
        status="ready",
        cache_backend=request.app.state.settings.cache_backend,
    )
