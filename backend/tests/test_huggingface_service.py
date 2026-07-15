from collections.abc import Callable

import httpx
import pytest
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_none

from app.core.exceptions import InvalidProviderResponseError, ProviderRetryableError
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.huggingface_service import HuggingFaceService


def immediate_retry_factory() -> AsyncRetrying:
    return AsyncRetrying(
        retry=retry_if_exception_type(ProviderRetryableError),
        stop=stop_after_attempt(3),
        wait=wait_none(),
        reraise=True,
    )


def make_service(handler: Callable[[httpx.Request], httpx.Response]) -> HuggingFaceService:
    return HuggingFaceService(
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        api_key="test-placeholder",
        base_url="https://example.test/models",
        embedding_model="embedding-model",
        generation_model="generation-model",
        max_new_tokens=32,
        retry_factory=immediate_retry_factory,
    )


@pytest.mark.asyncio
async def test_retries_5xx_then_succeeds() -> None:
    calls = 0
    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(503, request=request)
        return httpx.Response(
            200,
            request=request,
            json=[[1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)],
        )
    embedding = await make_service(handler).create_embedding("hello")
    assert calls == 3
    assert len(embedding) == EMBEDDING_DIMENSIONS


@pytest.mark.asyncio
async def test_parses_generation_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, json=[{"generated_text": "Generated answer"}])
    assert await make_service(handler).generate("Question") == "Generated answer"


@pytest.mark.asyncio
async def test_rejects_malformed_embedding() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, json={"unexpected": True})
    with pytest.raises(InvalidProviderResponseError):
        await make_service(handler).create_embedding("hello")
