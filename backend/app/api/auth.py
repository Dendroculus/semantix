from fastapi import APIRouter, Request

from app.api.schemas import AuthConfigResponse, AuthSessionResponse
from app.middleware.rate_limit import app_rate_limit, limiter
from app.security.auth import PrincipalDependency

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.get("/config", response_model=AuthConfigResponse)
@limiter.limit(app_rate_limit)
async def auth_config(request: Request) -> AuthConfigResponse:
    return AuthConfigResponse(
        authentication_required=request.app.state.settings.auth_mode == "token"
    )


@router.get("/session", response_model=AuthSessionResponse)
@limiter.limit(app_rate_limit)
async def auth_session(
    request: Request,
    principal: PrincipalDependency,
) -> AuthSessionResponse:
    return AuthSessionResponse(
        name=principal.name,
        role=principal.role,
        namespaces=sorted(principal.namespaces),
    )
