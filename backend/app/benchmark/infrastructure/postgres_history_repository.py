from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import cast
from uuid import UUID

import asyncpg
from asyncpg import Connection, Record
from asyncpg.pool import Pool

from app.benchmark.api.schemas import (
    BenchmarkDatasetSummary,
    BenchmarkMetrics,
    BenchmarkReproducibilityMetadata,
    ThresholdEvaluation,
    ThresholdEvaluationMode,
)
from app.benchmark.domain.models import (
    AcceptedEvaluationRunContext,
    EvaluationRunHistoryRecord,
    EvaluationRunTerminalState,
    RetainedEvaluationRun,
    RetainedEvaluationRunPage,
    RetainedEvaluationRunSummary,
)
from app.cache.domain.namespaces import AuthorizedNamespaceScope
from app.core.exceptions import (
    AppError,
    EvaluationRunHistoryStorageError,
)

PURGE_EXPIRED_HISTORY = """
DELETE FROM semantix.evaluation_runs
WHERE run_id IN (
    SELECT run_id
    FROM semantix.evaluation_runs
    WHERE expires_at <= CURRENT_TIMESTAMP
      AND ($1::text IS NULL OR namespace = $1)
    ORDER BY expires_at, run_id
    LIMIT $2
)
"""

PRUNE_OLDEST_ACTIVE_HISTORY = """
DELETE FROM semantix.evaluation_runs
WHERE run_id IN (
    SELECT run_id
    FROM semantix.evaluation_runs
    WHERE namespace = $1
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY completed_at ASC, run_id ASC
    LIMIT $2
)
"""

_RUN_COLUMNS = (
    "run_id",
    "namespace",
    "source_dataset_id",
    "source_dataset_expires_at",
    "terminal_state",
    "accepted_at",
    "started_at",
    "completed_at",
    "expires_at",
    "dataset_id",
    "dataset_source",
    "dataset_schema_version",
    "dataset_version",
    "dataset_digest",
    "dataset_name",
    "dataset_description",
    "dataset_query_count",
    "dataset_expected_hits",
    "dataset_expected_misses",
    "dataset_categories",
    "application_version",
    "embedding_provider_category",
    "generation_provider_category",
    "generation_configuration_fingerprint",
    "comparison_contract_version",
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
    "threshold_evaluation_mode",
    "total_queries",
    "cache_hits",
    "cache_misses",
    "provider_calls",
    "provider_calls_avoided",
    "hit_rate",
    "average_latency_ms",
    "median_latency_ms",
    "p95_latency_ms",
    "average_cache_hit_latency_ms",
    "average_cache_miss_latency_ms",
    "estimated_latency_saved_ms",
    "estimated_provider_cost_saved_usd",
    "estimated_tokens_saved",
    "true_positive_hits",
    "true_negative_misses",
    "false_positive_hits",
    "false_negative_misses",
    "precision",
    "recall",
    "f1_score",
    "failure_code",
    "safe_failure_detail",
)

INSERT_RUN = (
    "INSERT INTO semantix.evaluation_runs ("
    + ", ".join(_RUN_COLUMNS)
    + ") VALUES ("
    + ", ".join(f"${index}" for index in range(1, len(_RUN_COLUMNS) + 1))
    + ")"
)

INSERT_THRESHOLD = """
INSERT INTO semantix.evaluation_run_thresholds (
    run_id,
    sequence,
    threshold,
    result_kind,
    hit_rate,
    precision,
    recall,
    f1_score,
    average_latency_ms,
    provider_calls_avoided,
    true_positive_hits,
    true_negative_misses,
    false_positive_hits,
    false_negative_misses
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, $11, $12, $13, $14
)
"""


def _metrics_values(metrics: BenchmarkMetrics | None) -> tuple[object, ...]:
    if metrics is None:
        return (None,) * 21

    return (
        metrics.total_queries,
        metrics.cache_hits,
        metrics.cache_misses,
        metrics.provider_calls,
        metrics.provider_calls_avoided,
        metrics.hit_rate,
        metrics.average_latency_ms,
        metrics.median_latency_ms,
        metrics.p95_latency_ms,
        metrics.average_cache_hit_latency_ms,
        metrics.average_cache_miss_latency_ms,
        metrics.estimated_latency_saved_ms,
        metrics.estimated_provider_cost_saved_usd,
        metrics.estimated_tokens_saved,
        metrics.true_positive_hits,
        metrics.true_negative_misses,
        metrics.false_positive_hits,
        metrics.false_negative_misses,
        metrics.precision,
        metrics.recall,
        metrics.f1_score,
    )


RUN_SELECT_COLUMNS = ", ".join(_RUN_COLUMNS)


def _dataset_summary_from_record(row: Record) -> BenchmarkDatasetSummary:
    return BenchmarkDatasetSummary.model_validate(
        {
            "dataset_id": row["dataset_id"],
            "dataset_source": row["dataset_source"],
            "schema_version": row["dataset_schema_version"],
            "version": row["dataset_version"],
            "digest": row["dataset_digest"],
            "name": row["dataset_name"],
            "description": row["dataset_description"],
            "query_count": row["dataset_query_count"],
            "expected_hits": row["dataset_expected_hits"],
            "expected_misses": row["dataset_expected_misses"],
            "categories": row["dataset_categories"],
        }
    )


def _reproducibility_from_record(
    row: Record,
) -> BenchmarkReproducibilityMetadata:
    return BenchmarkReproducibilityMetadata.model_validate(
        {
            "application_version": row["application_version"],
            "dataset_id": row["dataset_id"],
            "dataset_source": row["dataset_source"],
            "dataset_schema_version": row["dataset_schema_version"],
            "dataset_version": row["dataset_version"],
            "dataset_digest": row["dataset_digest"],
            "embedding_provider_category": row["embedding_provider_category"],
            "generation_provider_category": row["generation_provider_category"],
            "generation_configuration_fingerprint": row[
                "generation_configuration_fingerprint"
            ],
            "comparison_contract_version": row["comparison_contract_version"],
            "embedding_dimensions": row["embedding_dimensions"],
            "embedding_space_fingerprint": row["embedding_space_fingerprint"],
            "normalization_mode": row["normalization_mode"],
            "normalization_fingerprint": row["normalization_fingerprint"],
            "measured_threshold": row["measured_threshold"],
            "evaluation_thresholds": row["evaluation_thresholds"],
            "repetitions": row["repetitions"],
            "reset_cache_before_run": row["reset_cache_before_run"],
            "estimated_cost_per_request_usd": row["estimated_cost_per_request_usd"],
            "estimated_cost_per_1k_tokens_usd": row["estimated_cost_per_1k_tokens_usd"],
            "evaluation_timeout_seconds": row["evaluation_timeout_seconds"],
            "configuration_fingerprint": row["configuration_fingerprint"],
        }
    )


def _metrics_from_record(row: Record) -> BenchmarkMetrics | None:
    if row["total_queries"] is None:
        return None

    return BenchmarkMetrics.model_validate(
        {
            "total_queries": row["total_queries"],
            "cache_hits": row["cache_hits"],
            "cache_misses": row["cache_misses"],
            "provider_calls": row["provider_calls"],
            "provider_calls_avoided": row["provider_calls_avoided"],
            "hit_rate": row["hit_rate"],
            "average_latency_ms": row["average_latency_ms"],
            "median_latency_ms": row["median_latency_ms"],
            "p95_latency_ms": row["p95_latency_ms"],
            "average_cache_hit_latency_ms": row["average_cache_hit_latency_ms"],
            "average_cache_miss_latency_ms": row["average_cache_miss_latency_ms"],
            "estimated_latency_saved_ms": row["estimated_latency_saved_ms"],
            "estimated_provider_cost_saved_usd": row[
                "estimated_provider_cost_saved_usd"
            ],
            "estimated_tokens_saved": row["estimated_tokens_saved"],
            "true_positive_hits": row["true_positive_hits"],
            "true_negative_misses": row["true_negative_misses"],
            "false_positive_hits": row["false_positive_hits"],
            "false_negative_misses": row["false_negative_misses"],
            "precision": row["precision"],
            "recall": row["recall"],
            "f1_score": row["f1_score"],
        }
    )


def _summary_from_record(row: Record) -> RetainedEvaluationRunSummary:
    try:
        context = AcceptedEvaluationRunContext(
            run_id=cast(UUID, row["run_id"]).hex,
            accepted_at=cast(datetime, row["accepted_at"]),
            dataset=_dataset_summary_from_record(row),
            history_namespace=str(row["namespace"]),
            source_dataset_expires_at=cast(
                datetime | None,
                row["source_dataset_expires_at"],
            ),
        )
        return RetainedEvaluationRunSummary(
            context=context,
            terminal_state=cast(
                EvaluationRunTerminalState,
                str(row["terminal_state"]),
            ),
            started_at=cast(datetime, row["started_at"]),
            completed_at=cast(datetime, row["completed_at"]),
            expires_at=cast(datetime, row["expires_at"]),
            reproducibility=_reproducibility_from_record(row),
            metrics=_metrics_from_record(row),
            failure_code=(
                None if row["failure_code"] is None else str(row["failure_code"])
            ),
            safe_failure_detail=(
                None
                if row["safe_failure_detail"] is None
                else str(row["safe_failure_detail"])
            ),
        )
    except (KeyError, TypeError, ValueError) as error:
        raise EvaluationRunHistoryStorageError(
            "Persistent evaluation run history row is inconsistent"
        ) from error


def _threshold_from_record(row: Record) -> ThresholdEvaluation:
    return ThresholdEvaluation.model_validate(
        {
            "threshold": row["threshold"],
            "result_kind": row["result_kind"],
            "hit_rate": row["hit_rate"],
            "precision": row["precision"],
            "recall": row["recall"],
            "f1_score": row["f1_score"],
            "average_latency_ms": row["average_latency_ms"],
            "provider_calls_avoided": row["provider_calls_avoided"],
            "true_positive_hits": row["true_positive_hits"],
            "true_negative_misses": row["true_negative_misses"],
            "false_positive_hits": row["false_positive_hits"],
            "false_negative_misses": row["false_negative_misses"],
        }
    )


def _retained_run_from_records(
    row: Record,
    threshold_rows: list[Record],
) -> RetainedEvaluationRun:
    summary = _summary_from_record(row)
    try:
        record = EvaluationRunHistoryRecord(
            context=summary.context,
            terminal_state=summary.terminal_state,
            started_at=summary.started_at,
            completed_at=summary.completed_at,
            reproducibility=summary.reproducibility,
            metrics=summary.metrics,
            threshold_evaluation_mode=cast(
                ThresholdEvaluationMode,
                str(row["threshold_evaluation_mode"]),
            ),
            threshold_evaluations=tuple(
                _threshold_from_record(threshold) for threshold in threshold_rows
            ),
            failure_code=summary.failure_code,
            safe_failure_detail=summary.safe_failure_detail,
        )
        return RetainedEvaluationRun(
            record=record,
            expires_at=summary.expires_at,
        )
    except (KeyError, TypeError, ValueError) as error:
        raise EvaluationRunHistoryStorageError(
            "Persistent evaluation run history detail is inconsistent"
        ) from error


class PostgresEvaluationRunHistoryRepository:
    def __init__(
        self,
        pool: Pool,
        *,
        retention_days: int,
        max_per_namespace: int,
        cleanup_batch_size: int,
    ) -> None:
        if retention_days < 1 or max_per_namespace < 1 or cleanup_batch_size < 1:
            raise ValueError(
                "Evaluation run history repository limits must be positive"
            )

        self._pool = pool
        self._retention_days = retention_days
        self._max_per_namespace = max_per_namespace
        self._cleanup_batch_size = cleanup_batch_size

    @asynccontextmanager
    async def _connection(self) -> AsyncIterator[Connection[Record]]:
        try:
            async with self._pool.acquire() as connection:
                yield cast(Connection, connection)
        except AppError:
            raise
        except (OSError, TimeoutError, asyncpg.PostgresError) as error:
            raise EvaluationRunHistoryStorageError(
                "Persistent evaluation run history operation failed"
            ) from error

    async def _purge_expired(
        self,
        connection: Connection[Record],
        namespace: str | None,
    ) -> None:
        await connection.execute(
            PURGE_EXPIRED_HISTORY,
            namespace,
            self._cleanup_batch_size,
        )

    async def _prune_oldest_active(
        self,
        connection: Connection[Record],
        namespace: str,
        count: int,
    ) -> None:
        if count <= 0:
            return
        await connection.execute(
            PRUNE_OLDEST_ACTIVE_HISTORY,
            namespace,
            count,
        )

    def _source_dataset_id(
        self,
        record: EvaluationRunHistoryRecord,
    ) -> UUID | None:
        dataset = record.context.dataset

        if dataset.dataset_source == "builtin":
            if record.context.source_dataset_expires_at is not None:
                raise EvaluationRunHistoryStorageError(
                    "Built-in evaluation history cannot carry source dataset expiry"
                )
            return None

        if dataset.dataset_source != "persisted":
            raise EvaluationRunHistoryStorageError(
                "Only built-in or persisted datasets can be retained in run history"
            )

        if record.context.source_dataset_expires_at is None:
            raise EvaluationRunHistoryStorageError(
                "Persisted evaluation history requires source dataset expiry"
            )

        try:
            return UUID(dataset.dataset_id)
        except ValueError as error:
            raise EvaluationRunHistoryStorageError(
                "Persisted evaluation history requires a valid source dataset ID"
            ) from error

    def _expires_at(self, record: EvaluationRunHistoryRecord) -> datetime:
        expires_at = record.completed_at + timedelta(days=self._retention_days)
        source_expires_at = record.context.source_dataset_expires_at

        if source_expires_at is not None:
            expires_at = min(expires_at, source_expires_at)

        if expires_at <= record.completed_at:
            raise EvaluationRunHistoryStorageError(
                "Evaluation run history retention window has already expired"
            )

        return expires_at

    def _run_values(
        self,
        record: EvaluationRunHistoryRecord,
        *,
        run_id: UUID,
        source_dataset_id: UUID | None,
        expires_at: datetime,
    ) -> tuple[object, ...]:
        context = record.context
        dataset = context.dataset
        reproducibility = record.reproducibility

        values = (
            run_id,
            context.history_namespace,
            source_dataset_id,
            context.source_dataset_expires_at,
            record.terminal_state,
            context.accepted_at,
            record.started_at,
            record.completed_at,
            expires_at,
            dataset.dataset_id,
            dataset.dataset_source,
            dataset.schema_version,
            dataset.version,
            dataset.digest,
            dataset.name,
            dataset.description,
            dataset.query_count,
            dataset.expected_hits,
            dataset.expected_misses,
            dataset.categories,
            reproducibility.application_version,
            reproducibility.embedding_provider_category,
            reproducibility.generation_provider_category,
            reproducibility.generation_configuration_fingerprint,
            reproducibility.comparison_contract_version,
            reproducibility.embedding_dimensions,
            reproducibility.embedding_space_fingerprint,
            reproducibility.normalization_mode,
            reproducibility.normalization_fingerprint,
            reproducibility.measured_threshold,
            reproducibility.evaluation_thresholds,
            reproducibility.repetitions,
            reproducibility.reset_cache_before_run,
            reproducibility.estimated_cost_per_request_usd,
            reproducibility.estimated_cost_per_1k_tokens_usd,
            reproducibility.evaluation_timeout_seconds,
            reproducibility.configuration_fingerprint,
            record.threshold_evaluation_mode,
            *_metrics_values(record.metrics),
            record.failure_code,
            record.safe_failure_detail,
        )

        if len(values) != len(_RUN_COLUMNS):
            raise EvaluationRunHistoryStorageError(
                "Evaluation run history persistence mapping is inconsistent"
            )

        return values

    async def persist_terminal_run(
        self,
        record: EvaluationRunHistoryRecord,
    ) -> None:
        namespace = record.context.history_namespace
        if namespace is None:
            raise EvaluationRunHistoryStorageError(
                "Retained evaluation history requires a namespace"
            )

        try:
            run_id = UUID(record.context.run_id)
        except ValueError as error:
            raise EvaluationRunHistoryStorageError(
                "Evaluation run history requires a valid run ID"
            ) from error

        source_dataset_id = self._source_dataset_id(record)
        expires_at = self._expires_at(record)

        async with self._connection() as connection, connection.transaction():
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                f"evaluation-run-history:{namespace}",
            )
            await self._purge_expired(connection, namespace)

            active_count = int(
                await connection.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM semantix.evaluation_runs
                    WHERE namespace = $1
                      AND expires_at > CURRENT_TIMESTAMP
                    """,
                    namespace,
                )
            )
            prune_count = max(
                0,
                active_count - self._max_per_namespace + 1,
            )
            await self._prune_oldest_active(
                connection,
                namespace,
                prune_count,
            )

            await connection.execute(
                INSERT_RUN,
                *self._run_values(
                    record,
                    run_id=run_id,
                    source_dataset_id=source_dataset_id,
                    expires_at=expires_at,
                ),
            )

            if record.threshold_evaluations:
                await connection.executemany(
                    INSERT_THRESHOLD,
                    [
                        (
                            run_id,
                            sequence,
                            evaluation.threshold,
                            evaluation.result_kind,
                            evaluation.hit_rate,
                            evaluation.precision,
                            evaluation.recall,
                            evaluation.f1_score,
                            evaluation.average_latency_ms,
                            evaluation.provider_calls_avoided,
                            evaluation.true_positive_hits,
                            evaluation.true_negative_misses,
                            evaluation.false_positive_hits,
                            evaluation.false_negative_misses,
                        )
                        for sequence, evaluation in enumerate(
                            record.threshold_evaluations,
                            start=1,
                        )
                    ],
                )

    async def list_runs(
        self,
        *,
        namespace: str | None,
        offset: int,
        limit: int,
    ) -> RetainedEvaluationRunPage:
        async with self._connection() as connection, connection.transaction():
            await self._purge_expired(connection, namespace)
            total = int(
                await connection.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM semantix.evaluation_runs
                    WHERE expires_at > CURRENT_TIMESTAMP
                      AND ($1::text IS NULL OR namespace = $1)
                    """,
                    namespace,
                )
            )
            rows = await connection.fetch(
                f"""
                SELECT {RUN_SELECT_COLUMNS}
                FROM semantix.evaluation_runs
                WHERE expires_at > CURRENT_TIMESTAMP
                  AND ($1::text IS NULL OR namespace = $1)
                ORDER BY completed_at DESC, run_id ASC
                LIMIT $2
                OFFSET $3
                """,
                namespace,
                limit,
                offset,
            )

        return RetainedEvaluationRunPage(
            items=tuple(_summary_from_record(row) for row in rows),
            total=total,
        )

    async def get_run(
        self,
        run_id: str,
        *,
        authorized_namespaces: AuthorizedNamespaceScope,
    ) -> RetainedEvaluationRun | None:
        try:
            resolved_id = UUID(run_id)
        except ValueError:
            return None

        namespace_scope = (
            None if authorized_namespaces is None else sorted(authorized_namespaces)
        )
        async with self._connection() as connection:
            row = await connection.fetchrow(
                f"""
                SELECT {RUN_SELECT_COLUMNS}
                FROM semantix.evaluation_runs
                WHERE run_id = $1
                  AND expires_at > CURRENT_TIMESTAMP
                  AND (
                      $2::text[] IS NULL
                      OR namespace = ANY($2::text[])
                  )
                """,
                resolved_id,
                namespace_scope,
            )
            if row is None:
                return None

            threshold_rows = await connection.fetch(
                """
                SELECT
                    sequence,
                    threshold,
                    result_kind,
                    hit_rate,
                    precision,
                    recall,
                    f1_score,
                    average_latency_ms,
                    provider_calls_avoided,
                    true_positive_hits,
                    true_negative_misses,
                    false_positive_hits,
                    false_negative_misses
                FROM semantix.evaluation_run_thresholds
                WHERE run_id = $1
                ORDER BY sequence
                """,
                resolved_id,
            )

        return _retained_run_from_records(row, list(threshold_rows))

    async def delete_run(
        self,
        run_id: str,
        *,
        namespace: str,
    ) -> bool:
        try:
            resolved_id = UUID(run_id)
        except ValueError:
            return False

        async with self._connection() as connection, connection.transaction():
            await self._purge_expired(connection, namespace)
            deleted = await connection.fetchval(
                """
                DELETE FROM semantix.evaluation_runs
                WHERE run_id = $1
                  AND namespace = $2
                  AND expires_at > CURRENT_TIMESTAMP
                RETURNING run_id
                """,
                resolved_id,
                namespace,
            )

        return deleted is not None

    async def readiness(self) -> None:
        async with self._connection() as connection:
            await connection.fetchval(
                "SELECT COUNT(*) FROM semantix.evaluation_runs WHERE FALSE"
            )
