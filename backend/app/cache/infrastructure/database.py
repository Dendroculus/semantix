from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from hashlib import sha256
from importlib.resources import files

import asyncpg
from asyncpg import Connection
from asyncpg.pool import Pool, PoolConnectionProxy

from app.core.config import Settings
from app.core.exceptions import CacheStorageError

logger = logging.getLogger(__name__)

MIGRATION_PACKAGE = "app.cache.infrastructure.migrations"
MIGRATION_NAME = re.compile(r"^(?P<version>\d{4})_[a-z0-9_]+\.sql$")
MIGRATION_LOCK_ID = 7_374_772_830_148_015_240
ROLE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
MIGRATION_BOOTSTRAP_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS semantix;
CREATE TABLE IF NOT EXISTS semantix.schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE semantix.schema_migrations
    ADD COLUMN IF NOT EXISTS checksum TEXT;
"""
LEGACY_0001_RELATIONS = {
    "semantix.cache_entries",
    "semantix.cache_namespace_counters",
}
LEGACY_0001_COLUMNS = {
    "cache_entries": {
        "embedding_space",
        "embedding_dimensions",
        "cache_key",
        "namespace",
        "prompt",
        "response",
        "embedding",
        "created_at",
        "expires_at",
        "hit_count",
        "last_accessed_at",
    },
    "cache_namespace_counters": {
        "embedding_space",
        "namespace",
        "hits",
        "misses",
    },
}


@dataclass(frozen=True, slots=True)
class Migration:
    version: str
    sql: str

    @property
    def checksum(self) -> str:
        return sha256(self.sql.encode("utf-8")).hexdigest()


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


async def create_pool(
    dsn: str,
    *,
    min_size: int,
    max_size: int,
    connect_timeout: float,
    command_timeout: float,
) -> Pool:
    try:
        return await asyncpg.create_pool(
            dsn=dsn,
            min_size=min_size,
            max_size=max_size,
            timeout=connect_timeout,
            command_timeout=command_timeout,
        )
    except (OSError, TimeoutError, asyncpg.PostgresError) as error:
        raise CacheStorageError(
            "Could not connect to the configured pgvector database"
        ) from error


async def create_database_pool(settings: Settings) -> Pool:
    return await create_pool(
        settings.database_dsn,
        min_size=settings.database_pool_min_size,
        max_size=settings.database_pool_max_size,
        connect_timeout=settings.database_connect_timeout_seconds,
        command_timeout=settings.database_command_timeout_seconds,
    )


async def _validate_legacy_migration(
    connection: Connection[asyncpg.Record] | PoolConnectionProxy[asyncpg.Record],
    migration: Migration,
) -> bool:
    if migration.version != "0001":
        return False

    relations = {
        str(row["relation"])
        for row in await connection.fetch(
            """
            SELECT relation
            FROM unnest($1::text[]) AS expected(relation)
            WHERE to_regclass(relation) IS NOT NULL
            """,
            sorted(LEGACY_0001_RELATIONS),
        )
    }
    if relations != LEGACY_0001_RELATIONS:
        return False

    rows = await connection.fetch(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'semantix'
          AND table_name = ANY($1::text[])
        """,
        sorted(LEGACY_0001_COLUMNS),
    )
    actual_columns: dict[str, set[str]] = {
        table_name: set() for table_name in LEGACY_0001_COLUMNS
    }
    for row in rows:
        actual_columns[str(row["table_name"])].add(str(row["column_name"]))
    return all(
        required_columns <= actual_columns[table_name]
        for table_name, required_columns in LEGACY_0001_COLUMNS.items()
    )


async def _verify_applied_migration(
    connection: Connection[asyncpg.Record] | PoolConnectionProxy[asyncpg.Record],
    migration: Migration,
    recorded_checksum: str | None,
) -> None:
    if recorded_checksum == migration.checksum:
        return
    if recorded_checksum is not None:
        raise CacheStorageError(
            f"Cache database migration {migration.version} checksum mismatch"
        )
    if not await _validate_legacy_migration(connection, migration):
        raise CacheStorageError(
            f"Cache database migration {migration.version} has no checksum "
            "and its released schema could not be verified"
        )
    await connection.execute(
        """
        UPDATE semantix.schema_migrations
        SET checksum = $2
        WHERE version = $1 AND checksum IS NULL
        """,
        migration.version,
        migration.checksum,
    )
    logger.info(
        "Backfilled cache database migration checksum version=%s",
        migration.version,
    )


async def apply_migrations(pool: Pool) -> None:
    try:
        async with pool.acquire() as connection:
            await connection.execute("SELECT pg_advisory_lock($1)", MIGRATION_LOCK_ID)
            try:
                await connection.execute(MIGRATION_BOOTSTRAP_SQL)
                applied_rows = await connection.fetch(
                    "SELECT version, checksum FROM semantix.schema_migrations"
                )
                applied = {
                    str(row["version"]): (
                        None if row["checksum"] is None else str(row["checksum"])
                    )
                    for row in applied_rows
                }
                for migration in load_migrations():
                    if migration.version in applied:
                        await _verify_applied_migration(
                            connection,
                            migration,
                            applied[migration.version],
                        )
                        continue
                    async with connection.transaction():
                        await connection.execute(migration.sql)
                        await connection.execute(
                            """
                            INSERT INTO semantix.schema_migrations (
                                version,
                                checksum
                            )
                            VALUES ($1, $2)
                            """,
                            migration.version,
                            migration.checksum,
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


async def grant_runtime_privileges(pool: Pool, runtime_role: str) -> None:
    if ROLE_NAME.fullmatch(runtime_role) is None:
        raise CacheStorageError("DATABASE_RUNTIME_ROLE is not a valid PostgreSQL role")
    quoted_role = '"' + runtime_role.replace('"', '""') + '"'
    statements = (
        f"GRANT USAGE ON SCHEMA semantix TO {quoted_role}",
        (
            "GRANT SELECT, INSERT, UPDATE, DELETE ON "
            "semantix.cache_entries, semantix.cache_namespace_counters "
            f"TO {quoted_role}"
        ),
    )
    try:
        async with pool.acquire() as connection, connection.transaction():
            for statement in statements:
                await connection.execute(statement)
    except (OSError, TimeoutError, asyncpg.PostgresError) as error:
        raise CacheStorageError(
            "Could not grant runtime database privileges"
        ) from error
