from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    http_error_handler,
    rate_limit_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import configure_logging
from app.lifecycle import create_lifespan
from app.middleware.rate_limit import limiter

API_TITLE = "Semantic Cache API"
API_VERSION = "1.0.0"
CORS_ALLOWED_METHODS = ("GET", "POST", "PUT", "DELETE")
CORS_ALLOWED_HEADERS = ("Content-Type",)


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()

    configure_logging(
        resolved_settings.log_level,
        resolved_settings.configured_secrets(),
    )

    application = FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        lifespan=create_lifespan(resolved_settings),
    )

    _configure_middleware(application, resolved_settings)
    _register_exception_handlers(application)

    application.state.limiter = limiter
    application.include_router(api_router)

    return application


def _configure_middleware(
    application: FastAPI,
    settings: Settings,
) -> None:
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=CORS_ALLOWED_METHODS,
        allow_headers=CORS_ALLOWED_HEADERS,
    )


def _register_exception_handlers(application: FastAPI) -> None:
    application.add_exception_handler(AppError, app_error_handler)
    application.add_exception_handler(
        RequestValidationError,
        validation_error_handler,
    )
    application.add_exception_handler(
        RateLimitExceeded,
        rate_limit_error_handler,
    )
    application.add_exception_handler(HTTPException, http_error_handler)
    application.add_exception_handler(Exception, unhandled_error_handler)
