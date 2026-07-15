from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Protocol

from app.models.schemas import CacheEntry, CacheLookupResult, CacheStatsResponse
from app.services.cache_backend import CacheBackend, prompt_cache_key


class EmbeddingGenerator(Protocol):
    async def embed(self, text: str) -> Sequence[float]:
        ...


class SemanticCache:
    def __init__(
        self,
        embedding_service: EmbeddingGenerator,
        backend: CacheBackend,
        similarity_threshold: float,
    ) -> None:
        if not 0 <= similarity_threshold <= 1:
            raise ValueError("similarity_threshold must be between 0 and 1")
        self._embedding_service = embedding_service
        self._backend = backend
        self._similarity_threshold = similarity_threshold

    async def lookup(self, prompt: str) -> CacheLookupResult:
        embedding = [float(value) for value in await self._embedding_service.embed(prompt)]
        candidate = await self._backend.find_nearest(embedding)
        if candidate is not None and candidate.similarity_score >= self._similarity_threshold:
            if await self._backend.record_hit(candidate.entry.cache_key):
                return CacheLookupResult(
                    cache_hit=True,
                    response=candidate.entry.response,
                    similarity_score=candidate.similarity_score,
                    embedding=embedding,
                )

        await self._backend.record_miss()
        return CacheLookupResult(
            cache_hit=False,
            response=None,
            similarity_score=None if candidate is None else candidate.similarity_score,
            embedding=embedding,
        )

    async def store(self, prompt: str, response: str, embedding: Sequence[float]) -> None:
        await self._backend.put(
            CacheEntry(
                cache_key=prompt_cache_key(prompt),
                prompt=prompt,
                response=response,
                embedding=[float(value) for value in embedding],
                created_at=datetime.now(UTC),
            )
        )

    async def clear(self) -> None:
        await self._backend.clear()

    async def stats(self) -> CacheStatsResponse:
        return await self._backend.stats()
