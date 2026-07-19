from collections.abc import Sequence

from app.benchmark.application.service import BenchmarkService


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0, 0.0, 0.0, 0.0]


class Provider:
    async def generate(self, prompt: str) -> str:
        return f"response:{prompt}"


def test_benchmark_service_exposes_the_default_dataset() -> None:
    service = BenchmarkService(
        Embeddings(),
        Provider(),
        max_cache_size=10,
        cache_ttl_seconds=60,
        initial_threshold=0.92,
        embedding_dimensions=4,
        prompt_normalizer=lambda prompt: prompt,
    )

    datasets = service.datasets()

    assert datasets.datasets
    assert datasets.default_dataset_id in {
        dataset.dataset_id for dataset in datasets.datasets
    }
