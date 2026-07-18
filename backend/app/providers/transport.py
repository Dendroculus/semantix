import json
from collections.abc import Callable, Mapping
from http import HTTPStatus
from typing import cast

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from app.core.exceptions import (
    InvalidProviderResponseError,
    ProviderAuthenticationError,
    ProviderRequestError,
    ProviderRetryableError,
)

RetryFactory = Callable[[], AsyncRetrying]


def create_retry_factory(
    *,
    attempts: int,
    multiplier_seconds: float,
    max_wait_seconds: float,
) -> RetryFactory:
    def retry_factory() -> AsyncRetrying:
        return AsyncRetrying(
            retry=retry_if_exception_type(
                ProviderRetryableError,
            ),
            stop=stop_after_attempt(attempts),
            wait=wait_random_exponential(
                multiplier=multiplier_seconds,
                max=max_wait_seconds,
            ),
            reraise=True,
        )

    return retry_factory


async def post_json(
    client: httpx.AsyncClient,
    endpoint: str,
    *,
    headers: Mapping[str, str],
    body: dict[str, object],
    retry_factory: RetryFactory,
) -> object:
    async for attempt in retry_factory():
        with attempt:
            return await _post_once(
                client,
                endpoint,
                headers=headers,
                body=body,
            )

    raise ProviderRetryableError("Retry policy ended")


async def _post_once(
    client: httpx.AsyncClient,
    endpoint: str,
    *,
    headers: Mapping[str, str],
    body: dict[str, object],
) -> object:
    try:
        response = await client.post(
            endpoint,
            headers=headers,
            json=body,
        )
    except httpx.RequestError as exc:
        raise ProviderRetryableError(
            "Network failure",
        ) from exc

    if (
        response.status_code == HTTPStatus.TOO_MANY_REQUESTS
        or response.status_code >= HTTPStatus.INTERNAL_SERVER_ERROR
    ):
        raise ProviderRetryableError(
            f"Retryable status {response.status_code}",
        )

    if response.status_code in {
        HTTPStatus.UNAUTHORIZED,
        HTTPStatus.FORBIDDEN,
    }:
        raise ProviderAuthenticationError(
            "Credentials rejected",
        )

    if response.status_code >= HTTPStatus.BAD_REQUEST:
        raise ProviderRequestError(
            f"Provider returned status {response.status_code}",
        )

    try:
        return cast(object, json.loads(response.text))
    except json.JSONDecodeError as exc:
        raise InvalidProviderResponseError(
            "Malformed JSON",
        ) from exc
