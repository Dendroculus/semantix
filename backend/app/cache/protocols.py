from collections.abc import Sequence
from typing import Protocol

from app.cache.models import CacheCandidate, CacheEntry
from app.cache.schemas import (
    CacheEntryListResponse,
    CacheEntryMetadata,
    CacheEntrySort,
    CacheStatsResponse,
)


class CacheBackend(Protocol):
    """Cache port for vectors produced by one model and dimension count.

    Persistent implementations must partition incompatible embedding spaces.
    """

    async def find_nearest(
        self,
        embedding: Sequence[float],
        *,
        namespace: str,
    ) -> CacheCandidate | None: ...

    async def put(self, entry: CacheEntry) -> None: ...
    async def record_hit(self, cache_key: str) -> bool: ...
    async def record_miss(self, namespace: str) -> None: ...

    async def list_entries(
        self,
        *,
        offset: int,
        limit: int,
        namespace: str | None,
        search: str | None,
        sort: CacheEntrySort,
    ) -> CacheEntryListResponse: ...

    async def get_entry(self, cache_key: str) -> CacheEntryMetadata | None: ...
    async def delete_entry(self, cache_key: str) -> bool: ...
    async def clear(self, namespace: str | None) -> None: ...
    async def stats(self, namespace: str | None) -> CacheStatsResponse: ...
