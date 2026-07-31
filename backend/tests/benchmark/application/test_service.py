import asyncio
from collections.abc import Sequence

import pytest
from pydantic import ValidationError

from app.benchmark.api.schemas import BenchmarkRunRequest, BenchmarkRunResponse
from app.benchmark.application.service import BenchmarkService
from app.benchmark.domain.models import BenchmarkRuntimeConfiguration
from app.core.exceptions import EvaluationTimeoutError, InvalidProviderResponseError
from app.core.limits import MAX_RESPONSE_LENGTH


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return [1.0, 0.0, 0.0, 0.0]


class Provider:
    def __init__(self) -> None:
        self.call_count = 0

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        return f"response:{prompt}"


class OversizedProvider:
    async def generate(self, prompt: str) -> str:
        return "x" * (MAX_RESPONSE_LENGTH + 1)


class TimeoutThenProvider:
    def __init__(self) -> None:
        self.call_count = 0
        self.started = asyncio.Event()

    async def generate(self, prompt: str) -> str:
        self.call_count += 1
        if self.call_count == 1:
            self.started.set()
            await asyncio.sleep(60)
        return f"response:{prompt}"


def runtime_configuration(
    *,
    evaluation_timeout_seconds: float = 30,
) -> BenchmarkRuntimeConfiguration:
    return BenchmarkRuntimeConfiguration(
        application_version="1.0.0",
        embedding_provider_category="mock",
        generation_provider_category="mock",
        embedding_dimensions=4,
        embedding_space_fingerprint="1" * 64,
        normalization_mode="identity",
        normalization_fingerprint="2" * 64,
        evaluation_timeout_seconds=evaluation_timeout_seconds,
    )


def benchmark_service(
    provider: Provider | OversizedProvider | TimeoutThenProvider,
    *,
    evaluation_timeout_seconds: float = 30,
) -> BenchmarkService:
    return BenchmarkService(
        Embeddings(),
        provider,
        max_cache_size=10,
        cache_ttl_seconds=60,
        prompt_normalizer=lambda prompt: prompt,
        runtime_configuration=runtime_configuration(
            evaluation_timeout_seconds=evaluation_timeout_seconds
        ),
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


@pytest.mark.asyncio
async def test_sequential_runs_do_not_share_cache_state_when_reset_is_disabled() -> (
    None
):
    provider = Provider()
    service = benchmark_service(provider)
    request = BenchmarkRunRequest(
        repetitions=2,
        reset_cache_before_run=False,
        evaluation_thresholds=[0.80, 0.92],
        allow_external_provider_calls=True,
    )

    first = await service.run(request)
    second = await service.run(request)

    assert provider.call_count == 2
    assert first.metrics.provider_calls == 1
    assert second.metrics.provider_calls == 1
    assert first.query_results[0].actual_cache_hit is False
    assert second.query_results[0].actual_cache_hit is False


@pytest.mark.asyncio
async def test_repetition_reset_policy_is_preserved_within_one_run() -> None:
    preserved_provider = Provider()
    preserved = await benchmark_service(preserved_provider).run(
        BenchmarkRunRequest(
            repetitions=2,
            reset_cache_before_run=False,
            evaluation_thresholds=[0.80, 0.92],
            allow_external_provider_calls=True,
        )
    )
    reset_provider = Provider()
    reset = await benchmark_service(reset_provider).run(
        BenchmarkRunRequest(
            repetitions=2,
            reset_cache_before_run=True,
            evaluation_thresholds=[0.80, 0.92],
            allow_external_provider_calls=True,
        )
    )

    assert preserved.metrics.provider_calls == 1
    assert preserved.query_results[8].actual_cache_hit is True
    assert reset.metrics.provider_calls == 2
    assert reset.query_results[8].actual_cache_hit is False


@pytest.mark.asyncio
async def test_query_results_carry_matched_keys_only_for_hits() -> None:
    result = await benchmark_service(Provider()).run(
        BenchmarkRunRequest(
            evaluation_thresholds=[0.80, 0.92],
            allow_external_provider_calls=True,
        )
    )

    hits = [query for query in result.query_results if query.actual_cache_hit]
    misses = [query for query in result.query_results if not query.actual_cache_hit]
    assert hits
    assert all(query.matched_cache_key is not None for query in hits)
    assert all(query.matched_prompt is not None for query in hits)
    assert all(query.matched_cache_key is None for query in misses)
    assert all(query.matched_prompt is None for query in misses)


@pytest.mark.asyncio
async def test_safe_reproducibility_metadata_uses_an_explicit_allowlist() -> None:
    result = await benchmark_service(Provider()).run(
        BenchmarkRunRequest(
            threshold=0.91,
            evaluation_thresholds=[0.80, 0.95],
            allow_external_provider_calls=True,
        )
    )

    payload = result.reproducibility.model_dump()
    assert set(payload) == {
        "application_version",
        "dataset_id",
        "dataset_version",
        "dataset_digest",
        "embedding_provider_category",
        "generation_provider_category",
        "embedding_dimensions",
        "embedding_space_fingerprint",
        "normalization_mode",
        "normalization_fingerprint",
        "measured_threshold",
        "evaluation_thresholds",
        "repetitions",
        "reset_cache_before_run",
        "estimated_cost_per_request_usd",
        "estimated_cost_per_1k_tokens_usd",
        "evaluation_timeout_seconds",
        "configuration_fingerprint",
    }
    serialized = result.model_dump_json()
    for forbidden in (
        "api_key",
        "authorization",
        "base_url",
        "embedding_model",
        "generation_model",
    ):
        assert forbidden not in serialized
    assert all(
        "embedding" not in query for query in result.model_dump()["query_results"]
    )
    assert payload["measured_threshold"] == result.threshold == 0.91
    assert payload["evaluation_thresholds"] == [0.80, 0.91, 0.95]


@pytest.mark.asyncio
async def test_configuration_fingerprint_includes_the_measured_threshold() -> None:
    service = benchmark_service(Provider())
    thresholds = [0.80, 0.90, 0.95]

    run_at_90 = await service.run(
        BenchmarkRunRequest(
            threshold=0.90,
            evaluation_thresholds=thresholds,
            allow_external_provider_calls=True,
        )
    )
    repeated_run_at_90 = await service.run(
        BenchmarkRunRequest(
            threshold=0.90,
            evaluation_thresholds=thresholds,
            allow_external_provider_calls=True,
        )
    )
    run_at_95 = await service.run(
        BenchmarkRunRequest(
            threshold=0.95,
            evaluation_thresholds=thresholds,
            allow_external_provider_calls=True,
        )
    )

    assert run_at_90.reproducibility.evaluation_thresholds == thresholds
    assert run_at_95.reproducibility.evaluation_thresholds == thresholds
    assert run_at_90.reproducibility.configuration_fingerprint == (
        repeated_run_at_90.reproducibility.configuration_fingerprint
    )
    assert run_at_90.reproducibility.configuration_fingerprint != (
        run_at_95.reproducibility.configuration_fingerprint
    )


@pytest.mark.asyncio
async def test_response_rejects_a_mismatched_reproducibility_threshold() -> None:
    result = await benchmark_service(Provider()).run(
        BenchmarkRunRequest(
            threshold=0.90,
            evaluation_thresholds=[0.80, 0.90, 0.95],
            allow_external_provider_calls=True,
        )
    )
    payload = result.model_dump()
    payload["reproducibility"]["measured_threshold"] = 0.95

    with pytest.raises(
        ValidationError,
        match="Reproducibility metadata does not match the run",
    ):
        BenchmarkRunResponse.model_validate(payload)


@pytest.mark.asyncio
async def test_timeout_leaves_the_next_run_with_a_fresh_cache() -> None:
    provider = TimeoutThenProvider()
    service = benchmark_service(provider, evaluation_timeout_seconds=0.05)
    request = BenchmarkRunRequest(
        evaluation_thresholds=[0.80, 0.92],
        allow_external_provider_calls=True,
    )

    with pytest.raises(EvaluationTimeoutError):
        await service.run(request)

    result = await service.run(request)

    assert result.query_results[0].actual_cache_hit is False
    assert result.metrics.provider_calls == 1
    assert provider.call_count == 2


@pytest.mark.asyncio
async def test_cancelled_run_leaves_the_next_run_with_a_fresh_cache() -> None:
    provider = TimeoutThenProvider()
    service = benchmark_service(provider)
    request = BenchmarkRunRequest(
        evaluation_thresholds=[0.80, 0.92],
        allow_external_provider_calls=True,
    )
    cancelled = asyncio.create_task(service.run(request))
    await provider.started.wait()

    cancelled.cancel()
    with pytest.raises(asyncio.CancelledError):
        await cancelled

    result = await service.run(request)
    assert result.query_results[0].actual_cache_hit is False
    assert result.metrics.provider_calls == 1
