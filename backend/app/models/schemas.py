import math
import re
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EMBEDDING_DIMENSIONS = 384
MAX_PROMPT_LENGTH = 2_000
MAX_RESPONSE_LENGTH = 100_000
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")
_REPEATED_WHITESPACE = re.compile(r"[ \t]+")


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
    latency_ms: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_hit(self) -> "QueryResponse":
        if self.cache_hit and self.similarity_score is None:
            raise ValueError("A cache hit must include a similarity score")
        return self


class CacheStatsResponse(StrictModel):
    size: int = Field(ge=0)
    hits: int = Field(ge=0)
    misses: int = Field(ge=0)
    hit_rate: float = Field(ge=0, le=1)


class ClearCacheResponse(StrictModel):
    cleared: Literal[True]


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


class CacheCandidate(StrictModel):
    entry: CacheEntry
    similarity_score: float = Field(ge=-1, le=1)


class CacheLookupResult(StrictModel):
    cache_hit: bool
    response: str | None = Field(default=None, max_length=MAX_RESPONSE_LENGTH)
    similarity_score: float | None = Field(default=None, ge=-1, le=1)
    embedding: list[float] = Field(
        min_length=EMBEDDING_DIMENSIONS, max_length=EMBEDDING_DIMENSIONS
    )

    @model_validator(mode="after")
    def validate_hit(self) -> "CacheLookupResult":
        if self.cache_hit and (self.response is None or self.similarity_score is None):
            raise ValueError("A cache hit must include a response and similarity score")
        return self


class CacheThresholdRequest(StrictModel):
    threshold: float = Field(ge=0, le=1)


class CacheThresholdResponse(StrictModel):
    threshold: float = Field(ge=0, le=1)
