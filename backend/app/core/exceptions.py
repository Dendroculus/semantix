import logging
from typing import cast

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = 500
    error_code = "internal_error"
    public_detail: str | None = None


class AuthenticationRequiredError(AppError):
    status_code, error_code, public_detail = (
        401,
        "authentication_required",
        "A valid bearer token is required.",
    )


class AuthorizationError(AppError):
    status_code, error_code, public_detail = (
        403,
        "forbidden",
        "The authenticated principal is not permitted to perform this operation.",
    )


class EmbeddingError(AppError):
    status_code, error_code, public_detail = (
        502,
        "embedding_error",
        "The embedding service returned an invalid result.",
    )


class CacheStorageError(AppError):
    status_code, error_code, public_detail = (
        500,
        "cache_error",
        "The cache could not process the request.",
    )


class CacheEntryNotFoundError(AppError):
    status_code, error_code, public_detail = (
        404,
        "cache_entry_not_found",
        "The requested cache entry does not exist or has expired.",
    )


class ProviderRetryableError(AppError):
    status_code, error_code, public_detail = (
        503,
        "service_unavailable",
        "The AI service is temporarily unavailable.",
    )


class ProviderAuthenticationError(AppError):
    status_code, error_code, public_detail = (
        503,
        "service_configuration_error",
        "The AI service is temporarily unavailable.",
    )


class ProviderRequestError(AppError):
    status_code, error_code, public_detail = (
        502,
        "upstream_error",
        "The AI service could not process the request.",
    )


class InvalidProviderResponseError(AppError):
    status_code, error_code, public_detail = (
        502,
        "invalid_upstream_response",
        "The AI service returned an invalid response.",
    )


def _response(status: int, error: str, detail: str | None) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
    return JSONResponse(
        status_code=status,
        content={"error": error, "detail": detail},
        headers=headers,
    )


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = cast(AppError, exc)
    logger.warning(
        "Application error type=%s path=%s", type(error).__name__, request.url.path
    )
    return _response(error.status_code, error.error_code, error.public_detail)


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = cast(RequestValidationError, exc)
    locations = {".".join(str(part) for part in item["loc"]) for item in error.errors()}
    return _response(
        422, "validation_error", "Invalid field: " + ", ".join(sorted(locations))
    )


async def rate_limit_error_handler(request: Request, exc: Exception) -> JSONResponse:
    cast(RateLimitExceeded, exc)
    return _response(
        429, "rate_limit_exceeded", "Too many requests. Please try again later."
    )


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = cast(HTTPException, exc)
    return _response(
        error.status_code,
        "http_error",
        error.detail if isinstance(error.detail, str) else None,
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled error path=%s type=%s", request.url.path, type(exc).__name__
    )
    return _response(500, "internal_error", None)
