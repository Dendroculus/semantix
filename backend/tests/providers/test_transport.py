import logging

import httpx
import pytest

from app.core.exceptions import (
    InvalidProviderResponseError,
    ProviderAuthenticationError,
    ProviderRequestError,
    ProviderRetryableError,
)
from app.providers.transport import post_json
from app.core.logging import RedactingJsonFormatter
from tests.providers.support import (
    mock_client,
    no_wait_retrying,
)


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
