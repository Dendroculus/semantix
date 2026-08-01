from dataclasses import dataclass

from app.benchmark.api.schemas import (
    BenchmarkCategory,
    BenchmarkDatasetSummary,
    NormalizationMode,
    ProviderCategory,
)
from app.core.limits import (
    DEFAULT_EVALUATION_DATASET_MAX_CASES,
    DEFAULT_EVALUATION_DATASET_MAX_DECODED_BYTES,
    DEFAULT_EVALUATION_MAX_WORKLOAD_QUERIES,
)


@dataclass(frozen=True, slots=True)
class BenchmarkCase:
    case_id: str
    category: BenchmarkCategory
    prompt: str
    expected_cache_hit: bool
    expected_match_case_id: str | None = None
    note: str | None = None


@dataclass(frozen=True, slots=True)
class BenchmarkDataset:
    summary: BenchmarkDatasetSummary
    cases: tuple[BenchmarkCase, ...]


@dataclass(frozen=True, slots=True)
class BenchmarkObservation:
    expected_cache_hit: bool
    actual_cache_hit: bool
    latency_ms: float
    provider_called: bool
    similarity_score: float | None
    estimated_tokens_saved: int = 0


@dataclass(frozen=True, slots=True)
class BenchmarkRuntimeConfiguration:
    application_version: str
    embedding_provider_category: ProviderCategory
    generation_provider_category: ProviderCategory
    embedding_dimensions: int
    embedding_space_fingerprint: str
    normalization_mode: NormalizationMode
    normalization_fingerprint: str
    evaluation_timeout_seconds: float
    evaluation_dataset_max_cases: int = DEFAULT_EVALUATION_DATASET_MAX_CASES
    evaluation_dataset_max_decoded_bytes: int = (
        DEFAULT_EVALUATION_DATASET_MAX_DECODED_BYTES
    )
    evaluation_max_workload_queries: int = DEFAULT_EVALUATION_MAX_WORKLOAD_QUERIES
