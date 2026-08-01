from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.api.schemas import StrictModel
from app.cache.domain.namespaces import CacheNamespace
from app.core.limits import (
    MAX_EVALUATION_CASE_ID_LENGTH,
    MAX_EVALUATION_CATEGORY_LENGTH,
    MAX_EVALUATION_DATASET_DESCRIPTION_LENGTH,
    MAX_EVALUATION_DATASET_NAME_LENGTH,
    MAX_EVALUATION_NOTE_LENGTH,
    MAX_PROMPT_LENGTH,
)

BenchmarkDatasetId = Literal["quick", "extended"]
BenchmarkCategory = str
BenchmarkOutcome = Literal[
    "true_positive",
    "true_negative",
    "false_positive",
    "false_negative",
]
ThresholdEvaluationMode = Literal["frozen_candidate_projection"]
ThresholdResultKind = Literal["measured", "projected"]
ProviderCategory = Literal[
    "huggingface",
    "openai",
    "anthropic",
    "gemini",
    "ollama",
    "mock",
]
NormalizationMode = Literal["identity", "typo_correction"]
EvaluationDatasetSourceKind = Literal["builtin", "inline", "persisted"]

DEFAULT_EVALUATION_THRESHOLDS = [0.70, 0.80, 0.85, 0.90, 0.92, 0.95, 0.98]
MAX_EVALUATION_THRESHOLDS = 15
MAX_BENCHMARK_REPETITIONS = 5
SHA256_PATTERN = r"^[a-f0-9]{64}$"


class BenchmarkDatasetSummary(StrictModel):
    dataset_id: str = Field(
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    dataset_source: EvaluationDatasetSourceKind = "builtin"
    schema_version: int | None = Field(default=None, ge=1)
    version: str = Field(min_length=1, max_length=50)
    digest: str = Field(pattern=SHA256_PATTERN)
    name: str = Field(min_length=1, max_length=MAX_EVALUATION_DATASET_NAME_LENGTH)
    description: str = Field(
        min_length=1,
        max_length=MAX_EVALUATION_DATASET_DESCRIPTION_LENGTH,
    )
    query_count: int = Field(ge=1)
    expected_hits: int = Field(ge=0)
    expected_misses: int = Field(ge=0)
    categories: list[BenchmarkCategory] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_counts(self) -> "BenchmarkDatasetSummary":
        if self.expected_hits + self.expected_misses != self.query_count:
            raise ValueError("Expected classifications must cover every query")
        if any(
            not category or len(category) > MAX_EVALUATION_CATEGORY_LENGTH
            for category in self.categories
        ):
            raise ValueError("Dataset categories are invalid")
        if len(self.categories) != len(set(self.categories)):
            raise ValueError("Dataset categories must be unique")
        if self.dataset_source == "builtin" and self.schema_version is not None:
            raise ValueError("Built-in datasets do not use an import schema version")
        if self.dataset_source in {"inline", "persisted"} and self.schema_version != 1:
            raise ValueError("Imported datasets must identify import schema version 1")
        return self


class BenchmarkDatasetListResponse(StrictModel):
    datasets: list[BenchmarkDatasetSummary] = Field(min_length=1)
    default_dataset_id: BenchmarkDatasetId


class EvaluationRunOptions(StrictModel):
    threshold: float = Field(default=0.92, ge=0, le=1)
    evaluation_thresholds: list[float] = Field(
        default_factory=lambda: list(DEFAULT_EVALUATION_THRESHOLDS),
        min_length=2,
        max_length=MAX_EVALUATION_THRESHOLDS,
    )
    repetitions: int = Field(default=1, ge=1, le=MAX_BENCHMARK_REPETITIONS)
    reset_cache_before_run: bool = True
    estimated_cost_per_request_usd: float = Field(default=0, ge=0, le=100)
    estimated_cost_per_1k_tokens_usd: float = Field(default=0, ge=0, le=100)
    allow_external_provider_calls: Literal[True]

    @field_validator("evaluation_thresholds")
    @classmethod
    def validate_evaluation_thresholds(cls, value: list[float]) -> list[float]:
        if any(threshold < 0 or threshold > 1 for threshold in value):
            raise ValueError("Evaluation thresholds must be between 0 and 1")
        unique = sorted(set(value))
        if len(unique) != len(value):
            raise ValueError("Evaluation thresholds must be unique")
        return unique

    @model_validator(mode="after")
    def include_measured_threshold(self) -> "EvaluationRunOptions":
        thresholds = sorted({*self.evaluation_thresholds, self.threshold})
        if len(thresholds) > MAX_EVALUATION_THRESHOLDS:
            raise ValueError(
                "Evaluation thresholds, including the measured threshold, "
                f"cannot exceed {MAX_EVALUATION_THRESHOLDS}"
            )
        self.evaluation_thresholds = thresholds
        return self


class BenchmarkRunRequest(EvaluationRunOptions):
    dataset_id: BenchmarkDatasetId = "quick"


class BuiltinEvaluationDatasetSource(StrictModel):
    kind: Literal["builtin"]
    dataset_id: BenchmarkDatasetId = "quick"


class InlineEvaluationDatasetSource(StrictModel):
    kind: Literal["inline"]
    definition: object


class PersistedEvaluationDatasetSource(StrictModel):
    kind: Literal["persisted"]
    dataset_id: UUID
    namespace: CacheNamespace | None = None


EvaluationDatasetSource = Annotated[
    BuiltinEvaluationDatasetSource
    | InlineEvaluationDatasetSource
    | PersistedEvaluationDatasetSource,
    Field(discriminator="kind"),
]


class EvaluationRunRequest(EvaluationRunOptions):
    dataset_source: EvaluationDatasetSource = Field(
        default_factory=lambda: BuiltinEvaluationDatasetSource(kind="builtin")
    )


class EvaluationDatasetValidationRequest(StrictModel):
    dataset: object
    repetitions: int = Field(default=1, ge=1, le=MAX_BENCHMARK_REPETITIONS)
    threshold_count: int = Field(default=2, ge=2, le=MAX_EVALUATION_THRESHOLDS)


class EvaluationDatasetValidationIssue(StrictModel):
    code: str = Field(min_length=1, max_length=100)
    detail: str = Field(min_length=1, max_length=300)
    pointer: str = Field(min_length=1, max_length=300)
    case_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
    )
    case_index: int | None = Field(default=None, ge=0)


class ImportedEvaluationCase(StrictModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        str_strip_whitespace=True,
    )

    case_id: str = Field(
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)
    expected_cache_hit: bool
    expected_match_case_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    category: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_CATEGORY_LENGTH,
    )
    note: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_NOTE_LENGTH,
    )


class ImportedEvaluationDatasetDefinition(StrictModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        str_strip_whitespace=True,
    )

    schema_version: Literal[1]
    name: str = Field(
        min_length=1,
        max_length=MAX_EVALUATION_DATASET_NAME_LENGTH,
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_DATASET_DESCRIPTION_LENGTH,
    )
    cases: list[ImportedEvaluationCase] = Field(min_length=1)


class EvaluationDatasetWarning(StrictModel):
    code: str = Field(min_length=1, max_length=100)
    detail: str = Field(min_length=1, max_length=300)
    count: int = Field(ge=1)


class EvaluationDatasetPreviewLimits(StrictModel):
    max_cases: int = Field(ge=1)
    max_decoded_bytes: int = Field(ge=1)
    max_workload_queries: int = Field(ge=1)


class EvaluationDatasetPreview(StrictModel):
    schema_version: Literal[1]
    dataset_id: str = Field(
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
    )
    digest: str = Field(pattern=SHA256_PATTERN)
    name: str = Field(min_length=1, max_length=MAX_EVALUATION_DATASET_NAME_LENGTH)
    description: str | None = Field(
        default=None,
        max_length=MAX_EVALUATION_DATASET_DESCRIPTION_LENGTH,
    )
    case_count: int = Field(ge=1)
    expected_hits: int = Field(ge=0)
    expected_misses: int = Field(ge=0)
    categories: list[str] = Field(min_length=1)
    decoded_bytes: int = Field(ge=1)
    warnings: list[EvaluationDatasetWarning]
    query_executions: int = Field(ge=1)
    threshold_projection_evaluations: int = Field(ge=2)
    maximum_provider_calls: int = Field(ge=1)
    provider_calls_made: Literal[0]
    limits: EvaluationDatasetPreviewLimits


class PersistedEvaluationDatasetMetadata(StrictModel):
    dataset_id: UUID
    namespace: CacheNamespace
    name: str = Field(min_length=1, max_length=MAX_EVALUATION_DATASET_NAME_LENGTH)
    description: str | None = Field(
        default=None,
        max_length=MAX_EVALUATION_DATASET_DESCRIPTION_LENGTH,
    )
    source_type: Literal["imported"] = "imported"
    schema_version: Literal[1]
    digest: str = Field(pattern=SHA256_PATTERN)
    case_count: int = Field(ge=1)
    decoded_bytes: int = Field(ge=1)
    created_at: datetime
    expires_at: datetime

    @field_validator("created_at", "expires_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Dataset timestamps must be timezone-aware")
        return value

    @model_validator(mode="after")
    def validate_retention(self) -> "PersistedEvaluationDatasetMetadata":
        if self.expires_at <= self.created_at:
            raise ValueError("Dataset expiry must follow creation")
        return self


class PersistedEvaluationDatasetCatalogLimits(StrictModel):
    default_retention_days: int = Field(ge=1)
    max_retention_days: int = Field(ge=1)
    max_persisted_per_namespace: int = Field(ge=1)


class PersistedEvaluationDatasetListResponse(StrictModel):
    storage_mode: Literal["session", "postgres"]
    persistence_enabled: bool
    items: list[PersistedEvaluationDatasetMetadata]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    has_more: bool
    limits: PersistedEvaluationDatasetCatalogLimits

    @model_validator(mode="after")
    def validate_page(self) -> "PersistedEvaluationDatasetListResponse":
        if self.persistence_enabled != (self.storage_mode == "postgres"):
            raise ValueError("Dataset storage capability is inconsistent")
        if len(self.items) > self.limit:
            raise ValueError("Dataset catalog page exceeds its requested limit")
        if self.has_more != (self.offset + len(self.items) < self.total):
            raise ValueError("Dataset catalog pagination is inconsistent")
        if not self.persistence_enabled and (self.items or self.total):
            raise ValueError("Disabled persistence cannot expose stored datasets")
        return self


class PersistedEvaluationDatasetDetail(PersistedEvaluationDatasetMetadata):
    cases: list[ImportedEvaluationCase] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_case_count(self) -> "PersistedEvaluationDatasetDetail":
        if len(self.cases) != self.case_count:
            raise ValueError("Persisted case evidence does not match metadata")
        return self


class PersistEvaluationDatasetRequest(StrictModel):
    namespace: CacheNamespace | None = None
    dataset: object
    retention_days: int | None = Field(default=None, ge=1, le=3_650)


class DeletePersistedEvaluationDatasetResponse(StrictModel):
    deleted: Literal[True]
    dataset_id: UUID
    namespace: CacheNamespace


class BenchmarkMetrics(StrictModel):
    total_queries: int = Field(ge=1)
    cache_hits: int = Field(ge=0)
    cache_misses: int = Field(ge=0)
    provider_calls: int = Field(ge=0)
    provider_calls_avoided: int = Field(ge=0)
    hit_rate: float = Field(ge=0, le=1)
    average_latency_ms: float = Field(ge=0)
    median_latency_ms: float = Field(ge=0)
    p95_latency_ms: float = Field(ge=0)
    average_cache_hit_latency_ms: float | None = Field(default=None, ge=0)
    average_cache_miss_latency_ms: float | None = Field(default=None, ge=0)
    estimated_latency_saved_ms: float = Field(ge=0)
    estimated_provider_cost_saved_usd: float = Field(ge=0)
    estimated_tokens_saved: int = Field(ge=0)
    true_positive_hits: int = Field(ge=0)
    true_negative_misses: int = Field(ge=0)
    false_positive_hits: int = Field(ge=0)
    false_negative_misses: int = Field(ge=0)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    f1_score: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_totals(self) -> "BenchmarkMetrics":
        if self.cache_hits + self.cache_misses != self.total_queries:
            raise ValueError("Cache classifications must cover every query")
        if self.provider_calls + self.provider_calls_avoided != self.total_queries:
            raise ValueError("Provider-call totals must cover every query")
        confusion_total = (
            self.true_positive_hits
            + self.true_negative_misses
            + self.false_positive_hits
            + self.false_negative_misses
        )
        if confusion_total != self.total_queries:
            raise ValueError("Confusion-matrix totals must cover every query")
        if self.true_positive_hits + self.false_positive_hits != self.cache_hits:
            raise ValueError("Positive classifications must equal cache hits")
        if self.true_negative_misses + self.false_negative_misses != self.cache_misses:
            raise ValueError("Negative classifications must equal cache misses")
        if (
            self.provider_calls != self.cache_misses
            or self.provider_calls_avoided != self.cache_hits
        ):
            raise ValueError("Provider-call totals must match cache decisions")
        return self


class BenchmarkQueryResult(StrictModel):
    sequence: int = Field(ge=1)
    repetition: int = Field(ge=1)
    case_id: str = Field(min_length=1, max_length=100)
    category: BenchmarkCategory = Field(
        min_length=1,
        max_length=MAX_EVALUATION_CATEGORY_LENGTH,
    )
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)
    expected_cache_hit: bool
    expected_match_case_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
    )
    note: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_EVALUATION_NOTE_LENGTH,
    )
    actual_cache_hit: bool
    correct: bool
    outcome: BenchmarkOutcome
    similarity_score: float | None = Field(default=None, ge=-1, le=1)
    latency_ms: float = Field(ge=0)
    provider_called: bool
    matched_prompt: str | None = Field(
        default=None, min_length=1, max_length=MAX_PROMPT_LENGTH
    )
    matched_cache_key: str | None = Field(default=None, pattern=SHA256_PATTERN)

    @model_validator(mode="after")
    def validate_evidence(self) -> "BenchmarkQueryResult":
        expected_outcome: BenchmarkOutcome
        if self.actual_cache_hit:
            expected_outcome = (
                "true_positive" if self.expected_cache_hit else "false_positive"
            )
        else:
            expected_outcome = (
                "false_negative" if self.expected_cache_hit else "true_negative"
            )
        if self.outcome != expected_outcome:
            raise ValueError("Query outcome does not match its cache decisions")
        if self.correct != (self.expected_cache_hit == self.actual_cache_hit):
            raise ValueError("Query correctness does not match its cache decisions")
        if not self.expected_cache_hit and self.expected_match_case_id is not None:
            raise ValueError("Expected misses cannot identify an expected match")
        if self.provider_called == self.actual_cache_hit:
            raise ValueError("Provider-call evidence does not match the cache decision")
        if self.actual_cache_hit and (
            self.matched_prompt is None or self.matched_cache_key is None
        ):
            raise ValueError("Cache-hit evidence must identify the matched entry")
        if not self.actual_cache_hit and (
            self.matched_prompt is not None or self.matched_cache_key is not None
        ):
            raise ValueError("Cache-miss evidence cannot identify a matched entry")
        return self


class ThresholdEvaluation(StrictModel):
    threshold: float = Field(ge=0, le=1)
    result_kind: ThresholdResultKind
    hit_rate: float = Field(ge=0, le=1)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    f1_score: float = Field(ge=0, le=1)
    average_latency_ms: float = Field(ge=0)
    provider_calls_avoided: int = Field(ge=0)
    true_positive_hits: int = Field(ge=0)
    true_negative_misses: int = Field(ge=0)
    false_positive_hits: int = Field(ge=0)
    false_negative_misses: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_totals(self) -> "ThresholdEvaluation":
        projected_hits = self.true_positive_hits + self.false_positive_hits
        if projected_hits != self.provider_calls_avoided:
            raise ValueError(
                "Projected hits must equal projected provider calls avoided"
            )
        return self


class BenchmarkReproducibilityMetadata(StrictModel):
    application_version: str = Field(min_length=1, max_length=50)
    dataset_id: str = Field(
        min_length=1,
        max_length=MAX_EVALUATION_CASE_ID_LENGTH,
    )
    dataset_source: EvaluationDatasetSourceKind
    dataset_schema_version: int | None = Field(default=None, ge=1)
    dataset_version: str = Field(min_length=1, max_length=50)
    dataset_digest: str = Field(pattern=SHA256_PATTERN)
    embedding_provider_category: ProviderCategory
    generation_provider_category: ProviderCategory
    embedding_dimensions: int = Field(gt=0)
    embedding_space_fingerprint: str = Field(pattern=SHA256_PATTERN)
    normalization_mode: NormalizationMode
    normalization_fingerprint: str = Field(pattern=SHA256_PATTERN)
    measured_threshold: float = Field(ge=0, le=1)
    evaluation_thresholds: list[float] = Field(
        min_length=2,
        max_length=MAX_EVALUATION_THRESHOLDS,
    )
    repetitions: int = Field(ge=1, le=MAX_BENCHMARK_REPETITIONS)
    reset_cache_before_run: bool
    estimated_cost_per_request_usd: float = Field(ge=0, le=100)
    estimated_cost_per_1k_tokens_usd: float = Field(ge=0, le=100)
    evaluation_timeout_seconds: float = Field(gt=0, le=3_600)
    configuration_fingerprint: str = Field(pattern=SHA256_PATTERN)

    @field_validator("evaluation_thresholds")
    @classmethod
    def validate_thresholds(cls, value: list[float]) -> list[float]:
        if any(threshold < 0 or threshold > 1 for threshold in value):
            raise ValueError("Evaluation thresholds must be between 0 and 1")
        if value != sorted(set(value)):
            raise ValueError("Evaluation thresholds must be ordered and unique")
        return value


class BenchmarkRunResponse(StrictModel):
    run_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    started_at: datetime
    completed_at: datetime
    dataset: BenchmarkDatasetSummary
    threshold: float = Field(ge=0, le=1)
    repetitions: int = Field(ge=1, le=MAX_BENCHMARK_REPETITIONS)
    reset_cache_before_run: bool
    estimated_cost_per_request_usd: float = Field(ge=0)
    estimated_cost_per_1k_tokens_usd: float = Field(ge=0)
    reproducibility: BenchmarkReproducibilityMetadata
    metrics: BenchmarkMetrics
    threshold_evaluation_mode: ThresholdEvaluationMode
    threshold_evaluations: list[ThresholdEvaluation] = Field(
        min_length=2,
        max_length=MAX_EVALUATION_THRESHOLDS,
    )
    query_results: list[BenchmarkQueryResult] = Field(min_length=1)

    @field_validator("started_at", "completed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Benchmark timestamps must be timezone-aware")
        return value

    @model_validator(mode="after")
    def validate_run(self) -> "BenchmarkRunResponse":
        if self.completed_at < self.started_at:
            raise ValueError("Benchmark completion cannot precede its start")
        if len(self.query_results) != self.dataset.query_count * self.repetitions:
            raise ValueError("Benchmark results do not match the requested workload")
        total_queries = len(self.query_results)
        outcomes = {
            outcome: sum(result.outcome == outcome for result in self.query_results)
            for outcome in (
                "true_positive",
                "true_negative",
                "false_positive",
                "false_negative",
            )
        }
        if (
            self.metrics.total_queries != total_queries
            or self.metrics.true_positive_hits != outcomes["true_positive"]
            or self.metrics.true_negative_misses != outcomes["true_negative"]
            or self.metrics.false_positive_hits != outcomes["false_positive"]
            or self.metrics.false_negative_misses != outcomes["false_negative"]
            or self.metrics.provider_calls
            != sum(result.provider_called for result in self.query_results)
        ):
            raise ValueError("Benchmark metrics do not match query evidence")

        thresholds = [evaluation.threshold for evaluation in self.threshold_evaluations]
        measured = [
            evaluation
            for evaluation in self.threshold_evaluations
            if evaluation.result_kind == "measured"
        ]
        if thresholds != sorted(set(thresholds)):
            raise ValueError("Threshold evaluations must be ordered and unique")
        if len(measured) != 1 or measured[0].threshold != self.threshold:
            raise ValueError("The measured threshold must appear exactly once")
        for evaluation in self.threshold_evaluations:
            confusion_total = (
                evaluation.true_positive_hits
                + evaluation.true_negative_misses
                + evaluation.false_positive_hits
                + evaluation.false_negative_misses
            )
            if confusion_total != total_queries:
                raise ValueError(
                    "Threshold confusion-matrix totals must cover every query"
                )

        metadata = self.reproducibility
        if (
            metadata.dataset_id != self.dataset.dataset_id
            or metadata.dataset_source != self.dataset.dataset_source
            or metadata.dataset_schema_version != self.dataset.schema_version
            or metadata.dataset_version != self.dataset.version
            or metadata.dataset_digest != self.dataset.digest
            or metadata.measured_threshold != self.threshold
            or metadata.evaluation_thresholds != thresholds
            or metadata.repetitions != self.repetitions
            or metadata.reset_cache_before_run != self.reset_cache_before_run
            or metadata.estimated_cost_per_request_usd
            != self.estimated_cost_per_request_usd
            or metadata.estimated_cost_per_1k_tokens_usd
            != self.estimated_cost_per_1k_tokens_usd
        ):
            raise ValueError("Reproducibility metadata does not match the run")
        return self
