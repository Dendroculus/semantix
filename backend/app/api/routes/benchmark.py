from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_benchmark_service
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.models.benchmark import (
    BenchmarkDatasetListResponse,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
)
from app.services.benchmark_service import BenchmarkService

router = APIRouter(prefix="/api/v1/benchmarks", tags=["benchmarks"])
BenchmarkDependency = Annotated[BenchmarkService, Depends(get_benchmark_service)]


@router.get("/datasets", response_model=BenchmarkDatasetListResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def benchmark_datasets(
    request: Request,
    benchmark: BenchmarkDependency,
) -> BenchmarkDatasetListResponse:
    return benchmark.datasets()


@router.post("/run", response_model=BenchmarkRunResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def run_benchmark(
    request: Request,
    payload: BenchmarkRunRequest,
    benchmark: BenchmarkDependency,
) -> BenchmarkRunResponse:
    return await benchmark.run(payload)
