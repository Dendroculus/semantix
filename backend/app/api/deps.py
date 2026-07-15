from typing import cast
from fastapi import Request
from app.services.cache_service import SemanticCache
from app.services.huggingface_service import HuggingFaceService


def get_semantic_cache(request: Request) -> SemanticCache:
    return cast(SemanticCache, request.app.state.semantic_cache)


def get_huggingface_service(request: Request) -> HuggingFaceService:
    return cast(HuggingFaceService, request.app.state.huggingface_service)
