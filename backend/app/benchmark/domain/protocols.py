from typing import Protocol

from app.benchmark.domain.models import (
    PersistedEvaluationDataset,
    PersistedEvaluationDatasetPage,
)
from app.benchmark.domain.validation import ValidatedImportedDataset
from app.cache.domain.namespaces import AuthorizedNamespaceScope


class EvaluationDatasetRepository(Protocol):
    async def list_datasets(
        self,
        *,
        namespace: str | None,
        offset: int,
        limit: int,
    ) -> PersistedEvaluationDatasetPage: ...

    async def get_dataset(
        self,
        dataset_id: str,
        *,
        authorized_namespaces: AuthorizedNamespaceScope,
    ) -> PersistedEvaluationDataset | None: ...

    async def create_dataset(
        self,
        *,
        namespace: str,
        validated: ValidatedImportedDataset,
        retention_days: int,
    ) -> PersistedEvaluationDataset: ...

    async def delete_dataset(
        self,
        dataset_id: str,
        *,
        namespace: str,
    ) -> bool: ...

    async def readiness(self) -> None: ...
