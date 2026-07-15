import asyncio
import hashlib
import math
import time
from collections import OrderedDict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import numpy as np
from numpy.typing import NDArray

from app.core.exceptions import CacheStorageError
from app.models.schemas import CacheCandidate, CacheEntry, CacheStatsResponse, EMBEDDING_DIMENSIONS


class CacheBackend(Protocol):
    async def find_nearest(self, embedding: Sequence[float]) -> CacheCandidate | None:
        ...

    async def put(self, entry: CacheEntry) -> None:
        ...

    async def record_hit(self, cache_key: str) -> bool:
        ...

    async def record_miss(self) -> None:
        ...

    async def clear(self) -> None:
        ...

    async def stats(self) -> CacheStatsResponse:
        ...


@dataclass(slots=True)
class _StoredItem:
    entry: CacheEntry
    expires_at: float | None


def prompt_cache_key(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


class InMemoryCacheBackend:
    """Single-process LRU/TTL vector store behind the CacheBackend interface."""

    def __init__(self, max_size: int, ttl_seconds: float | None) -> None:
        if max_size < 1:
            raise ValueError("max_size must be at least 1")
        if ttl_seconds is not None and ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive or None")
        self._max_size = max_size
        self._ttl_seconds = ttl_seconds
        self._items: OrderedDict[str, _StoredItem] = OrderedDict()
        self._hits = 0
        self._misses = 0
        self._lock = asyncio.Lock()

    def _purge_expired_locked(self) -> None:
        now = time.monotonic()
        expired = [
            key for key, item in self._items.items()
            if item.expires_at is not None and item.expires_at <= now
        ]
        for key in expired:
            self._items.pop(key, None)

    async def find_nearest(self, embedding: Sequence[float]) -> CacheCandidate | None:
        query: NDArray[np.float64] = np.asarray(embedding, dtype=np.float64)
        if query.shape != (EMBEDDING_DIMENSIONS,):
            raise CacheStorageError("Query embedding has invalid dimensions")
        if not np.isfinite(query).all():
            raise CacheStorageError("Query embedding contains invalid values")

        async with self._lock:
            self._purge_expired_locked()
            if not self._items:
                return None

            stored_items = list(self._items.values())
            matrix: NDArray[np.float64] = np.asarray(
                [item.entry.embedding for item in stored_items], dtype=np.float64
            )
            query_norm = float(np.linalg.norm(query))
            row_norms: NDArray[np.float64] = np.linalg.norm(matrix, axis=1)
            if query_norm <= np.finfo(np.float64).eps:
                raise CacheStorageError("Query embedding has zero magnitude")
            if np.any(row_norms <= np.finfo(np.float64).eps):
                raise CacheStorageError("Stored embedding has zero magnitude")

            scores = (matrix @ query) / (row_norms * query_norm)
            index = int(np.argmax(scores))
            score = max(-1.0, min(1.0, float(scores[index])))
            return CacheCandidate(
                entry=stored_items[index].entry.model_copy(deep=True),
                similarity_score=score,
            )

    async def put(self, entry: CacheEntry) -> None:
        async with self._lock:
            self._purge_expired_locked()
            expires_at = None if self._ttl_seconds is None else time.monotonic() + self._ttl_seconds
            self._items[entry.cache_key] = _StoredItem(
                entry=entry.model_copy(deep=True),
                expires_at=expires_at,
            )
            self._items.move_to_end(entry.cache_key)
            while len(self._items) > self._max_size:
                self._items.popitem(last=False)

    async def record_hit(self, cache_key: str) -> bool:
        async with self._lock:
            self._purge_expired_locked()
            if cache_key not in self._items:
                return False
            self._items.move_to_end(cache_key)
            self._hits += 1
            return True

    async def record_miss(self) -> None:
        async with self._lock:
            self._purge_expired_locked()
            self._misses += 1

    async def clear(self) -> None:
        async with self._lock:
            self._items.clear()
            self._hits = 0
            self._misses = 0

    async def stats(self) -> CacheStatsResponse:
        async with self._lock:
            self._purge_expired_locked()
            total = self._hits + self._misses
            hit_rate = 0.0 if total == 0 else self._hits / total
            if not math.isfinite(hit_rate):
                raise CacheStorageError("Cache statistics are invalid")
            return CacheStatsResponse(
                size=len(self._items),
                hits=self._hits,
                misses=self._misses,
                hit_rate=hit_rate,
            )
