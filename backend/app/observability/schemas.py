from dataclasses import asdict
from datetime import datetime

from pydantic import Field, model_validator

from app.api.schemas import StrictModel
from app.observability.metrics import MetricsSnapshot


class MetricsResponse(StrictModel):
    observed_at: datetime
    uptime_seconds: float = Field(ge=0)
    request_count: int = Field(ge=0)
    error_count: int = Field(ge=0)
    cache_hits: int = Field(ge=0)
    cache_misses: int = Field(ge=0)
    provider_calls: int = Field(ge=0)
    in_flight_coalesced_requests: int = Field(ge=0)
    average_latency_ms: float | None = Field(default=None, ge=0)
    p95_latency_ms: float | None = Field(default=None, ge=0)
    latency_sample_size: int = Field(ge=0)
    cache_size: int = Field(ge=0)
    evictions: int = Field(ge=0)
    expirations: int = Field(ge=0)

    @classmethod
    def from_snapshot(cls, snapshot: MetricsSnapshot) -> "MetricsResponse":
        return cls(**asdict(snapshot))

    @model_validator(mode="after")
    def validate_latency_state(self) -> "MetricsResponse":
        has_latency = (
            self.average_latency_ms is not None and self.p95_latency_ms is not None
        )
        if has_latency != (self.latency_sample_size > 0):
            raise ValueError("Latency metrics and sample size must agree")
        if self.error_count > self.request_count:
            raise ValueError("error_count cannot exceed request_count")
        return self
