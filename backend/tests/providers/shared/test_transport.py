import gzip
import logging
from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.exceptions import (
    InvalidProviderResponseError,
    ProviderAuthenticationError,
    ProviderRequestError,
    ProviderRetryableError,
)
from app.core.logging import RedactingJsonFormatter
from app.providers.shared.transport import post_json
from tests.providers.support import (
    mock_client,
    no_wait_retrying,
)


class TrackingStream(httpx.AsyncByteStream):
    def __init__(self, chunks: tuple[bytes, ...]) -> None:
        self._chunks = chunks
        self.chunks_read = 0
        self.closed = False

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self._chunks:
            self.chunks_read += 1
            yield chunk

    async def aclose(self) -> None:
        self.closed = True


def _json_body_with_size(size: int) -> bytes:
    prefix = b'{"value":"'
    suffix = b'"}'
    padding = size - len(prefix) - len(suffix)
    if padding < 0:
        raise ValueError("Requested JSON body size is too small")
    return prefix + (b"x" * padding) + suffix


@pytest.mark.asyncio
async def test_retries_rate_limit_then_succeeds() -> None:
    calls = 0

    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(
                429,
                request=request,
            )
        return httpx.Response(
            200,
            request=request,
            json={"ok": True},
        )

    result = await post_json(
        mock_client(handler),
        "https://api.example.test/resource",
        headers={"Authorization": "Bearer secret"},
        body={},
        retry_factory=no_wait_retrying,
    )

    assert result == {"ok": True}
    assert calls == 3


@pytest.mark.asyncio
async def test_server_errors_exhaust_retries() -> None:
    calls = 0

    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            503,
            request=request,
        )

    with pytest.raises(ProviderRetryableError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
        )

    assert calls == 3


@pytest.mark.asyncio
async def test_network_errors_exhaust_retries() -> None:
    calls = 0

    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ConnectError(
            "connection failed",
            request=request,
        )

    with pytest.raises(ProviderRetryableError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
        )

    assert calls == 3


@pytest.mark.asyncio
async def test_accepts_response_below_limit() -> None:
    limit = 64
    content = _json_body_with_size(limit - 1)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, content=content)

    result = await post_json(
        mock_client(handler),
        "https://api.example.test/resource",
        headers={},
        body={},
        retry_factory=no_wait_retrying,
        max_response_bytes=limit,
    )

    assert result == {"value": "x" * (limit - 1 - len(b'{"value":""}'))}


@pytest.mark.asyncio
async def test_accepts_response_exactly_at_limit() -> None:
    limit = 64
    content = _json_body_with_size(limit)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, content=content)

    result = await post_json(
        mock_client(handler),
        "https://api.example.test/resource",
        headers={},
        body={},
        retry_factory=no_wait_retrying,
        max_response_bytes=limit,
    )

    assert result == {"value": "x" * (limit - len(b'{"value":""}'))}


@pytest.mark.asyncio
async def test_rejects_declared_content_length_above_limit_without_reading() -> None:
    limit = 64
    stream = TrackingStream((b'{"ok":true}',))

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            headers={"Content-Length": str(limit + 1)},
            stream=stream,
        )

    with pytest.raises(InvalidProviderResponseError) as error:
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )

    assert stream.chunks_read == 0
    assert stream.closed
    assert error.value.error_code == "invalid_upstream_response"


@pytest.mark.asyncio
async def test_rejects_undeclared_oversized_response_while_streaming() -> None:
    limit = 64
    stream = TrackingStream((_json_body_with_size(limit + 1),))

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, stream=stream)

    with pytest.raises(InvalidProviderResponseError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )

    assert stream.chunks_read == 1
    assert stream.closed


@pytest.mark.asyncio
async def test_stops_reading_chunked_response_when_limit_is_crossed() -> None:
    limit = 16
    stream = TrackingStream(
        (
            b'{"value":"',
            b"x" * limit,
            b"y" * limit,
            b'"}',
        )
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            headers={"Transfer-Encoding": "chunked"},
            stream=stream,
        )

    with pytest.raises(InvalidProviderResponseError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )

    assert stream.chunks_read == 3
    assert stream.closed


@pytest.mark.asyncio
async def test_rejects_highly_compressed_response_without_reading() -> None:
    limit = 4 * 1024
    decoded = _json_body_with_size(1024 * 1024)
    compressed = gzip.compress(decoded)
    assert len(compressed) < limit < len(decoded)
    stream = TrackingStream((compressed,))

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Accept-Encoding"] == "identity"
        return httpx.Response(
            200,
            request=request,
            headers={
                "Content-Encoding": "gzip",
                "Content-Length": str(len(compressed)),
            },
            stream=stream,
        )

    with pytest.raises(InvalidProviderResponseError) as error:
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={"Accept-Encoding": "gzip"},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )

    assert stream.closed
    assert stream.chunks_read == 0
    assert error.value.error_code == "invalid_upstream_response"


@pytest.mark.asyncio
async def test_rejects_oversized_irrelevant_json_property() -> None:
    limit = 64
    content = b'{"ok":true,"ignored":"' + (b"x" * limit) + b'"}'

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, content=content)

    with pytest.raises(InvalidProviderResponseError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )


@pytest.mark.asyncio
async def test_oversized_response_is_not_retried() -> None:
    limit = 64
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            request=request,
            headers={"Content-Length": str(limit + 1)},
            stream=TrackingStream((b'{"ok":true}',)),
        )

    with pytest.raises(InvalidProviderResponseError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )

    assert calls == 1


@pytest.mark.asyncio
async def test_oversized_response_error_does_not_expose_body_or_secret(
    caplog: pytest.LogCaptureFixture,
) -> None:
    limit = 64
    secret = "provider-secret"
    content = f'{{"ignored":"{secret * limit}"}}'.encode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, content=content)

    with pytest.raises(InvalidProviderResponseError) as error:
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={"Authorization": f"Bearer {secret}"},
            body={},
            retry_factory=no_wait_retrying,
            max_response_bytes=limit,
        )

    assert secret not in str(error.value)
    assert secret not in caplog.text


@pytest.mark.asyncio
async def test_maps_authentication_error() -> None:
    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        return httpx.Response(
            401,
            request=request,
        )

    with pytest.raises(ProviderAuthenticationError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
        )


@pytest.mark.asyncio
async def test_rejects_malformed_json() -> None:
    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            text="not-json",
        )

    with pytest.raises(InvalidProviderResponseError):
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={},
            body={},
            retry_factory=no_wait_retrying,
        )


@pytest.mark.asyncio
async def test_provider_error_does_not_expose_secret() -> None:
    secret = "provider-secret"

    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        return httpx.Response(
            400,
            request=request,
            text=f"request rejected for {secret}",
        )

    with pytest.raises(
        ProviderRequestError,
    ) as error:
        await post_json(
            mock_client(handler),
            "https://api.example.test/resource",
            headers={
                "Authorization": f"Bearer {secret}",
            },
            body={},
            retry_factory=no_wait_retrying,
        )

    assert secret not in str(error.value)


def test_log_formatter_redacts_provider_secrets() -> None:
    secret = "provider-secret"
    record = logging.LogRecord(
        name="test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg=f"provider rejected {secret}",
        args=(),
        exc_info=None,
    )

    formatted = RedactingJsonFormatter(
        (secret,),
    ).format(record)

    assert secret not in formatted
    assert "[REDACTED]" in formatted
