from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EMBEDDING_DIMENSIONS = 384
MAX_PROMPT_LENGTH = 2_000
MAX_RESPONSE_LENGTH = 100_000
MAX_RESPONSE_PREVIEW_LENGTH = 240


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HealthResponse(StrictModel):
    status: Literal["ok"]


class ErrorResponse(StrictModel):
    error: str = Field(min_length=1, max_length=100)
    detail: str | None = Field(default=None, max_length=500)
