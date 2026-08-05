import asyncio
import hashlib
import json
import math
from collections.abc import Callable
from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from app.benchmark.api.schemas import (
    BenchmarkDatasetListResponse,
    BenchmarkOutcome,
    BenchmarkQueryResult,
    BenchmarkReproducibilityMetadata,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
    EvaluationDatasetPreview,
    EvaluationDatasetSourceKind,
    EvaluationDatasetValidationRequest,
    EvaluationRunOptions,
    EvaluationRunRequest,
    ImportedEvaluationCase,
    InlineEvaluationDatasetSource,
    PersistedEvaluationDatasetCatalogLimits,
    PersistedEvaluationDatasetDetail,
    PersistedEvaluationDatasetListResponse,
    PersistedEvaluationDatasetMetadata,
    PersistedEvaluationDatasetSource,
    PersistEvaluationDatasetRequest,
)
from app.benchmark.application.history import EvaluationRunHistoryRecorder
from app.benchmark.domain.datasets import (
    DEFAULT_DATASET_ID,
    get_dataset,
    list_datasets,
)
from app.benchmark.domain.metrics import (
    calculate_metrics,
    evaluate_frozen_candidate_thresholds,
)
from app.benchmark.domain.models import (
    AcceptedEvaluationRunContext,
    BenchmarkCase,
    BenchmarkDataset,
    BenchmarkObservation,
    BenchmarkRuntimeConfiguration,
    PersistedEvaluationDataset,
)
from app.benchmark.domain.protocols import (
    EvaluationDatasetRepository,
    EvaluationRunHistoryRepository,
)
from app.benchmark.domain.validation import (
    ValidatedImportedDataset,
    validate_imported_dataset,
)
from app.cache.application.service import SemanticCache
from app.cache.domain.namespaces import AuthorizedNamespaceScope
from app.cache.infrastructure.backends.memory import InMemoryCacheBackend
from app.core.exceptions import (
    EvaluationDatasetNotFoundError,
    EvaluationDatasetPersistenceDisabledError,
    EvaluationDatasetRetentionError,
    EvaluationTimeoutError,
)
from app.providers.protocols import EmbeddingGenerator, GenerationProvider
from app.providers.shared.responses import validate_generation_response


def _classification(
    expected_cache_hit: bool,
    actual_cache_hit: bool,
) -> BenchmarkOutcome:
    if actual_cache_hit:
        return "true_positive" if expected_cache_hit else "false_positive"
    return "false_negative" if expected_cache_hit else "true_negative"


def estimate_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))


def _persisted_metadata(
    record: PersistedEvaluationDataset,
) -> PersistedEvaluationDatasetMetadata:
    metadata = record.metadata
    return PersistedEvaluationDatasetMetadata(
        dataset_id=metadata.dataset_id,
        namespace=metadata.namespace,
        name=metadata.name,
        description=metadata.description,
        schema_version=metadata.schema_version,
        digest=metadata.digest,
        case_count=metadata.case_count,
        decoded_bytes=metadata.decoded_bytes,
        created_at=metadata.created_at,
        expires_at=metadata.expires_at,
    )


def _persisted_detail(
    record: PersistedEvaluationDataset,
) -> PersistedEvaluationDatasetDetail:
    return PersistedEvaluationDatasetDetail(
        **_persisted_metadata(record).model_dump(),
        cases=[
            ImportedEvaluationCase(
                case_id=case.case_id,
                prompt=case.prompt,
                expected_cache_hit=case.expected_cache_hit,
                expected_match_case_id=case.expected_match_case_id,
                category=case.category,
                note=case.note,
            )
            for case in record.dataset.cases
        ],
    )


class BenchmarkService:
    def __init__(
        self,
        embedding_service: EmbeddingGenerator,
        provider: GenerationProvider,
        *,
        max_cache_size: int,
        cache_ttl_seconds: int | None,
        prompt_normalizer: Callable[[str], str],
        runtime_configuration: BenchmarkRuntimeConfiguration,
        dataset_repository: EvaluationDatasetRepository | None = None,
        history_repository: EvaluationRunHistoryRepository | None = None,
    ) -> None:
        if runtime_configuration.evaluation_timeout_seconds <= 0:
            raise ValueError("evaluation_timeout_seconds must be positive")
        self._provider = provider
        self._embedding_service = embedding_service
        self._max_cache_size = max_cache_size
        self._cache_ttl_seconds = cache_ttl_seconds
        self._prompt_normalizer = prompt_normalizer
        self._runtime_configuration = runtime_configuration
        self._dataset_repository = dataset_repository
        self._history_recorder = EvaluationRunHistoryRecorder(history_repository)
        self._run_lock = asyncio.Lock()

    @property
    def run_history_enabled(self) -> bool:
        return self._runtime_configuration.evaluation_run_history_storage == "postgres"

    def datasets(self) -> BenchmarkDatasetListResponse:
        return BenchmarkDatasetListResponse(
            datasets=list_datasets(),
            default_dataset_id=DEFAULT_DATASET_ID,
        )

    async def run(self, request: BenchmarkRunRequest) -> BenchmarkRunResponse:
        dataset = get_dataset(request.dataset_id)
        accepted_run = self._accept_run(dataset)
        return await self._run_accepted(request, dataset, accepted_run)

    def validate_dataset(
        self,
        request: EvaluationDatasetValidationRequest,
    ) -> EvaluationDatasetPreview:
        return self._validate_inline(
            request.dataset,
            repetitions=request.repetitions,
            threshold_count=request.threshold_count,
        ).preview

    async def run_evaluation(
        self,
        request: EvaluationRunRequest,
        *,
        authorized_namespaces: AuthorizedNamespaceScope = frozenset(),
        builtin_history_namespace: str | None = None,
    ) -> BenchmarkRunResponse:
        source = request.dataset_source
        source_dataset_expires_at: datetime | None = None
        resolved_history_namespace: str | None = None
        if isinstance(source, InlineEvaluationDatasetSource):
            dataset = self._validate_inline(
                source.definition,
                repetitions=request.repetitions,
                threshold_count=len(request.evaluation_thresholds),
            ).dataset
        elif isinstance(source, PersistedEvaluationDatasetSource):
            repository = self._require_dataset_repository()
            record = await repository.get_dataset(
                str(source.dataset_id),
                authorized_namespaces=authorized_namespaces,
            )
            if record is None:
                raise EvaluationDatasetNotFoundError
            dataset = record.dataset
            source_dataset_expires_at = record.metadata.expires_at
            if self.run_history_enabled:
                resolved_history_namespace = record.metadata.namespace
        else:
            dataset = get_dataset(source.dataset_id)
            if self.run_history_enabled:
                if builtin_history_namespace is None:
                    raise ValueError(
                        "Built-in history namespace must be resolved before execution"
                    )
                resolved_history_namespace = builtin_history_namespace

        accepted_run = self._accept_run(
            dataset,
            history_namespace=resolved_history_namespace,
            source_dataset_expires_at=source_dataset_expires_at,
        )
        return await self._run_accepted(request, dataset, accepted_run)

    async def list_persisted_datasets(
        self,
        *,
        namespace: str | None,
        offset: int,
        limit: int,
    ) -> PersistedEvaluationDatasetListResponse:
        runtime = self._runtime_configuration
        limits = PersistedEvaluationDatasetCatalogLimits(
            default_retention_days=(runtime.evaluation_dataset_default_retention_days),
            max_retention_days=runtime.evaluation_dataset_max_retention_days,
            max_persisted_per_namespace=(
                runtime.evaluation_dataset_max_persisted_per_namespace
            ),
        )
        if self._dataset_repository is None:
            return PersistedEvaluationDatasetListResponse(
                storage_mode="session",
                persistence_enabled=False,
                items=[],
                total=0,
                offset=offset,
                limit=limit,
                has_more=False,
                limits=limits,
            )
        page = await self._dataset_repository.list_datasets(
            namespace=namespace,
            offset=offset,
            limit=limit,
        )
        items = [
            PersistedEvaluationDatasetMetadata(
                dataset_id=item.dataset_id,
                namespace=item.namespace,
                name=item.name,
                description=item.description,
                schema_version=item.schema_version,
                digest=item.digest,
                case_count=item.case_count,
                decoded_bytes=item.decoded_bytes,
                created_at=item.created_at,
                expires_at=item.expires_at,
            )
            for item in page.items
        ]
        return PersistedEvaluationDatasetListResponse(
            storage_mode="postgres",
            persistence_enabled=True,
            items=items,
            total=page.total,
            offset=offset,
            limit=limit,
            has_more=offset + len(items) < page.total,
            limits=limits,
        )

    async def persisted_dataset_detail(
        self,
        dataset_id: str,
        *,
        authorized_namespaces: AuthorizedNamespaceScope,
    ) -> PersistedEvaluationDatasetDetail:
        repository = self._require_dataset_repository()
        record = await repository.get_dataset(
            dataset_id,
            authorized_namespaces=authorized_namespaces,
        )
        if record is None:
            raise EvaluationDatasetNotFoundError
        return _persisted_detail(record)

    async def persist_dataset(
        self,
        request: PersistEvaluationDatasetRequest,
        *,
        namespace: str,
    ) -> PersistedEvaluationDatasetDetail:
        repository = self._require_dataset_repository()
        runtime = self._runtime_configuration
        retention_days = (
            runtime.evaluation_dataset_default_retention_days
            if request.retention_days is None
            else request.retention_days
        )
        if retention_days > runtime.evaluation_dataset_max_retention_days:
            raise EvaluationDatasetRetentionError
        validated = self._validate_inline(
            request.dataset,
            repetitions=1,
            threshold_count=2,
        )
        record = await repository.create_dataset(
            namespace=namespace,
            validated=validated,
            retention_days=retention_days,
        )
        return _persisted_detail(record)

    async def delete_persisted_dataset(
        self,
        dataset_id: str,
        *,
        namespace: str,
    ) -> None:
        repository = self._require_dataset_repository()
        if not await repository.delete_dataset(dataset_id, namespace=namespace):
            raise EvaluationDatasetNotFoundError

    async def dataset_catalog_readiness(self) -> None:
        if self._dataset_repository is not None:
            await self._dataset_repository.readiness()

    def _require_dataset_repository(self) -> EvaluationDatasetRepository:
        if self._dataset_repository is None:
            raise EvaluationDatasetPersistenceDisabledError
        return self._dataset_repository

    def _validate_inline(
        self,
        definition: object,
        *,
        repetitions: int,
        threshold_count: int,
    ) -> ValidatedImportedDataset:
        runtime = self._runtime_configuration
        return validate_imported_dataset(
            definition,
            repetitions=repetitions,
            threshold_count=threshold_count,
            max_cases=runtime.evaluation_dataset_max_cases,
            max_decoded_bytes=runtime.evaluation_dataset_max_decoded_bytes,
            max_workload_queries=runtime.evaluation_max_workload_queries,
        )

    def _accept_run(
        self,
        dataset: BenchmarkDataset,
        *,
        history_namespace: str | None = None,
        source_dataset_expires_at: datetime | None = None,
    ) -> AcceptedEvaluationRunContext:
        return AcceptedEvaluationRunContext(
            run_id=uuid4().hex,
            accepted_at=datetime.now(UTC),
            dataset=dataset.summary,
            history_namespace=history_namespace,
            source_dataset_expires_at=source_dataset_expires_at,
        )

    async def _run_accepted(
        self,
        request: EvaluationRunOptions,
        dataset: BenchmarkDataset,
        accepted_run: AcceptedEvaluationRunContext,
    ) -> BenchmarkRunResponse:
        response = await self._run_bounded(request, dataset, accepted_run)
        return await self._history_recorder.retain_completed(accepted_run, response)

    async def _run_bounded(
        self,
        request: EvaluationRunOptions,
        dataset: BenchmarkDataset,
        accepted_run: AcceptedEvaluationRunContext,
    ) -> BenchmarkRunResponse:
        try:
            async with asyncio.timeout(
                self._runtime_configuration.evaluation_timeout_seconds
            ):
                async with self._run_lock:
                    return await self._run_exclusive(request, dataset, accepted_run)
        except TimeoutError as exc:
            raise EvaluationTimeoutError from exc

    def _create_run_cache(self, threshold: float) -> SemanticCache:
        return SemanticCache(
            self._embedding_service,
            InMemoryCacheBackend(
                self._max_cache_size,
                self._cache_ttl_seconds,
                dimensions=self._runtime_configuration.embedding_dimensions,
            ),
            threshold,
            prompt_normalizer=self._prompt_normalizer,
        )

    async def _execute_case(
        self,
        cache: SemanticCache,
        case: BenchmarkCase,
        *,
        sequence: int,
        repetition: int,
    ) -> tuple[BenchmarkQueryResult, BenchmarkObservation]:
        measured_at = perf_counter()
        lookup = await cache.lookup(case.prompt)
        if lookup.cache_hit:
            if lookup.response is None:
                raise RuntimeError("Validated benchmark hit had no response")
            response = lookup.response
        else:
            response = validate_generation_response(
                await self._provider.generate(case.prompt)
            )
            await cache.store(case.prompt, response, lookup.embedding)
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
            expected_match_case_id=case.expected_match_case_id,
            note=case.note,
            actual_cache_hit=lookup.cache_hit,
            correct=case.expected_cache_hit == lookup.cache_hit,
            outcome=_classification(case.expected_cache_hit, lookup.cache_hit),
            similarity_score=lookup.similarity_score,
            latency_ms=latency_ms,
            provider_called=not lookup.cache_hit,
            matched_prompt=lookup.matched_prompt,
            matched_cache_key=lookup.matched_cache_key,
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
        request: EvaluationRunOptions,
        dataset: BenchmarkDataset,
        accepted_run: AcceptedEvaluationRunContext,
    ) -> BenchmarkRunResponse:
        started_at = datetime.now(UTC)
        run_cache = self._create_run_cache(request.threshold)

        query_results: list[BenchmarkQueryResult] = []
        observations: list[BenchmarkObservation] = []
        sequence = 0
        for repetition in range(1, request.repetitions + 1):
            if request.reset_cache_before_run:
                await run_cache.clear()
            for case in dataset.cases:
                sequence += 1
                result, observation = await self._execute_case(
                    run_cache,
                    case,
                    sequence=sequence,
                    repetition=repetition,
                )
                query_results.append(result)
                observations.append(observation)

        thresholds = request.evaluation_thresholds
        reproducibility = self._reproducibility_metadata(
            request,
            dataset_id=dataset.summary.dataset_id,
            dataset_source=dataset.summary.dataset_source,
            dataset_schema_version=dataset.summary.schema_version,
            dataset_version=dataset.summary.version,
            dataset_digest=dataset.summary.digest,
        )
        return BenchmarkRunResponse(
            run_id=accepted_run.run_id,
            started_at=started_at,
            completed_at=datetime.now(UTC),
            dataset=dataset.summary,
            threshold=request.threshold,
            repetitions=request.repetitions,
            reset_cache_before_run=request.reset_cache_before_run,
            estimated_cost_per_request_usd=request.estimated_cost_per_request_usd,
            estimated_cost_per_1k_tokens_usd=(request.estimated_cost_per_1k_tokens_usd),
            reproducibility=reproducibility,
            metrics=calculate_metrics(
                observations,
                estimated_cost_per_request_usd=(request.estimated_cost_per_request_usd),
                estimated_cost_per_1k_tokens_usd=(
                    request.estimated_cost_per_1k_tokens_usd
                ),
            ),
            threshold_evaluation_mode="frozen_candidate_projection",
            threshold_evaluations=evaluate_frozen_candidate_thresholds(
                observations,
                thresholds,
                measured_threshold=request.threshold,
            ),
            query_results=query_results,
        )

    def _reproducibility_metadata(
        self,
        request: EvaluationRunOptions,
        *,
        dataset_id: str,
        dataset_source: EvaluationDatasetSourceKind,
        dataset_schema_version: int | None,
        dataset_version: str,
        dataset_digest: str,
    ) -> BenchmarkReproducibilityMetadata:
        runtime = self._runtime_configuration
        safe_configuration = {
            "application_version": runtime.application_version,
            "dataset_id": dataset_id,
            "dataset_source": dataset_source,
            "dataset_schema_version": dataset_schema_version,
            "dataset_version": dataset_version,
            "dataset_digest": dataset_digest,
            "embedding_provider_category": runtime.embedding_provider_category,
            "generation_provider_category": runtime.generation_provider_category,
            "generation_configuration_fingerprint": (
                runtime.generation_configuration_fingerprint
            ),
            "comparison_contract_version": 1,
            "embedding_dimensions": runtime.embedding_dimensions,
            "embedding_space_fingerprint": runtime.embedding_space_fingerprint,
            "normalization_mode": runtime.normalization_mode,
            "normalization_fingerprint": runtime.normalization_fingerprint,
            "measured_threshold": request.threshold,
            "evaluation_thresholds": request.evaluation_thresholds,
            "repetitions": request.repetitions,
            "reset_cache_before_run": request.reset_cache_before_run,
            "estimated_cost_per_request_usd": (request.estimated_cost_per_request_usd),
            "estimated_cost_per_1k_tokens_usd": (
                request.estimated_cost_per_1k_tokens_usd
            ),
            "evaluation_timeout_seconds": runtime.evaluation_timeout_seconds,
        }
        canonical = json.dumps(
            safe_configuration,
            separators=(",", ":"),
            sort_keys=True,
        )
        return BenchmarkReproducibilityMetadata(
            **safe_configuration,
            configuration_fingerprint=hashlib.sha256(
                canonical.encode("utf-8")
            ).hexdigest(),
        )
