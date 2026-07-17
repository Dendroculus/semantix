import asyncio
import hashlib
import time
from collections import OrderedDict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

import numpy as np
from numpy.typing import NDArray

from app.core.exceptions import CacheStorageError
from app.models.schemas import (
    CacheCandidate,
    CacheEntry,
    CacheEntryListResponse,
    CacheEntryMetadata,
    CacheEntrySort,
    CacheStatsResponse,
    EMBEDDING_DIMENSIONS,
    MAX_RESPONSE_PREVIEW_LENGTH,
)


class CacheBackend(Protocol):
    async def find_nearest(
        self, embedding: Sequence[float]
    ) -> CacheCandidate | None: ...
    async def put(self, entry: CacheEntry) -> None: ...
    async def record_hit(self, cache_key: str) -> bool: ...
    async def record_miss(self) -> None: ...
    async def list_entries(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None,
        sort: CacheEntrySort,
    ) -> CacheEntryListResponse: ...
    async def get_entry(self, cache_key: str) -> CacheEntryMetadata | None: ...
    async def delete_entry(self, cache_key: str) -> bool: ...
    async def clear(self) -> None: ...
    async def stats(self) -> CacheStatsResponse: ...


@dataclass(slots=True)
class _StoredItem:
    entry: CacheEntry
    expires_at_monotonic: float | None
    expires_at: datetime | None
    hit_count: int = 0
    last_accessed_at: datetime | None = None


def prompt_cache_key(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


class InMemoryCacheBackend:
    """Single-process cosine vector store with TTL and LRU invalidation."""

    def __init__(self, max_size: int, ttl_seconds: float | None) -> None:
        if max_size < 1 or (ttl_seconds is not None and ttl_seconds <= 0):
            raise ValueError("Invalid cache policy")
        self._max_size, self._ttl_seconds = max_size, ttl_seconds
        self._items: OrderedDict[str, _StoredItem] = OrderedDict()
        self._hits = self._misses = 0
        self._lock = asyncio.Lock()

    def _purge(self, now_monotonic: float | None = None) -> None:
        now = time.monotonic() if now_monotonic is None else now_monotonic
        for key in [
            key
            for key, item in self._items.items()
            if item.expires_at_monotonic is not None
            and item.expires_at_monotonic <= now
        ]:
            self._items.pop(key, None)

    @staticmethod
    def _response_preview(response: str) -> str:
        if len(response) <= MAX_RESPONSE_PREVIEW_LENGTH:
            return response
        return response[: MAX_RESPONSE_PREVIEW_LENGTH - 3] + "..."

    @classmethod
    def _metadata(
        cls,
        item: _StoredItem,
        *,
        now_monotonic: float,
        recency_rank: int,
    ) -> CacheEntryMetadata:
        remaining_ttl = (
            None
            if item.expires_at_monotonic is None
            else max(0.0, item.expires_at_monotonic - now_monotonic)
        )
        return CacheEntryMetadata(
            cache_key=item.entry.cache_key,
            prompt=item.entry.prompt,
            response_preview=cls._response_preview(item.entry.response),
            created_at=item.entry.created_at,
            expires_at=item.expires_at,
            remaining_ttl_seconds=remaining_ttl,
            hit_count=item.hit_count,
            last_accessed_at=item.last_accessed_at,
            recency_rank=recency_rank,
            is_expired=False,
        )

    @staticmethod
    def _sort_entries(
        entries: list[CacheEntryMetadata],
        sort: CacheEntrySort,
    ) -> list[CacheEntryMetadata]:
        if sort == "oldest":
            return sorted(entries, key=lambda item: (item.created_at, item.cache_key))
        if sort == "most_hit":
            return sorted(
                entries,
                key=lambda item: (
                    -item.hit_count,
                    -item.created_at.timestamp(),
                    item.cache_key,
                ),
            )
        if sort == "nearest_expiry":
            return sorted(
                entries,
                key=lambda item: (
                    item.expires_at is None,
                    (
                        float("inf")
                        if item.expires_at is None
                        else item.expires_at.timestamp()
                    ),
                    -item.created_at.timestamp(),
                    item.cache_key,
                ),
            )
        return sorted(
            entries,
            key=lambda item: (-item.created_at.timestamp(), item.cache_key),
        )

    async def find_nearest(self, embedding: Sequence[float]) -> CacheCandidate | None:
        query: NDArray[np.float64] = np.asarray(embedding, dtype=np.float64)
        if query.shape != (EMBEDDING_DIMENSIONS,) or not np.isfinite(query).all():
            raise CacheStorageError("Query embedding is invalid")
        async with self._lock:
            self._purge()
            if not self._items:
                return None
            items = list(self._items.values())
            matrix: NDArray[np.float64] = np.asarray(
                [item.entry.embedding for item in items], dtype=np.float64
            )
            norms = np.linalg.norm(matrix, axis=1)
            query_norm = float(np.linalg.norm(query))
            if query_norm <= np.finfo(np.float64).eps or np.any(
                norms <= np.finfo(np.float64).eps
            ):
                raise CacheStorageError("Zero magnitude embedding")
            scores = (matrix @ query) / (norms * query_norm)
            index = int(np.argmax(scores))
            return CacheCandidate(
                entry=items[index].entry.model_copy(deep=True),
                similarity_score=max(-1.0, min(1.0, float(scores[index]))),
            )

    async def put(self, entry: CacheEntry) -> None:
        async with self._lock:
            self._purge()
            stored_at = datetime.now(UTC)
            expires_at_monotonic = None
            expires_at = None
            if self._ttl_seconds is not None:
                expires_at_monotonic = time.monotonic() + self._ttl_seconds
                expires_at = stored_at + timedelta(seconds=self._ttl_seconds)
            self._items[entry.cache_key] = _StoredItem(
                entry=entry.model_copy(deep=True),
                expires_at_monotonic=expires_at_monotonic,
                expires_at=expires_at,
            )
            self._items.move_to_end(entry.cache_key)
            while len(self._items) > self._max_size:
                self._items.popitem(last=False)

    async def record_hit(self, cache_key: str) -> bool:
        async with self._lock:
            self._purge()
            if cache_key not in self._items:
                return False
            item = self._items[cache_key]
            self._items.move_to_end(cache_key)
            self._hits += 1
            item.hit_count += 1
            item.last_accessed_at = datetime.now(UTC)
            return True

    async def record_miss(self) -> None:
        async with self._lock:
            self._purge()
            self._misses += 1

    async def list_entries(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None,
        sort: CacheEntrySort,
    ) -> CacheEntryListResponse:
        async with self._lock:
            now_monotonic = time.monotonic()
            self._purge(now_monotonic)
            recency_ranks = {
                cache_key: rank
                for rank, cache_key in enumerate(reversed(self._items), start=1)
            }
            entries = [
                self._metadata(
                    item,
                    now_monotonic=now_monotonic,
                    recency_rank=recency_ranks[cache_key],
                )
                for cache_key, item in self._items.items()
            ]

            normalized_search = None if search is None else search.strip().casefold()
            if normalized_search:
                entries = [
                    item
                    for item in entries
                    if normalized_search in item.prompt.casefold()
                ]

            ordered_entries = self._sort_entries(entries, sort)
            total = len(ordered_entries)
            page = ordered_entries[offset : offset + limit]
            return CacheEntryListResponse(
                items=page,
                total=total,
                offset=offset,
                limit=limit,
                has_more=offset + len(page) < total,
            )

    async def get_entry(self, cache_key: str) -> CacheEntryMetadata | None:
        async with self._lock:
            now_monotonic = time.monotonic()
            self._purge(now_monotonic)
            item = self._items.get(cache_key)
            if item is None:
                return None
            recency_rank = next(
                rank
                for rank, current_key in enumerate(reversed(self._items), start=1)
                if current_key == cache_key
            )
            return self._metadata(
                item,
                now_monotonic=now_monotonic,
                recency_rank=recency_rank,
            )

    async def delete_entry(self, cache_key: str) -> bool:
        async with self._lock:
            self._purge()
            return self._items.pop(cache_key, None) is not None

    async def clear(self) -> None:
        async with self._lock:
            self._items.clear()
            self._hits = self._misses = 0

    async def stats(self) -> CacheStatsResponse:
        async with self._lock:
            self._purge()
            total = self._hits + self._misses
            return CacheStatsResponse(
                size=len(self._items),
                hits=self._hits,
                misses=self._misses,
                hit_rate=0.0 if total == 0 else self._hits / total,
            )
