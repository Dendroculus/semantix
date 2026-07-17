import asyncio
import math
from datetime import UTC, datetime
from time import perf_counter
from typing import Protocol
from uuid import uuid4

from app.models.benchmark import (
    BenchmarkDatasetListResponse,
    BenchmarkOutcome,
    BenchmarkQueryResult,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
)
from app.services.benchmark_datasets import (
    DEFAULT_DATASET_ID,
    BenchmarkCase,
    get_dataset,
    list_datasets,
)
from app.services.benchmark_metrics import (
    BenchmarkObservation,
    calculate_metrics,
    evaluate_thresholds,
)
from app.services.cache_backend import InMemoryCacheBackend
from app.services.cache_service import EmbeddingGenerator, SemanticCache


class GenerationProvider(Protocol):
    async def generate(self, prompt: str) -> str: ...


def _classification(
    expected_cache_hit: bool,
    actual_cache_hit: bool,
) -> BenchmarkOutcome:
    if actual_cache_hit:
        return "true_positive" if expected_cache_hit else "false_positive"
    return "false_negative" if expected_cache_hit else "true_negative"


def estimate_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))


class BenchmarkService:
    def __init__(
        self,
        embedding_service: EmbeddingGenerator,
        provider: GenerationProvider,
        *,
        max_cache_size: int,
        cache_ttl_seconds: int | None,
        initial_threshold: float,
    ) -> None:
        self._provider = provider
        self._cache = SemanticCache(
            embedding_service,
            InMemoryCacheBackend(max_cache_size, cache_ttl_seconds),
            initial_threshold,
        )
        self._run_lock = asyncio.Lock()

    def datasets(self) -> BenchmarkDatasetListResponse:
        return BenchmarkDatasetListResponse(
            datasets=list_datasets(),
            default_dataset_id=DEFAULT_DATASET_ID,
        )

    async def run(self, request: BenchmarkRunRequest) -> BenchmarkRunResponse:
        async with self._run_lock:
            return await self._run_exclusive(request)

    async def _execute_case(
        self,
        case: BenchmarkCase,
        *,
        sequence: int,
        repetition: int,
    ) -> tuple[BenchmarkQueryResult, BenchmarkObservation]:
        measured_at = perf_counter()
        lookup = await self._cache.lookup(case.prompt)
        if lookup.cache_hit:
            if lookup.response is None:
                raise RuntimeError("Validated benchmark hit had no response")
            response = lookup.response
        else:
            response = await self._provider.generate(case.prompt)
            await self._cache.store(case.prompt, response, lookup.embedding)
        latency_ms = (perf_counter() - measured_at) * 1_000
        tokens_saved = (
            estimate_tokens(case.prompt) + estimate_tokens(response)
            if lookup.cache_hit
            else 0
        )
        result = BenchmarkQueryResult(
            sequence=sequence,
            repetition=repetition,
            case_id=case.case_id,
            category=case.category,
            prompt=case.prompt,
            expected_cache_hit=case.expected_cache_hit,
            actual_cache_hit=lookup.cache_hit,
            correct=case.expected_cache_hit == lookup.cache_hit,
            outcome=_classification(case.expected_cache_hit, lookup.cache_hit),
            similarity_score=lookup.similarity_score,
            latency_ms=latency_ms,
            provider_called=not lookup.cache_hit,
            matched_prompt=lookup.matched_prompt,
        )
        observation = BenchmarkObservation(
            expected_cache_hit=case.expected_cache_hit,
            actual_cache_hit=lookup.cache_hit,
            latency_ms=latency_ms,
            provider_called=not lookup.cache_hit,
            similarity_score=lookup.similarity_score,
            estimated_tokens_saved=tokens_saved,
        )
        return result, observation

    async def _run_exclusive(
        self,
        request: BenchmarkRunRequest,
    ) -> BenchmarkRunResponse:
        dataset = get_dataset(request.dataset_id)
        started_at = datetime.now(UTC)
        self._cache.update_similarity_threshold(request.threshold)

        query_results: list[BenchmarkQueryResult] = []
        observations: list[BenchmarkObservation] = []
        sequence = 0
        for repetition in range(1, request.repetitions + 1):
            if request.reset_cache_before_run:
                await self._cache.clear()
            for case in dataset.cases:
                sequence += 1
                result, observation = await self._execute_case(
                    case,
                    sequence=sequence,
                    repetition=repetition,
                )
                query_results.append(result)
                observations.append(observation)

        thresholds = sorted(set([*request.evaluation_thresholds, request.threshold]))
        return BenchmarkRunResponse(
            run_id=uuid4().hex,
            started_at=started_at,
            completed_at=datetime.now(UTC),
            dataset=dataset.summary,
            threshold=request.threshold,
            repetitions=request.repetitions,
            reset_cache_before_run=request.reset_cache_before_run,
            estimated_cost_per_request_usd=request.estimated_cost_per_request_usd,
            estimated_cost_per_1k_tokens_usd=(request.estimated_cost_per_1k_tokens_usd),
            metrics=calculate_metrics(
                observations,
                estimated_cost_per_request_usd=(request.estimated_cost_per_request_usd),
                estimated_cost_per_1k_tokens_usd=(
                    request.estimated_cost_per_1k_tokens_usd
                ),
            ),
            threshold_evaluations=evaluate_thresholds(observations, thresholds),
            query_results=query_results,
        )
