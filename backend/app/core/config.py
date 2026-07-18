from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

EmbeddingProviderName = Literal["huggingface", "openai", "gemini"]
GenerationProviderName = Literal[
    "huggingface",
    "openai",
    "anthropic",
    "gemini",
]


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

    similarity_threshold: float = Field(
        default=0.92,
        ge=0,
        le=1,
    )
    max_cache_size: int = Field(
        default=500,
        ge=1,
        le=100_000,
    )
    cache_ttl_seconds: int | None = Field(
        default=3_600,
        gt=0,
    )

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
        if value is None or not value.strip():
            return None

        normalized = value.strip().rstrip("/")
        parsed = urlparse(normalized)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError(
                "Provider base URLs must be absolute HTTPS URLs "
                "without embedded credentials"
            )
        return normalized

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
        if self.embedding_provider == "huggingface":
            self._require_secret(self.hf_api_key, "HF_API_KEY")
            self._require_text(
                self.hf_inference_base_url,
                "HF_INFERENCE_BASE_URL",
            )
            self._require_text(
                self.hf_embedding_model,
                "HF_EMBEDDING_MODEL",
            )
            self._require_dimensions(
                self.hf_embedding_dimensions,
                "HF_EMBEDDING_DIMENSIONS",
            )
        elif self.embedding_provider == "openai":
            self._require_secret(self.openai_api_key, "OPENAI_API_KEY")
            self._require_text(self.openai_base_url, "OPENAI_BASE_URL")
            self._require_text(
                self.openai_embedding_model,
                "OPENAI_EMBEDDING_MODEL",
            )
            self._require_dimensions(
                self.openai_embedding_dimensions,
                "OPENAI_EMBEDDING_DIMENSIONS",
            )
        else:
            self._require_secret(self.gemini_api_key, "GEMINI_API_KEY")
            self._require_text(self.gemini_base_url, "GEMINI_BASE_URL")
            self._require_text(
                self.gemini_embedding_model,
                "GEMINI_EMBEDDING_MODEL",
            )
            self._require_dimensions(
                self.gemini_embedding_dimensions,
                "GEMINI_EMBEDDING_DIMENSIONS",
            )

        if self.generation_provider == "huggingface":
            self._require_secret(self.hf_api_key, "HF_API_KEY")
            self._require_text(self.hf_chat_base_url, "HF_CHAT_BASE_URL")
            self._require_text(
                self.hf_generation_model,
                "HF_GENERATION_MODEL",
            )
        elif self.generation_provider == "openai":
            self._require_secret(self.openai_api_key, "OPENAI_API_KEY")
            self._require_text(self.openai_base_url, "OPENAI_BASE_URL")
            self._require_text(
                self.openai_generation_model,
                "OPENAI_GENERATION_MODEL",
            )
        elif self.generation_provider == "anthropic":
            self._require_secret(
                self.anthropic_api_key,
                "ANTHROPIC_API_KEY",
            )
            self._require_text(
                self.anthropic_base_url,
                "ANTHROPIC_BASE_URL",
            )
            self._require_text(
                self.anthropic_generation_model,
                "ANTHROPIC_GENERATION_MODEL",
            )
        else:
            self._require_secret(self.gemini_api_key, "GEMINI_API_KEY")
            self._require_text(self.gemini_base_url, "GEMINI_BASE_URL")
            self._require_text(
                self.gemini_generation_model,
                "GEMINI_GENERATION_MODEL",
            )

        return self

    @property
    def embedding_dimensions(self) -> int:
        if self.embedding_provider == "huggingface":
            value = self.hf_embedding_dimensions
        elif self.embedding_provider == "openai":
            value = self.openai_embedding_dimensions
        else:
            value = self.gemini_embedding_dimensions

        if value is None:
            raise RuntimeError("Selected embedding dimensions were not validated")
        return value

    def configured_secrets(self) -> tuple[str, ...]:
        secrets = (
            self.hf_api_key,
            self.openai_api_key,
            self.anthropic_api_key,
            self.gemini_api_key,
        )
        return tuple(
            secret.get_secret_value()
            for secret in secrets
            if secret is not None and secret.get_secret_value()
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

    @staticmethod
    def _require_text(
        value: str | None,
        environment_name: str,
    ) -> None:
        if value is None or not value.strip():
            raise ValueError(
                f"{environment_name} is required for the selected provider"
            )

    @staticmethod
    def _require_dimensions(
        value: int | None,
        environment_name: str,
    ) -> None:
        if value is None:
            raise ValueError(
                f"{environment_name} is required for the selected provider"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
