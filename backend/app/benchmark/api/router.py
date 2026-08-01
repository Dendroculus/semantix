from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_benchmark_service
from app.benchmark.api.schemas import (
    BenchmarkDatasetListResponse,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
    EvaluationDatasetPreview,
    EvaluationDatasetValidationRequest,
    EvaluationRunRequest,
)
from app.benchmark.application.service import BenchmarkService
from app.middleware.rate_limit import app_rate_limit, limiter
from app.security.auth import OperatorPrincipal, ViewerPrincipal

router = APIRouter(prefix="/api/v1/benchmarks", tags=["benchmarks"])
evaluations_router = APIRouter(prefix="/api/v1/evaluations", tags=["evaluations"])
BenchmarkDependency = Annotated[BenchmarkService, Depends(get_benchmark_service)]


@router.get("/datasets", response_model=BenchmarkDatasetListResponse)
@limiter.limit(app_rate_limit)
async def benchmark_datasets(
    request: Request,
    benchmark: BenchmarkDependency,
    principal: ViewerPrincipal,
) -> BenchmarkDatasetListResponse:
    return benchmark.datasets()


@router.post("/run", response_model=BenchmarkRunResponse)
@limiter.limit(app_rate_limit)
async def run_benchmark(
    request: Request,
    payload: BenchmarkRunRequest,
    benchmark: BenchmarkDependency,
    principal: OperatorPrincipal,
) -> BenchmarkRunResponse:
    return await benchmark.run(payload)


@evaluations_router.get(
    "/datasets",
    response_model=BenchmarkDatasetListResponse,
)
@limiter.limit(app_rate_limit)
async def evaluation_datasets(
    request: Request,
    benchmark: BenchmarkDependency,
    principal: ViewerPrincipal,
) -> BenchmarkDatasetListResponse:
    return benchmark.datasets()


@evaluations_router.post(
    "/datasets/validate",
    response_model=EvaluationDatasetPreview,
)
@limiter.limit(app_rate_limit)
async def validate_evaluation_dataset(
    request: Request,
    payload: EvaluationDatasetValidationRequest,
    benchmark: BenchmarkDependency,
    principal: OperatorPrincipal,
) -> EvaluationDatasetPreview:
    return benchmark.validate_dataset(payload)


@evaluations_router.post("/runs", response_model=BenchmarkRunResponse)
@limiter.limit(app_rate_limit)
async def run_evaluation(
    request: Request,
    payload: EvaluationRunRequest,
    benchmark: BenchmarkDependency,
    principal: OperatorPrincipal,
) -> BenchmarkRunResponse:
    return await benchmark.run_evaluation(payload)
