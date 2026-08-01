from asyncpg.pool import Pool

from app.core.exceptions import EvaluationDatasetStorageError
from app.infrastructure import database as shared_database
from app.infrastructure.database import Migration

MIGRATION_PACKAGE = "app.benchmark.infrastructure.migrations"
EVALUATION_DATASET_TABLES = (
    "semantix.evaluation_datasets",
    "semantix.evaluation_dataset_cases",
)


def load_migrations() -> tuple[Migration, ...]:
    return shared_database.load_packaged_migrations(
        (MIGRATION_PACKAGE,),
        label="Evaluation dataset database",
        error_type=EvaluationDatasetStorageError,
    )


async def apply_migrations(pool: Pool) -> None:
    await shared_database.apply_migrations(
        pool,
        load_migrations(),
        label="Evaluation dataset database",
        error_type=EvaluationDatasetStorageError,
    )


async def grant_runtime_privileges(pool: Pool, runtime_role: str) -> None:
    await shared_database.grant_runtime_privileges(
        pool,
        runtime_role,
        EVALUATION_DATASET_TABLES,
        error_type=EvaluationDatasetStorageError,
    )
