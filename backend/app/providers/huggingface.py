import json
from collections.abc import Callable, Sequence
from typing import cast
from urllib.parse import quote
import httpx
import numpy as np
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
from app.core.schemas import EMBEDDING_DIMENSIONS

RetryFactory = Callable[[], AsyncRetrying]


def default_retry_factory() -> AsyncRetrying:
    return AsyncRetrying(
        retry=retry_if_exception_type(ProviderRetryableError),
        stop=stop_after_attempt(3),
        wait=wait_random_exponential(multiplier=0.5, max=4),
        reraise=True,
    )


def _vector(value: object) -> list[float] | None:
    if (
        not isinstance(value, list)
        or len(value) != EMBEDDING_DIMENSIONS
        or not all(
            isinstance(v, (int, float)) and not isinstance(v, bool) for v in value
        )
    ):
        return None
    return [float(cast(int | float, v)) for v in value]


def _rows(value: object) -> list[list[float]] | None:
    direct = _vector(value)
    if direct is not None:
        return [direct]
    if not isinstance(value, list) or not value:
        return None
    if len(value) == 1:
        nested = _rows(value[0])
        if nested is not None:
            return nested
    result = []
    for item in value:
        row = _vector(item)
        if row is None:
            return None
        result.append(row)
    return result or None


class HuggingFaceService:
    def __init__(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        base_url: str,
        embedding_model: str,
        generation_model: str,
        max_new_tokens: int,
        retry_factory: RetryFactory = default_retry_factory,
        chat_base_url: str = "https://router.huggingface.co/v1",
    ) -> None:
        self._client = client
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._chat_base_url = chat_base_url.rstrip("/")
        self._embedding_model = embedding_model
        self._generation_model = generation_model
        self._max_new_tokens = max_new_tokens
        self._retry_factory = retry_factory

    async def create_embedding(self, text: str) -> Sequence[float]:
        model_path = quote(self._embedding_model, safe="/")
        endpoint = f"{self._base_url}/{model_path}/pipeline/feature-extraction"

        payload = await self._post(
            endpoint,
            {
                "inputs": [text],
                "normalize": True,
            },
        )

        rows = _rows(payload)

        if rows is None:
            raise InvalidProviderResponseError(
                "Invalid embedding shape",
            )

        vector = np.mean(
            np.asarray(rows, dtype=np.float64),
            axis=0,
        )

        if vector.shape != (EMBEDDING_DIMENSIONS,) or not np.isfinite(vector).all():
            raise InvalidProviderResponseError(
                "Invalid embedding vector",
            )

        return [float(component) for component in vector]

    async def generate(self, prompt: str) -> str:
        endpoint = f"{self._chat_base_url}/chat/completions"

        payload = await self._post(
            endpoint,
            {
                "model": self._generation_model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                "max_tokens": self._max_new_tokens,
                "stream": False,
            },
        )

        if not isinstance(payload, dict):
            raise InvalidProviderResponseError(
                "Invalid chat-completion response",
            )

        choices = payload.get("choices")

        if not isinstance(choices, list) or not choices:
            raise InvalidProviderResponseError(
                "Chat response contained no choices",
            )

        first_choice = choices[0]

        if not isinstance(first_choice, dict):
            raise InvalidProviderResponseError(
                "Invalid chat choice",
            )

        message = first_choice.get("message")

        if not isinstance(message, dict):
            raise InvalidProviderResponseError(
                "Chat response contained no message",
            )

        content = message.get("content")

        if not isinstance(content, str) or not content.strip():
            raise InvalidProviderResponseError(
                "Chat response contained no text",
            )

        return content.strip()

    async def _post(
        self,
        endpoint: str,
        body: dict[str, object],
    ) -> object:
        async for attempt in self._retry_factory():
            with attempt:
                return await self._once(endpoint, body)

        raise ProviderRetryableError(
            "Retry policy ended",
        )

    async def _once(
        self,
        endpoint: str,
        body: dict[str, object],
    ) -> object:
        try:
            response = await self._client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        except httpx.RequestError as exc:
            raise ProviderRetryableError(
                "Network failure",
            ) from exc

        if response.status_code == 429 or response.status_code >= 500:
            raise ProviderRetryableError(
                f"Retryable status {response.status_code}",
            )

        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(
                "Credentials rejected",
            )

        if response.status_code >= 400:
            detail = response.text.strip().replace("\n", " ")[:300]

            raise ProviderRequestError(
                f"Provider status {response.status_code}: "
                f"{detail or 'No response detail'}",
            )

        try:
            return cast(object, json.loads(response.text))
        except json.JSONDecodeError as exc:
            raise InvalidProviderResponseError(
                "Malformed JSON",
            ) from exc
