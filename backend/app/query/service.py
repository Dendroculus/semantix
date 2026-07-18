import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from time import perf_counter

from app.cache.keys import prompt_cache_key
from app.cache.models import CacheLookupResult
from app.cache.service import SemanticCache
from app.providers.protocols import GenerationProvider
from app.query.coalescing import RequestCoalescer
from app.query.schemas import QueryResponse

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class _QueryResolution:
    lookup: CacheLookupResult
    response: str


class QueryService:
    def __init__(
        self,
        cache: SemanticCache,
        generation_provider: GenerationProvider,
    ) -> None:
        self._cache = cache
        self._generation_provider = generation_provider
        self._coalescer: RequestCoalescer[_QueryResolution] = RequestCoalescer()

    async def execute(self, prompt: str) -> QueryResponse:
        started_at = perf_counter()
        coalesced = await self._coalescer.run(
            prompt_cache_key(prompt),
            lambda: self._resolve(prompt),
        )
        resolution = coalesced.value
        lookup = resolution.lookup
        provider_called = not lookup.cache_hit and coalesced.is_leader

        latency_ms = (perf_counter() - started_at) * 1_000
        logger.info(
            (
                "Query completed cache_hit=%s provider_called=%s "
                "coalesced=%s latency_ms=%.2f"
            ),
            lookup.cache_hit,
            provider_called,
            not coalesced.is_leader,
            latency_ms,
        )
        return QueryResponse(
            response=resolution.response,
            cache_hit=lookup.cache_hit,
            similarity_score=lookup.similarity_score,
            similarity_threshold=lookup.similarity_threshold,
            matched_prompt=lookup.matched_prompt,
            matched_cache_key=lookup.matched_cache_key,
            cache_entry_created_at=lookup.cache_entry_created_at,
            cache_entry_age_seconds=self._entry_age_seconds(
                lookup.cache_entry_created_at
            ),
            generation_skipped=not provider_called,
            provider_called=provider_called,
            latency_ms=latency_ms,
        )

    async def _resolve(self, prompt: str) -> _QueryResolution:
        lookup = await self._cache.lookup(prompt)
        if lookup.cache_hit:
            if lookup.response is None:
                raise RuntimeError("Validated cache hit had no response")
            return _QueryResolution(lookup=lookup, response=lookup.response)

        response = await self._generation_provider.generate(prompt)
        await self._cache.store(
            prompt,
            response,
            lookup.embedding,
        )
        return _QueryResolution(lookup=lookup, response=response)

    @staticmethod
    def _entry_age_seconds(
        created_at: datetime | None,
    ) -> float | None:
        if created_at is None:
            return None
        return max(
            0.0,
            (datetime.now(UTC) - created_at).total_seconds(),
        )
