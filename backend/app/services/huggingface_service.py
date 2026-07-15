import json
from collections.abc import Callable, Sequence
from typing import cast
from urllib.parse import quote

import httpx
import numpy as np
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_random_exponential

from app.core.exceptions import (
    InvalidProviderResponseError,
    ProviderAuthenticationError,
    ProviderRequestError,
    ProviderRetryableError,
)
from app.models.schemas import EMBEDDING_DIMENSIONS

RetryFactory = Callable[[], AsyncRetrying]


def default_retry_factory() -> AsyncRetrying:
    return AsyncRetrying(
        retry=retry_if_exception_type(ProviderRetryableError),
        stop=stop_after_attempt(3),
        wait=wait_random_exponential(multiplier=0.5, max=4),
        reraise=True,
    )


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _as_vector(value: object) -> list[float] | None:
    if not isinstance(value, list) or len(value) != EMBEDDING_DIMENSIONS:
        return None
    if not all(_is_number(component) for component in value):
        return None
    return [float(cast(int | float, component)) for component in value]


def _as_embedding_rows(value: object) -> list[list[float]] | None:
    direct = _as_vector(value)
    if direct is not None:
        return [direct]
    if not isinstance(value, list) or not value:
        return None
    if len(value) == 1:
        nested = _as_embedding_rows(value[0])
        if nested is not None:
            return nested
    rows: list[list[float]] = []
    for item in value:
        row = _as_vector(item)
        if row is None:
            return None
        rows.append(row)
    return rows or None


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
    ) -> None:
        self._client = client
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._embedding_model = embedding_model
        self._generation_model = generation_model
        self._max_new_tokens = max_new_tokens
        self._retry_factory = retry_factory

    async def create_embedding(self, text: str) -> Sequence[float]:
        payload = await self._post_json(
            self._embedding_model,
            {"inputs": text, "options": {"wait_for_model": True}},
        )
        rows = _as_embedding_rows(payload)
        if rows is None:
            raise InvalidProviderResponseError("HF embedding response had an unsupported shape")
        pooled = np.mean(np.asarray(rows, dtype=np.float64), axis=0)
        if pooled.shape != (EMBEDDING_DIMENSIONS,):
            raise InvalidProviderResponseError("HF embedding response had invalid dimensions")
        return [float(component) for component in pooled]

    async def generate(self, prompt: str) -> str:
        payload = await self._post_json(
            self._generation_model,
            {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": self._max_new_tokens,
                    "return_full_text": False,
                },
                "options": {"wait_for_model": True},
            },
        )
        generated_text = self._extract_generated_text(payload).strip()
        if not generated_text:
            raise InvalidProviderResponseError("HF generation response was empty")
        return generated_text

    async def _post_json(self, model: str, body: dict[str, object]) -> object:
        async for attempt in self._retry_factory():
            with attempt:
                return await self._post_once(model, body)
        raise ProviderRetryableError("HF retry policy ended unexpectedly")

    async def _post_once(self, model: str, body: dict[str, object]) -> object:
        url = f"{self._base_url}/{quote(model, safe='/')}"
        try:
            response = await self._client.post(
                url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        except httpx.RequestError as exc:
            raise ProviderRetryableError("Network failure while calling Hugging Face") from exc

        if response.status_code == 429 or response.status_code >= 500:
            raise ProviderRetryableError(f"Hugging Face returned retryable status {response.status_code}")
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError("Hugging Face rejected the configured credentials")
        if response.status_code >= 400:
            raise ProviderRequestError(f"Hugging Face returned status {response.status_code}")

        try:
            return cast(object, json.loads(response.text))
        except json.JSONDecodeError as exc:
            raise InvalidProviderResponseError("Hugging Face returned malformed JSON") from exc

    @staticmethod
    def _extract_generated_text(payload: object) -> str:
        if isinstance(payload, dict):
            value = cast(object, payload.get("generated_text"))
            if isinstance(value, str):
                return value
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            value = cast(object, payload[0].get("generated_text"))
            if isinstance(value, str):
                return value
        raise InvalidProviderResponseError("HF generation response did not contain generated_text")
