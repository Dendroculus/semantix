from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.models.schemas import MAX_PROMPT_LENGTH, StrictModel

BenchmarkDatasetId = Literal["quick", "extended"]
BenchmarkCategory = Literal[
    "seed",
    "exact_duplicate",
    "paraphrase",
    "unrelated",
    "typo",
    "negation",
    "different_intent",
]
BenchmarkOutcome = Literal[
    "true_positive",
    "true_negative",
    "false_positive",
    "false_negative",
]

DEFAULT_EVALUATION_THRESHOLDS = [0.70, 0.80, 0.85, 0.90, 0.92, 0.95, 0.98]


class BenchmarkDatasetSummary(StrictModel):
    dataset_id: BenchmarkDatasetId
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=300)
    query_count: int = Field(ge=1)
    expected_hits: int = Field(ge=0)
    expected_misses: int = Field(ge=0)
    categories: list[BenchmarkCategory] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_counts(self) -> "BenchmarkDatasetSummary":
        if self.expected_hits + self.expected_misses != self.query_count:
            raise ValueError("Expected classifications must cover every query")
        return self


class BenchmarkDatasetListResponse(StrictModel):
    datasets: list[BenchmarkDatasetSummary] = Field(min_length=1)
    default_dataset_id: BenchmarkDatasetId


class BenchmarkRunRequest(StrictModel):
    dataset_id: BenchmarkDatasetId = "quick"
    threshold: float = Field(default=0.92, ge=0, le=1)
    evaluation_thresholds: list[float] = Field(
        default_factory=lambda: list(DEFAULT_EVALUATION_THRESHOLDS),
        min_length=2,
        max_length=15,
    )
    repetitions: int = Field(default=1, ge=1, le=5)
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
        return self


class BenchmarkQueryResult(StrictModel):
    sequence: int = Field(ge=1)
    repetition: int = Field(ge=1)
    case_id: str = Field(min_length=1, max_length=100)
    category: BenchmarkCategory
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)
    expected_cache_hit: bool
    actual_cache_hit: bool
    correct: bool
    outcome: BenchmarkOutcome
    similarity_score: float | None = Field(default=None, ge=-1, le=1)
    latency_ms: float = Field(ge=0)
    provider_called: bool
    matched_prompt: str | None = Field(
        default=None, min_length=1, max_length=MAX_PROMPT_LENGTH
    )


class ThresholdEvaluation(StrictModel):
    threshold: float = Field(ge=0, le=1)
    hit_rate: float = Field(ge=0, le=1)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    f1_score: float = Field(ge=0, le=1)
    average_latency_ms: float = Field(ge=0)
    provider_calls_avoided: int = Field(ge=0)
    false_positive_hits: int = Field(ge=0)
    false_negative_misses: int = Field(ge=0)


class BenchmarkRunResponse(StrictModel):
    run_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    started_at: datetime
    completed_at: datetime
    dataset: BenchmarkDatasetSummary
    threshold: float = Field(ge=0, le=1)
    repetitions: int = Field(ge=1, le=5)
    reset_cache_before_run: bool
    estimated_cost_per_request_usd: float = Field(ge=0)
    estimated_cost_per_1k_tokens_usd: float = Field(ge=0)
    metrics: BenchmarkMetrics
    threshold_evaluations: list[ThresholdEvaluation] = Field(min_length=2)
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
        return self
