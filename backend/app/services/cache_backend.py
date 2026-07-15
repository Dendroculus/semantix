import asyncio
import hashlib
import time
from collections import OrderedDict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol
import numpy as np
from numpy.typing import NDArray
from app.core.exceptions import CacheStorageError
from app.models.schemas import (
    CacheCandidate,
    CacheEntry,
    CacheStatsResponse,
    EMBEDDING_DIMENSIONS,
)


class CacheBackend(Protocol):
    async def find_nearest(
        self, embedding: Sequence[float]
    ) -> CacheCandidate | None: ...
    async def put(self, entry: CacheEntry) -> None: ...
    async def record_hit(self, cache_key: str) -> bool: ...
    async def record_miss(self) -> None: ...
    async def clear(self) -> None: ...
    async def stats(self) -> CacheStatsResponse: ...


@dataclass(slots=True)
class _StoredItem:
    entry: CacheEntry
    expires_at: float | None


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

    def _purge(self) -> None:
        now = time.monotonic()
        for key in [
            key
            for key, item in self._items.items()
            if item.expires_at is not None and item.expires_at <= now
        ]:
            self._items.pop(key, None)

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
            expiry = (
                None
                if self._ttl_seconds is None
                else time.monotonic() + self._ttl_seconds
            )
            self._items[entry.cache_key] = _StoredItem(
                entry.model_copy(deep=True), expiry
            )
            self._items.move_to_end(entry.cache_key)
            while len(self._items) > self._max_size:
                self._items.popitem(last=False)

    async def record_hit(self, cache_key: str) -> bool:
        async with self._lock:
            self._purge()
            if cache_key not in self._items:
                return False
            self._items.move_to_end(cache_key)
            self._hits += 1
            return True

    async def record_miss(self) -> None:
        async with self._lock:
            self._purge()
            self._misses += 1

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
