import logging

from app.benchmark.api.schemas import (
    BenchmarkRunResponse,
    EvaluationRunRetentionStatus,
)
from app.benchmark.domain.models import (
    AcceptedEvaluationRunContext,
    EvaluationRunHistoryRecord,
)
from app.benchmark.domain.protocols import EvaluationRunHistoryRepository
from app.core.exceptions import EvaluationRunHistoryStorageError

logger = logging.getLogger(__name__)


class EvaluationRunHistoryRecorder:
    def __init__(
        self,
        repository: EvaluationRunHistoryRepository | None,
    ) -> None:
        self._repository = repository

    async def retain_completed(
        self,
        context: AcceptedEvaluationRunContext,
        response: BenchmarkRunResponse,
    ) -> BenchmarkRunResponse:
        repository = self._repository
        if repository is None or context.history_namespace is None:
            return response

        record = EvaluationRunHistoryRecord(
            context=context,
            terminal_state="completed",
            started_at=response.started_at,
            completed_at=response.completed_at,
            reproducibility=response.reproducibility,
            metrics=response.metrics,
            threshold_evaluation_mode=response.threshold_evaluation_mode,
            threshold_evaluations=tuple(response.threshold_evaluations),
        )

        try:
            await repository.persist_terminal_run(record)
        except EvaluationRunHistoryStorageError as error:
            logger.warning(
                "Evaluation run history retention failed run_id=%s error_type=%s",
                context.run_id,
                type(error).__name__,
            )
            retention_state = "retention_failed"
        else:
            retention_state = "retained"

        return response.model_copy(
            update={
                "history_retention": EvaluationRunRetentionStatus(
                    state=retention_state,
                )
            }
        )
