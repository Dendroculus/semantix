from collections.abc import Sequence
from typing import Protocol


class EmbeddingProvider(Protocol):
    async def create_embedding(self, text: str) -> Sequence[float]: ...


class EmbeddingGenerator(Protocol):
    async def embed(self, text: str) -> Sequence[float]: ...


class GenerationProvider(Protocol):
    async def generate(self, prompt: str) -> str: ...
