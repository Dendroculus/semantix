import pytest
from pydantic import ValidationError

from app.cache.database import load_migrations
from app.core.config import Settings

ORIGINS = ["http://localhost:5173"]


def test_memory_backend_does_not_require_database_configuration() -> None:
    settings = Settings(
        cache_backend="memory",
        database_url=None,
        hf_api_key="test-only-placeholder",
        allowed_origins=ORIGINS,
    )

    assert settings.cache_backend == "memory"
    assert settings.database_url is None


def test_pgvector_requires_a_postgresql_database_url() -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(
            cache_backend="pgvector",
            database_url=None,
            hf_api_key="test-only-placeholder",
            allowed_origins=ORIGINS,
        )

    with pytest.raises(ValidationError, match="absolute PostgreSQL URL"):
        Settings(
            cache_backend="pgvector",
            database_url="https://database.example.test/semantix",
            hf_api_key="test-only-placeholder",
            allowed_origins=ORIGINS,
        )


def test_pgvector_pool_bounds_are_validated() -> None:
    with pytest.raises(
        ValidationError,
        match="DATABASE_POOL_MIN_SIZE cannot exceed",
    ):
        Settings(
            cache_backend="pgvector",
            database_url="postgresql://user:secret@database:5432/semantix",
            database_pool_min_size=6,
            database_pool_max_size=5,
            hf_api_key="test-only-placeholder",
            allowed_origins=ORIGINS,
        )


def test_database_credentials_are_registered_for_log_redaction() -> None:
    settings = Settings(
        cache_backend="pgvector",
        database_url="postgresql://user:secret@database:5432/semantix",
        hf_api_key="test-only-placeholder",
        allowed_origins=ORIGINS,
    )

    assert "secret" in settings.configured_secrets()
    assert settings.database_dsn.endswith("/semantix")


def test_cache_migrations_have_unique_ordered_versions() -> None:
    migrations = load_migrations()

    assert [migration.version for migration in migrations] == ["0001"]
    assert "semantix.cache_entries" in migrations[0].sql
