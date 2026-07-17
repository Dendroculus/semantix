from collections.abc import Sequence

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.models.schemas import EMBEDDING_DIMENSIONS
from app.services.benchmark_service import BenchmarkService


class SameEmbeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1)


class Provider:
    def __init__(self) -> None:
        self.call_count = 0

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        return f"Generated answer for {prompt}"


def benchmark_service(provider: Provider) -> BenchmarkService:
    return BenchmarkService(
        SameEmbeddings(),
        provider,
        max_cache_size=100,
        cache_ttl_seconds=60,
        initial_threshold=0.92,
    )


def test_lists_controlled_datasets(settings: Settings) -> None:
    app = create_app(settings)

    with TestClient(app) as client:
        response = client.get("/api/v1/benchmarks/datasets")

    assert response.status_code == 200
    payload = response.json()
    assert payload["default_dataset_id"] == "quick"
    assert [dataset["dataset_id"] for dataset in payload["datasets"]] == [
        "quick",
        "extended",
    ]
    quick = payload["datasets"][0]
    assert quick["query_count"] == 8
    assert quick["expected_hits"] + quick["expected_misses"] == 8
    assert {
        "exact_duplicate",
        "paraphrase",
        "unrelated",
        "typo",
        "negation",
        "different_intent",
    }.issubset(set(quick["categories"]))


def test_runs_default_benchmark_end_to_end(settings: Settings) -> None:
    app = create_app(settings)
    provider = Provider()

    with TestClient(app) as client:
        app.state.benchmark_service = benchmark_service(provider)
        response = client.post(
            "/api/v1/benchmarks/run",
            json={
                "dataset_id": "quick",
                "threshold": 0.9,
                "evaluation_thresholds": [0.8, 0.9, 0.95],
                "repetitions": 2,
                "reset_cache_before_run": True,
                "estimated_cost_per_request_usd": 0.01,
                "estimated_cost_per_1k_tokens_usd": 0.002,
                "allow_external_provider_calls": True,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"]["dataset_id"] == "quick"
    assert payload["threshold"] == 0.9
    assert payload["metrics"]["total_queries"] == 16
    assert len(payload["query_results"]) == 16
    assert len(payload["threshold_evaluations"]) == 3
    assert provider.call_count == payload["metrics"]["provider_calls"] == 2
    assert (
        payload["metrics"]["provider_calls"]
        + payload["metrics"]["provider_calls_avoided"]
        == 16
    )
    assert "embedding" not in response.text


def test_requires_explicit_external_provider_confirmation(
    settings: Settings,
) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/v1/benchmarks/run",
            json={
                "dataset_id": "quick",
                "threshold": 0.92,
                "repetitions": 1,
                "reset_cache_before_run": True,
            },
        )

    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"
