import asyncio

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.cache.infrastructure.database import (
    apply_migrations,
    create_pool,
    grant_runtime_privileges,
)


class MigrationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_ignore_empty=True,
        extra="ignore",
    )

    migration_database_url: SecretStr
    database_runtime_role: str = Field(
        min_length=1,
        max_length=63,
        pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,62}$",
    )
    database_connect_timeout_seconds: float = Field(default=10.0, gt=0, le=120)


async def run() -> None:
    settings = MigrationSettings()
    pool = await create_pool(
        settings.migration_database_url.get_secret_value(),
        min_size=1,
        max_size=1,
        timeout=settings.database_connect_timeout_seconds,
    )
    try:
        await apply_migrations(pool)
        await grant_runtime_privileges(pool, settings.database_runtime_role)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(run())
