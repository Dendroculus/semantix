from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class HealthResponse(StrictModel):
    status: Literal["ok"]


class ErrorResponse(StrictModel):
    error: str = Field(
        min_length=1,
        max_length=100,
    )
    detail: str | None = Field(
        default=None,
        max_length=500,
    )
