import numpy as np
from numpy.typing import NDArray
from app.core.exceptions import EmbeddingError
from app.core.schemas import EMBEDDING_DIMENSIONS
from app.providers.protocols import EmbeddingProvider


class EmbeddingService:
    def __init__(
        self, provider: EmbeddingProvider, dimensions: int = EMBEDDING_DIMENSIONS
    ) -> None:
        self._provider, self._dimensions = provider, dimensions

    async def embed(self, text: str) -> list[float]:
        vector: NDArray[np.float64] = np.asarray(
            await self._provider.create_embedding(text), dtype=np.float64
        )
        if vector.ndim != 1 or vector.shape[0] != self._dimensions:
            raise EmbeddingError(
                f"Expected {self._dimensions} dimensions; received {vector.shape}"
            )
        if not np.isfinite(vector).all():
            raise EmbeddingError("Embedding contains non-finite components")
        norm = float(np.linalg.norm(vector))
        if norm <= np.finfo(np.float64).eps:
            raise EmbeddingError("Embedding has zero or invalid magnitude")
        return [float(value) for value in vector / norm]
