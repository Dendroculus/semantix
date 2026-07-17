from collections.abc import Callable
import httpx
import pytest
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_none,
)
from app.core.exceptions import InvalidProviderResponseError, ProviderRetryableError
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.huggingface_service import HuggingFaceService


def retrying() -> AsyncRetrying:
    return AsyncRetrying(
        retry=retry_if_exception_type(ProviderRetryableError),
        stop=stop_after_attempt(3),
        wait=wait_none(),
        reraise=True,
    )


def service(handler: Callable[[httpx.Request], httpx.Response]) -> HuggingFaceService:
    return HuggingFaceService(
        httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        "test",
        "https://example.test",
        "embed",
        "generate",
        32,
        retrying,
    )


@pytest.mark.asyncio
async def test_retries_then_succeeds() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return (
            httpx.Response(503, request=request)
            if calls < 3
            else httpx.Response(
                200, request=request, json=[[1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)]
            )
        )

    assert len(await service(handler).create_embedding("x")) == EMBEDDING_DIMENSIONS
    assert calls == 3


@pytest.mark.asyncio
async def test_generation() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json={"choices": [{"message": {"content": "answer"}}]},
        )

    assert await service(handler).generate("x") == "answer"


@pytest.mark.asyncio
async def test_malformed_embedding() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, json={})

    with pytest.raises(InvalidProviderResponseError):
        await service(handler).create_embedding("x")
