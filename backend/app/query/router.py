from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_query_service
from app.core.config import get_settings
from app.middleware.rate_limit import limiter
from app.query.schemas import QueryRequest, QueryResponse
from app.query.service import QueryService

router = APIRouter(prefix="/api/v1", tags=["query"])
QueryServiceDependency = Annotated[
    QueryService,
    Depends(get_query_service),
]


@router.post("/query", response_model=QueryResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def query(
    request: Request,
    payload: QueryRequest,
    service: QueryServiceDependency,
) -> QueryResponse:
    return await service.execute(payload.prompt)
