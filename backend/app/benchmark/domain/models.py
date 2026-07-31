from dataclasses import dataclass

from app.benchmark.api.schemas import (
    BenchmarkCategory,
    BenchmarkDatasetSummary,
    NormalizationMode,
    ProviderCategory,
)


@dataclass(frozen=True, slots=True)
class BenchmarkCase:
    case_id: str
    category: BenchmarkCategory
    prompt: str
    expected_cache_hit: bool


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
