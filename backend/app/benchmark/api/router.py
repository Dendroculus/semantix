from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_benchmark_service
from app.benchmark.api.schemas import (
    BenchmarkDatasetListResponse,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
)
from app.benchmark.application.service import BenchmarkService
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.security.auth import OperatorPrincipal, ViewerPrincipal

router = APIRouter(prefix="/api/v1/benchmarks", tags=["benchmarks"])
BenchmarkDependency = Annotated[BenchmarkService, Depends(get_benchmark_service)]


@router.get("/datasets", response_model=BenchmarkDatasetListResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def benchmark_datasets(
    request: Request,
    benchmark: BenchmarkDependency,
    principal: ViewerPrincipal,
) -> BenchmarkDatasetListResponse:
    return benchmark.datasets()


@router.post("/run", response_model=BenchmarkRunResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def run_benchmark(
    request: Request,
    payload: BenchmarkRunRequest,
    benchmark: BenchmarkDependency,
    principal: OperatorPrincipal,
) -> BenchmarkRunResponse:
    return await benchmark.run(payload)
