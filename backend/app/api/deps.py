from typing import cast
from fastapi import Request
from app.benchmark.service import BenchmarkService
from app.cache.service import SemanticCache
from app.providers.huggingface import HuggingFaceService


def get_benchmark_service(request: Request) -> BenchmarkService:
    return cast(BenchmarkService, request.app.state.benchmark_service)


def get_semantic_cache(request: Request) -> SemanticCache:
    return cast(SemanticCache, request.app.state.semantic_cache)


def get_huggingface_service(request: Request) -> HuggingFaceService:
    return cast(HuggingFaceService, request.app.state.huggingface_service)
