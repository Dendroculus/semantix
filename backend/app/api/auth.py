from fastapi import APIRouter, Request

from app.api.schemas import AuthConfigResponse, AuthSessionResponse
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.security.auth import PrincipalDependency

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.get("/config", response_model=AuthConfigResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def auth_config(request: Request) -> AuthConfigResponse:
    return AuthConfigResponse(
        authentication_required=request.app.state.settings.auth_mode == "token"
    )


@router.get("/session", response_model=AuthSessionResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def auth_session(
    request: Request,
    principal: PrincipalDependency,
) -> AuthSessionResponse:
    return AuthSessionResponse(
        name=principal.name,
        role=principal.role,
        namespaces=sorted(principal.namespaces),
    )
