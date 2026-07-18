from fastapi import APIRouter

from app.api.routes import benchmark, cache, health, query

api_router = APIRouter()
api_router.include_router(query.router)
api_router.include_router(cache.router)
api_router.include_router(benchmark.router)
api_router.include_router(health.router)
