from fastapi import APIRouter

from app.api.health import router as health_router
from app.benchmark.router import router as benchmark_router
from app.cache.router import router as cache_router
from app.query.router import router as query_router

api_router = APIRouter()
api_router.include_router(query_router)
api_router.include_router(cache_router)
api_router.include_router(benchmark_router)
api_router.include_router(health_router)
