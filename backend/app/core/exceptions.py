import logging
from typing import cast

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.models.schemas import ErrorResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = 500
    error_code = "internal_error"
    public_detail: str | None = None


class EmbeddingError(AppError):
    status_code = 502
    error_code = "embedding_error"
    public_detail = "The embedding service returned an invalid result."


class CacheStorageError(AppError):
    status_code = 500
    error_code = "cache_error"
    public_detail = "The cache could not process the request."


class ProviderRetryableError(AppError):
    status_code = 503
    error_code = "service_unavailable"
    public_detail = "The AI service is temporarily unavailable."


class ProviderAuthenticationError(AppError):
    status_code = 503
    error_code = "service_configuration_error"
    public_detail = "The AI service is temporarily unavailable."


class ProviderRequestError(AppError):
    status_code = 502
    error_code = "upstream_error"
    public_detail = "The AI service could not process the request."


class InvalidProviderResponseError(AppError):
    status_code = 502
    error_code = "invalid_upstream_response"
    public_detail = "The AI service returned an invalid response."


def _response(status_code: int, error: str, detail: str | None) -> JSONResponse:
    payload = ErrorResponse(error=error, detail=detail)
    return JSONResponse(status_code=status_code, content=payload.model_dump())


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = cast(AppError, exc)
    logger.warning("Application error type=%s path=%s", type(error).__name__, request.url.path)
    return _response(error.status_code, error.error_code, error.public_detail)


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = cast(RequestValidationError, exc)
    locations = {".".join(str(part) for part in item["loc"]) for item in error.errors()}
    detail = "Invalid field: " + ", ".join(sorted(locations)) if locations else "Request validation failed."
    return _response(422, "validation_error", detail)


async def rate_limit_error_handler(request: Request, exc: Exception) -> JSONResponse:
    cast(RateLimitExceeded, exc)
    return _response(429, "rate_limit_exceeded", "Too many requests. Please try again later.")


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = cast(HTTPException, exc)
    detail = error.detail if isinstance(error.detail, str) else None
    return _response(error.status_code, "http_error", detail)


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error path=%s type=%s", request.url.path, type(exc).__name__)
    return _response(500, "internal_error", None)
