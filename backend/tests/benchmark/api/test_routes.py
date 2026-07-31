import asyncio
from collections.abc import Sequence

from fastapi.testclient import TestClient

from app.benchmark.application.service import BenchmarkService
from app.benchmark.domain.models import BenchmarkRuntimeConfiguration
from app.core.config import Settings
from app.factory import create_app
from tests.support import TEST_EMBEDDING_DIMENSIONS


class SameEmbeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0] + [0.0] * (TEST_EMBEDDING_DIMENSIONS - 1)


class Provider:
    def __init__(self) -> None:
        self.call_count = 0

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        return f"Generated answer for {prompt}"


class TimeoutThenProvider(Provider):
    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        if self.call_count == 1:
            await asyncio.sleep(60)
        return f"Generated answer for {prompt}"


def benchmark_service(
    provider: Provider,
    *,
    evaluation_timeout_seconds: float = 30,
) -> BenchmarkService:
    return BenchmarkService(
        SameEmbeddings(),
        provider,
        max_cache_size=100,
        cache_ttl_seconds=60,
        prompt_normalizer=lambda prompt: prompt,
        runtime_configuration=BenchmarkRuntimeConfiguration(
            application_version="1.0.0",
            embedding_provider_category="mock",
            generation_provider_category="mock",
            embedding_dimensions=TEST_EMBEDDING_DIMENSIONS,
            embedding_space_fingerprint="1" * 64,
            normalization_mode="identity",
            normalization_fingerprint="2" * 64,
            evaluation_timeout_seconds=evaluation_timeout_seconds,
        ),
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
    assert quick["version"] == "1.0.0"
    assert len(quick["digest"]) == 64
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
        live_stats_before = client.get("/api/v1/cache/stats").json()
        runtime_before = app.state.runtime_metrics.snapshot(
            cache_size=live_stats_before["size"]
        )
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
        live_stats_after = client.get("/api/v1/cache/stats").json()
        runtime_after = app.state.runtime_metrics.snapshot(
            cache_size=live_stats_after["size"]
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"]["dataset_id"] == "quick"
    assert payload["threshold"] == 0.9
    assert payload["metrics"]["total_queries"] == 16
    assert len(payload["query_results"]) == 16
    assert payload["threshold_evaluation_mode"] == "frozen_candidate_projection"
    assert len(payload["threshold_evaluations"]) == 3
    assert (
        sum(
            evaluation["result_kind"] == "measured"
            for evaluation in payload["threshold_evaluations"]
        )
        == 1
    )
    assert provider.call_count == payload["metrics"]["provider_calls"] == 2
    assert (
        payload["metrics"]["provider_calls"]
        + payload["metrics"]["provider_calls_avoided"]
        == 16
    )
    assert payload["metrics"]["true_positive_hits"] == 8
    assert payload["metrics"]["true_negative_misses"] == 2
    assert (
        payload["reproducibility"]["dataset_digest"] == (payload["dataset"]["digest"])
    )
    assert payload["reproducibility"]["evaluation_thresholds"] == [0.8, 0.9, 0.95]
    assert live_stats_after == live_stats_before
    for field in (
        "request_count",
        "error_count",
        "cache_hits",
        "cache_misses",
        "provider_calls",
        "in_flight_coalesced_requests",
        "latency_sample_size",
        "cache_size",
        "evictions",
        "expirations",
    ):
        assert getattr(runtime_after, field) == getattr(runtime_before, field)
    assert all("embedding" not in query for query in payload["query_results"])


def test_thresholds_are_bounded_unique_and_include_the_measured_value(
    settings: Settings,
) -> None:
    app = create_app(settings)

    with TestClient(app) as client:
        duplicate = client.post(
            "/api/v1/benchmarks/run",
            json={
                "threshold": 0.9,
                "evaluation_thresholds": [0.8, 0.8],
                "allow_external_provider_calls": True,
            },
        )
        too_many = client.post(
            "/api/v1/benchmarks/run",
            json={
                "threshold": 0.91,
                "evaluation_thresholds": [index / 100 for index in range(15)],
                "allow_external_provider_calls": True,
            },
        )

    assert duplicate.status_code == 422
    assert too_many.status_code == 422


def test_run_timeout_returns_a_structured_error_and_allows_a_later_run(
    settings: Settings,
) -> None:
    app = create_app(settings)
    provider = TimeoutThenProvider()

    with TestClient(app) as client:
        app.state.benchmark_service = benchmark_service(
            provider,
            evaluation_timeout_seconds=0.1,
        )
        timed_out = client.post(
            "/api/v1/benchmarks/run",
            json={"allow_external_provider_calls": True},
        )
        recovered = client.post(
            "/api/v1/benchmarks/run",
            json={"allow_external_provider_calls": True},
        )

    assert timed_out.status_code == 504
    assert timed_out.json() == {
        "error": "evaluation_timeout",
        "detail": "The evaluation exceeded its configured wall-clock limit.",
    }
    assert recovered.status_code == 200
    assert recovered.json()["metrics"]["provider_calls"] == 1


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
