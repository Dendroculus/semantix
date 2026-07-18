import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Generic, TypeVar

Result = TypeVar("Result")


@dataclass(frozen=True, slots=True)
class CoalescedResult(Generic[Result]):
    value: Result
    is_leader: bool


class RequestCoalescer(Generic[Result]):
    def __init__(self) -> None:
        self._in_flight: dict[str, asyncio.Future[Result]] = {}
        self._cleanup_tasks: set[asyncio.Task[None]] = set()
        self._lock = asyncio.Lock()

    async def run(
        self,
        key: str,
        operation: Callable[[], Awaitable[Result]],
    ) -> CoalescedResult[Result]:
        async with self._lock:
            task = self._in_flight.get(key)
            is_leader = task is None
            if task is None:
                task = asyncio.ensure_future(operation())
                self._in_flight[key] = task
                task.add_done_callback(
                    lambda completed: self._schedule_cleanup(key, completed)
                )

        try:
            value = await asyncio.shield(task)
        finally:
            if task.done():
                await self._remove(key, task)
        return CoalescedResult(value=value, is_leader=is_leader)

    def _schedule_cleanup(
        self,
        key: str,
        completed: asyncio.Future[Result],
    ) -> None:
        if not completed.cancelled():
            completed.exception()
        cleanup = asyncio.create_task(self._remove(key, completed))
        self._cleanup_tasks.add(cleanup)
        cleanup.add_done_callback(self._cleanup_tasks.discard)

    async def _remove(
        self,
        key: str,
        completed: asyncio.Future[Result],
    ) -> None:
        async with self._lock:
            if self._in_flight.get(key) is completed:
                del self._in_flight[key]
