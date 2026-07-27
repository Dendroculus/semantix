from collections.abc import Sequence

import pytest

from app.benchmark.api.schemas import BenchmarkRunRequest
from app.benchmark.application.service import BenchmarkService
from app.core.exceptions import InvalidProviderResponseError
from app.core.limits import MAX_RESPONSE_LENGTH


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0, 0.0, 0.0, 0.0]


class Provider:
    async def generate(self, prompt: str) -> str:
        return f"response:{prompt}"


class OversizedProvider:
    async def generate(self, prompt: str) -> str:
        return "x" * (MAX_RESPONSE_LENGTH + 1)


def benchmark_service(provider: Provider | OversizedProvider) -> BenchmarkService:
    return BenchmarkService(
        Embeddings(),
        provider,
        max_cache_size=10,
        cache_ttl_seconds=60,
        initial_threshold=0.92,
        embedding_dimensions=4,
        prompt_normalizer=lambda prompt: prompt,
    )


def test_benchmark_service_exposes_the_default_dataset() -> None:
    service = benchmark_service(Provider())

    datasets = service.datasets()

    assert datasets.datasets
    assert datasets.default_dataset_id in {
        dataset.dataset_id for dataset in datasets.datasets
    }


@pytest.mark.asyncio
async def test_benchmark_rejects_oversized_provider_response() -> None:
    service = benchmark_service(OversizedProvider())

    with pytest.raises(InvalidProviderResponseError):
        await service.run(
            BenchmarkRunRequest(
                allow_external_provider_calls=True,
            )
        )
