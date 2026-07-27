from fastapi import Request
from slowapi import Limiter

from app.core.config import Settings
from app.middleware.client_address import client_address


def app_rate_limit(key: str) -> str:
    return key.rsplit("|", maxsplit=1)[1]


def _app_scoped_client_address(request: Request) -> str:
    settings: Settings = request.app.state.settings
    scope: str = request.app.state.rate_limit_scope
    return f"{scope}|{client_address(request)}|{settings.rate_limit}"


limiter = Limiter(key_func=_app_scoped_client_address)
