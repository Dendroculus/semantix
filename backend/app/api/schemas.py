from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.providers.configuration import (
    EmbeddingProviderName,
    GenerationProviderName,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class HealthResponse(StrictModel):
    status: Literal["ok"]
    embedding_provider: EmbeddingProviderName
    generation_provider: GenerationProviderName


class ErrorResponse(StrictModel):
    error: str = Field(
        min_length=1,
        max_length=100,
    )
    detail: str | None = Field(
        default=None,
        max_length=500,
    )
