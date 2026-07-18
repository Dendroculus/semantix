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


@pytest.mark.asyncio
async def test_explains_cache_miss_and_hit() -> None:
    provider = Provider()
    service = QueryService(
        SemanticCache(
            Embeddings(),
            memory_backend(),
            0.92,
        ),
        provider,
    )

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
