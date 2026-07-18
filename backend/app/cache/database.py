import logging
import re
from dataclasses import dataclass
from importlib.resources import files

import asyncpg
from asyncpg.pool import Pool

from app.core.config import Settings
from app.core.exceptions import CacheStorageError

logger = logging.getLogger(__name__)

MIGRATION_PACKAGE = "app.cache.migrations"
MIGRATION_NAME = re.compile(r"^(?P<version>\d{4})_[a-z0-9_]+\.sql$")
MIGRATION_LOCK_ID = 7_374_772_830_148_015_240
MIGRATION_BOOTSTRAP_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS semantix;
CREATE TABLE IF NOT EXISTS semantix.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@dataclass(frozen=True, slots=True)
class Migration:
    version: str
    sql: str


def load_migrations() -> tuple[Migration, ...]:
    migrations: list[Migration] = []
    for resource in files(MIGRATION_PACKAGE).iterdir():
        match = MIGRATION_NAME.fullmatch(resource.name)
        if match is None:
            continue
        migrations.append(
            Migration(
                version=match.group("version"),
                sql=resource.read_text(encoding="utf-8"),
            )
        )
    ordered = tuple(sorted(migrations, key=lambda migration: migration.version))
    versions = [migration.version for migration in ordered]
    if not ordered:
        raise CacheStorageError("No cache database migrations were packaged")
    if len(versions) != len(set(versions)):
        raise CacheStorageError("Cache database migration versions must be unique")
    return ordered


async def create_database_pool(settings: Settings) -> Pool:
    try:
        return await asyncpg.create_pool(
            dsn=settings.database_dsn,
            min_size=settings.database_pool_min_size,
            max_size=settings.database_pool_max_size,
            timeout=settings.database_connect_timeout_seconds,
            command_timeout=settings.database_connect_timeout_seconds,
        )
    except (OSError, TimeoutError, asyncpg.PostgresError) as error:
        raise CacheStorageError(
            "Could not connect to the configured pgvector database"
        ) from error


async def apply_migrations(pool: Pool) -> None:
    try:
        async with pool.acquire() as connection:
            await connection.execute(
                "SELECT pg_advisory_lock($1)",
                MIGRATION_LOCK_ID,
            )
            try:
                await connection.execute(MIGRATION_BOOTSTRAP_SQL)
                applied_rows = await connection.fetch(
                    "SELECT version FROM semantix.schema_migrations"
                )
                applied = {str(row["version"]) for row in applied_rows}
                for migration in load_migrations():
                    if migration.version in applied:
                        continue
                    async with connection.transaction():
                        await connection.execute(migration.sql)
                        await connection.execute(
                            """
                            INSERT INTO semantix.schema_migrations (version)
                            VALUES ($1)
                            """,
                            migration.version,
                        )
                    logger.info(
                        "Applied cache database migration version=%s",
                        migration.version,
                    )
            finally:
                await connection.execute(
                    "SELECT pg_advisory_unlock($1)",
                    MIGRATION_LOCK_ID,
                )
    except (OSError, TimeoutError, asyncpg.PostgresError) as error:
        raise CacheStorageError(
            "Could not initialize the pgvector cache schema"
        ) from error
