from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    hf_api_key: SecretStr = Field(min_length=1)
    hf_base_url: str = "https://router.huggingface.co/hf-inference/models"
    hf_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    hf_generation_model: str = "mistralai/Mistral-7B-Instruct-v0.3"
    hf_timeout_seconds: float = Field(default=30.0, gt=0, le=120)
    generation_max_new_tokens: int = Field(default=512, ge=1, le=2048)
    similarity_threshold: float = Field(default=0.92, ge=0, le=1)
    max_cache_size: int = Field(default=500, ge=1, le=100_000)
    cache_ttl_seconds: int | None = Field(default=3600, gt=0)
    allowed_origins: list[str] = Field(min_length=1)
    rate_limit: str = Field(default="20/minute", pattern=r"^\d+/(second|minute|hour|day)$")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @field_validator("hf_base_url")
    @classmethod
    def normalize_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        parsed = urlparse(normalized)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("HF_BASE_URL must be an absolute HTTPS URL")
        return normalized

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, values: list[str]) -> list[str]:
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
