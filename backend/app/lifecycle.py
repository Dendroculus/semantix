import hashlib
import json
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

import httpx
from fastapi import FastAPI

from app.benchmark.application.service import BenchmarkService
from app.benchmark.domain.models import BenchmarkRuntimeConfiguration
from app.benchmark.domain.protocols import EvaluationDatasetRepository
from app.benchmark.infrastructure.postgres_repository import (
    PostgresEvaluationDatasetRepository,
)
from app.cache.application.service import SemanticCache
from app.cache.infrastructure.factory import cache_backend_lifespan
from app.core.config import Settings
from app.core.version import API_VERSION
from app.embedding.service import EmbeddingService
from app.infrastructure.lifecycle import database_pool_lifespan
from app.observability.metrics import RuntimeMetrics
from app.providers.configuration import selected_generation_configuration
from app.providers.factory import create_provider_bundle
from app.query.application.service import QueryService
from app.query.domain.normalization import create_prompt_normalizer

Lifespan = Callable[
    [FastAPI],
    AbstractAsyncContextManager[None],
]


def create_lifespan(settings: Settings) -> Lifespan:
    @asynccontextmanager
    async def lifespan(
        application: FastAPI,
    ) -> AsyncIterator[None]:
        prompt_normalizer = create_prompt_normalizer(
            enabled=settings.prompt_typo_correction_enabled,
            max_edit_distance=settings.prompt_typo_max_edit_distance,
        )
        runtime_metrics = RuntimeMetrics()
        timeout = httpx.Timeout(
            settings.provider_timeout_seconds,
        )

        async with httpx.AsyncClient(timeout=timeout) as client:
            providers = create_provider_bundle(
                client,
                settings,
            )
            embedding_service = EmbeddingService(
                providers.embedding_provider,
                dimensions=providers.embedding_dimensions,
            )

            async with (
                database_pool_lifespan(settings) as database_pool,
                cache_backend_lifespan(
                    settings,
                    dimensions=providers.embedding_dimensions,
                    events=runtime_metrics,
                    pool=database_pool,
                ) as backend,
            ):
                dataset_repository: EvaluationDatasetRepository | None = None
                if settings.evaluation_dataset_storage == "postgres":
                    if database_pool is None:
                        raise RuntimeError(
                            "Persistent dataset storage requires a database pool"
                        )
                    dataset_repository = PostgresEvaluationDatasetRepository(
                        database_pool,
                        max_per_namespace=(
                            settings.evaluation_dataset_max_persisted_per_namespace
                        ),
                        cleanup_batch_size=(
                            settings.evaluation_dataset_cleanup_batch_size
                        ),
                    )
                semantic_cache = SemanticCache(
                    embedding_service,
                    backend,
                    settings.similarity_threshold,
                    prompt_normalizer=prompt_normalizer,
                    events=runtime_metrics,
                )
                application.state.embedding_provider = providers.embedding_provider
                application.state.generation_provider = providers.generation_provider
                application.state.semantic_cache = semantic_cache
                application.state.runtime_metrics = runtime_metrics
                application.state.query_service = QueryService(
                    semantic_cache,
                    providers.generation_provider,
                    metrics=runtime_metrics,
                )
                application.state.benchmark_service = BenchmarkService(
                    embedding_service,
                    providers.generation_provider,
                    max_cache_size=settings.max_cache_size,
                    cache_ttl_seconds=settings.cache_ttl_seconds,
                    prompt_normalizer=prompt_normalizer,
                    runtime_configuration=BenchmarkRuntimeConfiguration(
                        application_version=API_VERSION,
                        embedding_provider_category=settings.embedding_provider,
                        generation_provider_category=settings.generation_provider,
                        embedding_dimensions=providers.embedding_dimensions,
                        embedding_space_fingerprint=_fingerprint(
                            settings.embedding_space
                        ),
                        generation_configuration_fingerprint=_fingerprint(
                            selected_generation_configuration(settings)
                        ),
                        normalization_mode=(
                            "typo_correction"
                            if settings.prompt_typo_correction_enabled
                            else "identity"
                        ),
                        normalization_fingerprint=_fingerprint(
                            {
                                "mode": (
                                    "typo_correction"
                                    if settings.prompt_typo_correction_enabled
                                    else "identity"
                                ),
                                "max_edit_distance": (
                                    settings.prompt_typo_max_edit_distance
                                    if settings.prompt_typo_correction_enabled
                                    else None
                                ),
                            }
                        ),
                        evaluation_timeout_seconds=(
                            settings.evaluation_timeout_seconds
                        ),
                        evaluation_dataset_max_cases=(
                            settings.evaluation_dataset_max_cases
                        ),
                        evaluation_dataset_max_decoded_bytes=(
                            settings.evaluation_dataset_max_decoded_bytes
                        ),
                        evaluation_max_workload_queries=(
                            settings.evaluation_max_workload_queries
                        ),
                        evaluation_dataset_storage=(
                            settings.evaluation_dataset_storage
                        ),
                        evaluation_dataset_max_persisted_per_namespace=(
                            settings.evaluation_dataset_max_persisted_per_namespace
                        ),
                        evaluation_dataset_default_retention_days=(
                            settings.evaluation_dataset_default_retention_days
                        ),
                        evaluation_dataset_max_retention_days=(
                            settings.evaluation_dataset_max_retention_days
                        ),
                        evaluation_dataset_cleanup_batch_size=(
                            settings.evaluation_dataset_cleanup_batch_size
                        ),
                        evaluation_run_history_storage=(
                            settings.evaluation_run_history_storage
                        ),
                        evaluation_run_history_retention_days=(
                            settings.evaluation_run_history_retention_days
                        ),
                        evaluation_run_history_max_per_namespace=(
                            settings.evaluation_run_history_max_per_namespace
                        ),
                        evaluation_run_history_cleanup_batch_size=(
                            settings.evaluation_run_history_cleanup_batch_size
                        ),
                    ),
                    dataset_repository=dataset_repository,
                )

                yield

    return lifespan


def _fingerprint(value: object) -> str:
    canonical = json.dumps(value, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
