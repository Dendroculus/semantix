import asyncio
from collections.abc import Sequence

import pytest

from app.cache.keys import prompt_cache_key
from app.cache.service import SemanticCache
from app.query.service import QueryService
from tests.support import memory_backend, unit_vector


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return unit_vector()


class Provider:
    def __init__(self) -> None:
        self.call_count = 0

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        return "answer"


class ControlledProvider:
    def __init__(
        self,
        *,
        expected_calls: int = 1,
        failures_remaining: int = 0,
    ) -> None:
        self.call_count = 0
        self.prompts: list[str] = []
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self._expected_calls = expected_calls
        self._failures_remaining = failures_remaining

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        self.prompts.append(prompt)
        if self.call_count >= self._expected_calls:
            self.started.set()

        await self.release.wait()
        if self._failures_remaining:
            self._failures_remaining -= 1
            raise RuntimeError("generation failed")
        return f"answer:{prompt}"


def query_service(provider: Provider | ControlledProvider) -> QueryService:
    return QueryService(
        SemanticCache(
            Embeddings(),
            memory_backend(),
            0.92,
        ),
        provider,
    )


@pytest.mark.asyncio
async def test_explains_cache_miss_and_hit() -> None:
    provider = Provider()
    service = query_service(provider)

    miss = await service.execute("one")
    assert miss.cache_hit is False
    assert miss.similarity_score is None
    assert miss.similarity_threshold == pytest.approx(0.92)
    assert miss.matched_prompt is None
    assert miss.matched_cache_key is None
    assert miss.cache_entry_created_at is None
    assert miss.cache_entry_age_seconds is None
    assert miss.generation_skipped is False
    assert miss.provider_called is True
    assert provider.call_count == 1

    provider.call_count = 0
    hit = await service.execute("similar")

    assert hit.cache_hit is True
    assert hit.similarity_score == pytest.approx(1.0)
    assert hit.similarity_threshold == pytest.approx(0.92)
    assert hit.matched_prompt == "one"
    assert hit.matched_cache_key == prompt_cache_key("one")
    assert hit.cache_entry_created_at is not None
    assert hit.cache_entry_created_at.utcoffset() is not None
    assert hit.cache_entry_age_seconds is not None
    assert hit.cache_entry_age_seconds >= 0
    assert hit.generation_skipped is True
    assert hit.provider_called is False
    assert provider.call_count == 0


@pytest.mark.asyncio
async def test_coalesces_twenty_simultaneous_identical_misses() -> None:
    provider = ControlledProvider()
    service = query_service(provider)
    requests = [asyncio.create_task(service.execute("same prompt")) for _ in range(20)]

    await asyncio.wait_for(provider.started.wait(), timeout=1)
    provider.release.set()
    responses = await asyncio.gather(*requests)

    assert provider.call_count == 1
    assert {response.response for response in responses} == {"answer:same prompt"}
    assert sum(response.provider_called for response in responses) == 1
    assert sum(response.generation_skipped for response in responses) == 19
    assert all(not response.cache_hit for response in responses)


@pytest.mark.asyncio
async def test_failed_generation_is_removed_before_retry() -> None:
    provider = ControlledProvider(failures_remaining=1)
    service = query_service(provider)
    provider.release.set()

    with pytest.raises(RuntimeError, match="generation failed"):
        await service.execute("retry prompt")

    response = await service.execute("retry prompt")

    assert response.response == "answer:retry prompt"
    assert response.provider_called is True
    assert provider.call_count == 2


@pytest.mark.asyncio
async def test_different_prompts_do_not_share_in_flight_generation() -> None:
    provider = ControlledProvider(expected_calls=2)
    service = query_service(provider)
    requests = [
        asyncio.create_task(service.execute(prompt))
        for prompt in ("first prompt", "second prompt")
    ]

    await asyncio.wait_for(provider.started.wait(), timeout=1)
    provider.release.set()
    responses = await asyncio.gather(*requests)

    assert provider.call_count == 2
    assert set(provider.prompts) == {"first prompt", "second prompt"}
    assert {response.response for response in responses} == {
        "answer:first prompt",
        "answer:second prompt",
    }
    assert all(response.provider_called for response in responses)
