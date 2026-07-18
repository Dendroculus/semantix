import logging
from datetime import UTC, datetime
from time import perf_counter

from app.cache.service import SemanticCache
from app.providers.protocols import GenerationProvider
from app.query.schemas import QueryResponse

logger = logging.getLogger(__name__)


class QueryService:
    def __init__(
        self,
        cache: SemanticCache,
        generation_provider: GenerationProvider,
    ) -> None:
        self._cache = cache
        self._generation_provider = generation_provider

    async def execute(self, prompt: str) -> QueryResponse:
        started_at = perf_counter()
        lookup = await self._cache.lookup(prompt)

        if lookup.cache_hit:
            if lookup.response is None:
                raise RuntimeError("Validated cache hit had no response")
            response_text = lookup.response
        else:
            response_text = await self._generation_provider.generate(prompt)
            await self._cache.store(
                prompt,
                response_text,
                lookup.embedding,
            )

        latency_ms = (perf_counter() - started_at) * 1_000
        logger.info(
            "Query completed cache_hit=%s provider_called=%s latency_ms=%.2f",
            lookup.cache_hit,
            not lookup.cache_hit,
            latency_ms,
        )
        return QueryResponse(
            response=response_text,
            cache_hit=lookup.cache_hit,
            similarity_score=lookup.similarity_score,
            similarity_threshold=lookup.similarity_threshold,
            matched_prompt=lookup.matched_prompt,
            matched_cache_key=lookup.matched_cache_key,
            cache_entry_created_at=lookup.cache_entry_created_at,
            cache_entry_age_seconds=self._entry_age_seconds(
                lookup.cache_entry_created_at
            ),
            generation_skipped=lookup.cache_hit,
            provider_called=not lookup.cache_hit,
            latency_ms=latency_ms,
        )

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
