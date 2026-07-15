from collections.abc import Sequence

import pytest

from app.core.exceptions import EmbeddingError
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.embedding_service import EmbeddingService


class FakeProvider:
    def __init__(self, embedding: Sequence[float]) -> None:
        self._embedding = embedding

    async def create_embedding(self, text: str) -> Sequence[float]:
        return self._embedding


@pytest.mark.asyncio
async def test_normalizes_embedding() -> None:
    service = EmbeddingService(FakeProvider([2.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)))
    result = await service.embed("hello")
    assert result[0] == pytest.approx(1.0)
    assert sum(value * value for value in result) == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_rejects_wrong_dimensions() -> None:
    with pytest.raises(EmbeddingError):
        await EmbeddingService(FakeProvider([1.0, 0.0])).embed("hello")


@pytest.mark.asyncio
async def test_rejects_zero_vector() -> None:
    with pytest.raises(EmbeddingError):
        await EmbeddingService(FakeProvider([0.0] * EMBEDDING_DIMENSIONS)).embed("hello")
