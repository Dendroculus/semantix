from fastapi import APIRouter, Request
from app.core.config import get_settings
from app.core.schemas import HealthResponse
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok")
