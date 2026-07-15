from fastapi import APIRouter, Request
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
@limiter.limit(lambda: get_settings().rate_limit)  # type: ignore[untyped-decorator]
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok")
