from fastapi import APIRouter, Request

from app.api.schemas import HealthResponse
from app.core.config import get_settings
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        embedding_provider=request.app.state.embedding_provider_name,
        generation_provider=request.app.state.generation_provider_name,
    )
