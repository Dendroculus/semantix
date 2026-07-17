import math
import re
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EMBEDDING_DIMENSIONS = 384
MAX_PROMPT_LENGTH = 2_000
MAX_RESPONSE_LENGTH = 100_000
MAX_RESPONSE_PREVIEW_LENGTH = 240
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")
_REPEATED_WHITESPACE = re.compile(r"[ \t]+")
CacheEntrySort = Literal["newest", "oldest", "most_hit", "nearest_expiry"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class QueryRequest(StrictModel):
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)

    @field_validator("prompt", mode="before")
    @classmethod
    def sanitize_prompt(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return _REPEATED_WHITESPACE.sub(
            " ", _CONTROL_CHARACTERS.sub(" ", value)
        ).strip()


class QueryResponse(StrictModel):
    response: str = Field(min_length=1, max_length=MAX_RESPONSE_LENGTH)
    cache_hit: bool
    similarity_score: float | None = Field(default=None, ge=-1, le=1)
    similarity_threshold: float = Field(ge=0, le=1)
    matched_prompt: str | None = Field(
        default=None, min_length=1, max_length=MAX_PROMPT_LENGTH
    )
    matched_cache_key: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    cache_entry_created_at: datetime | None = None
    cache_entry_age_seconds: float | None = Field(default=None, ge=0)
    generation_skipped: bool
    provider_called: bool
    latency_ms: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_explainability(self) -> "QueryResponse":
        matched_fields = (
            self.matched_prompt,
            self.matched_cache_key,
            self.cache_entry_created_at,
            self.cache_entry_age_seconds,
        )

        if self.cache_hit:
            if self.similarity_score is None or any(
                value is None for value in matched_fields
            ):
                raise ValueError(
                    "A cache hit must include its score and matched-entry metadata"
                )
            if self.similarity_score < self.similarity_threshold:
                raise ValueError("A cache-hit score must meet the request threshold")
            if not self.generation_skipped or self.provider_called:
                raise ValueError(
                    "A cache hit must skip generation and not call the provider"
                )
        else:
            if any(value is not None for value in matched_fields):
                raise ValueError("A cache miss cannot include matched-entry metadata")
            if self.generation_skipped or not self.provider_called:
                raise ValueError(
                    "A cache miss must run generation and call the provider"
                )

        return self

    @field_validator("cache_entry_created_at")
    @classmethod
    def require_cache_entry_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("cache_entry_created_at must be timezone-aware")
        return value


class CacheStatsResponse(StrictModel):
    size: int = Field(ge=0)
    hits: int = Field(ge=0)
    misses: int = Field(ge=0)
    hit_rate: float = Field(ge=0, le=1)


class ClearCacheResponse(StrictModel):
    cleared: Literal[True]


class DeleteCacheEntryResponse(StrictModel):
    deleted: Literal[True]
    cache_key: str = Field(pattern=r"^[a-f0-9]{64}$")


class HealthResponse(StrictModel):
    status: Literal["ok"]


class ErrorResponse(StrictModel):
    error: str = Field(min_length=1, max_length=100)
    detail: str | None = Field(default=None, max_length=500)


class CacheEntry(StrictModel):
    cache_key: str = Field(pattern=r"^[a-f0-9]{64}$")
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)
    response: str = Field(min_length=1, max_length=MAX_RESPONSE_LENGTH)
    embedding: list[float] = Field(
        min_length=EMBEDDING_DIMENSIONS, max_length=EMBEDDING_DIMENSIONS
    )
    created_at: datetime

    @field_validator("embedding")
    @classmethod
    def validate_embedding(cls, value: list[float]) -> list[float]:
        if not all(math.isfinite(component) for component in value):
            raise ValueError("Embedding components must be finite")
        return value

    @field_validator("created_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("created_at must be timezone-aware")
        return value


class CacheEntryMetadata(StrictModel):
    cache_key: str = Field(pattern=r"^[a-f0-9]{64}$")
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)
    response_preview: str = Field(min_length=1, max_length=MAX_RESPONSE_PREVIEW_LENGTH)
    created_at: datetime
    expires_at: datetime | None = None
    remaining_ttl_seconds: float | None = Field(default=None, ge=0)
    hit_count: int = Field(ge=0)
    last_accessed_at: datetime | None = None
    recency_rank: int = Field(ge=1)
    is_expired: bool

    @field_validator("created_at", "expires_at", "last_accessed_at")
    @classmethod
    def require_metadata_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Cache metadata timestamps must be timezone-aware")
        return value

    @model_validator(mode="after")
    def validate_expiry(self) -> "CacheEntryMetadata":
        if (self.expires_at is None) != (self.remaining_ttl_seconds is None):
            raise ValueError(
                "expires_at and remaining_ttl_seconds must both be present or null"
            )
        return self


class CacheEntryListResponse(StrictModel):
    items: list[CacheEntryMetadata]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    has_more: bool

    @model_validator(mode="after")
    def validate_page(self) -> "CacheEntryListResponse":
        if len(self.items) > self.limit:
            raise ValueError("Cache inspector page exceeds its declared limit")
        if self.has_more != (self.offset + len(self.items) < self.total):
            raise ValueError("has_more does not match the cache inspector page")
        return self


class CacheCandidate(StrictModel):
    entry: CacheEntry
    similarity_score: float = Field(ge=-1, le=1)


class CacheLookupResult(StrictModel):
    cache_hit: bool
    response: str | None = Field(default=None, max_length=MAX_RESPONSE_LENGTH)
    similarity_score: float | None = Field(default=None, ge=-1, le=1)
    similarity_threshold: float = Field(ge=0, le=1)
    matched_prompt: str | None = Field(
        default=None, min_length=1, max_length=MAX_PROMPT_LENGTH
    )
    matched_cache_key: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    cache_entry_created_at: datetime | None = None
    embedding: list[float] = Field(
        min_length=EMBEDDING_DIMENSIONS, max_length=EMBEDDING_DIMENSIONS
    )

    @model_validator(mode="after")
    def validate_lookup(self) -> "CacheLookupResult":
        matched_fields = (
            self.matched_prompt,
            self.matched_cache_key,
            self.cache_entry_created_at,
        )

        if self.cache_hit and (
            self.response is None
            or self.similarity_score is None
            or any(value is None for value in matched_fields)
        ):
            raise ValueError(
                "A cache hit must include a response, score, and matched-entry metadata"
            )
        if (
            self.cache_hit
            and self.similarity_score is not None
            and self.similarity_score < self.similarity_threshold
        ):
            raise ValueError("A cache-hit score must meet the lookup threshold")
        if not self.cache_hit and (
            self.response is not None
            or any(value is not None for value in matched_fields)
        ):
            raise ValueError(
                "A cache miss cannot include a response or matched-entry metadata"
            )

        return self

    @field_validator("cache_entry_created_at")
    @classmethod
    def require_cache_entry_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("cache_entry_created_at must be timezone-aware")
        return value


class CacheThresholdRequest(StrictModel):
    threshold: float = Field(ge=0, le=1)


class CacheThresholdResponse(StrictModel):
    threshold: float = Field(ge=0, le=1)
