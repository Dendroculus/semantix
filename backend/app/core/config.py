from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.providers.configuration import (
    EmbeddingProviderName,
    GenerationProviderName,
    selected_embedding_dimensions,
    selected_embedding_space,
    validate_provider_configuration,
)
from app.providers.shared.urls import (
    normalize_hosted_provider_url,
    normalize_ollama_url,
)

CacheBackendName = Literal["memory", "pgvector"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_ignore_empty=True,
        extra="ignore",
    )

    embedding_provider: EmbeddingProviderName = "huggingface"
    generation_provider: GenerationProviderName = "huggingface"

    hf_api_key: SecretStr | None = None
    hf_inference_base_url: str | None = (
        "https://router.huggingface.co/hf-inference/models"
    )
    hf_chat_base_url: str | None = "https://router.huggingface.co/v1"
    hf_embedding_model: str | None = "sentence-transformers/all-MiniLM-L6-v2"
    hf_generation_model: str | None = "Qwen/Qwen3-4B-Instruct-2507:nscale"
    hf_embedding_dimensions: int | None = Field(default=384, gt=0)

    openai_api_key: SecretStr | None = None
    openai_base_url: str | None = "https://api.openai.com/v1"
    openai_embedding_model: str | None = None
    openai_generation_model: str | None = None
    openai_embedding_dimensions: int | None = Field(default=None, gt=0)

    anthropic_api_key: SecretStr | None = None
    anthropic_base_url: str | None = "https://api.anthropic.com"
    anthropic_generation_model: str | None = None

    gemini_api_key: SecretStr | None = None
    gemini_base_url: str | None = "https://generativelanguage.googleapis.com/v1beta"
    gemini_embedding_model: str | None = None
    gemini_generation_model: str | None = None
    gemini_embedding_dimensions: int | None = Field(default=None, gt=0)

    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_embedding_model: str | None = None
    ollama_generation_model: str | None = None
    ollama_embedding_dimensions: int | None = Field(default=None, gt=0)

    mock_embedding_dimensions: int = Field(default=384, gt=0)

    provider_timeout_seconds: float = Field(
        default=30.0,
        gt=0,
        le=120,
    )
    generation_max_new_tokens: int = Field(
        default=512,
        ge=1,
        le=2_048,
    )
    prompt_typo_correction_enabled: bool = False
    prompt_typo_max_edit_distance: int = Field(default=2, ge=0, le=3)

    similarity_threshold: float = Field(
        default=0.92,
        ge=0,
        le=1,
    )
    cache_backend: CacheBackendName = "memory"
    max_cache_size: int = Field(
        default=500,
        ge=1,
        le=100_000,
    )
    cache_ttl_seconds: int | None = Field(
        default=3_600,
        gt=0,
    )
    database_url: SecretStr | None = None
    database_pool_min_size: int = Field(default=1, ge=1, le=50)
    database_pool_max_size: int = Field(default=5, ge=1, le=50)
    database_connect_timeout_seconds: float = Field(default=10.0, gt=0, le=120)

    allowed_origins: list[str] = Field(min_length=1)
    rate_limit: str = Field(
        default="20/minute",
        pattern=r"^\d+/(second|minute|hour|day)$",
    )
    log_level: Literal[
        "DEBUG",
        "INFO",
        "WARNING",
        "ERROR",
    ] = "INFO"

    @field_validator("embedding_provider", mode="before")
    @classmethod
    def reject_generation_only_embedding_provider(
        cls,
        value: object,
    ) -> object:
        if value == "anthropic":
            raise ValueError(
                "Anthropic supports generation only and cannot be used "
                "as EMBEDDING_PROVIDER"
            )
        return value

    @field_validator(
        "hf_inference_base_url",
        "hf_chat_base_url",
        "openai_base_url",
        "anthropic_base_url",
        "gemini_base_url",
    )
    @classmethod
    def normalize_provider_base_url(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_hosted_provider_url(value)

    @field_validator("ollama_base_url")
    @classmethod
    def normalize_ollama_base_url(
        cls,
        value: str,
    ) -> str:
        return normalize_ollama_url(value)

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(
        cls,
        values: list[str],
    ) -> list[str]:
        normalized: list[str] = []

        for value in values:
            origin = value.strip().rstrip("/")
            parsed = urlparse(origin)

            if origin == "*":
                raise ValueError("Wildcard CORS origins are forbidden")

            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"Invalid CORS origin: {origin}")

            if parsed.username is not None or parsed.password is not None:
                raise ValueError("CORS origins must not contain credentials")

            normalized.append(origin)

        if len(normalized) != len(set(normalized)):
            raise ValueError("ALLOWED_ORIGINS must not contain duplicates")

        return normalized

    @model_validator(mode="after")
    def validate_selected_providers(self) -> "Settings":
        validate_provider_configuration(self)

        if self.cache_backend == "pgvector":
            self._require_secret(self.database_url, "DATABASE_URL")
            self._validate_database_url()
            if self.database_pool_min_size > self.database_pool_max_size:
                raise ValueError(
                    "DATABASE_POOL_MIN_SIZE cannot exceed DATABASE_POOL_MAX_SIZE"
                )

        return self

    @property
    def embedding_dimensions(self) -> int:
        return selected_embedding_dimensions(self)

    @property
    def embedding_space(self) -> str:
        return selected_embedding_space(self)

    @property
    def database_dsn(self) -> str:
        if self.database_url is None:
            raise RuntimeError("DATABASE_URL was not validated")
        return self.database_url.get_secret_value()

    def configured_secrets(self) -> tuple[str, ...]:
        secrets = (
            self.hf_api_key,
            self.openai_api_key,
            self.anthropic_api_key,
            self.gemini_api_key,
            self.database_url,
        )
        configured = [
            secret.get_secret_value()
            for secret in secrets
            if secret is not None and secret.get_secret_value()
        ]
        if self.database_url is not None:
            parsed = urlparse(self.database_url.get_secret_value())
            if parsed.password:
                configured.append(parsed.password)
        return tuple(configured)

    def _validate_database_url(self) -> None:
        if self.database_url is None:
            return

        parsed = urlparse(self.database_url.get_secret_value())
        if (
            parsed.scheme not in {"postgres", "postgresql"}
            or not parsed.hostname
            or not parsed.path.strip("/")
            or parsed.fragment
        ):
            raise ValueError(
                "DATABASE_URL must be an absolute PostgreSQL URL with a database name"
            )

    @staticmethod
    def _require_secret(
        value: SecretStr | None,
        environment_name: str,
    ) -> None:
        if value is None or not value.get_secret_value().strip():
            raise ValueError(
                f"{environment_name} is required for the selected provider"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
