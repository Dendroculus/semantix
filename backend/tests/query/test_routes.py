from collections.abc import Sequence
from typing import get_args, get_type_hints

from fastapi.testclient import TestClient

from app.cache.service import SemanticCache
from app.cache.namespaces import DEFAULT_CACHE_NAMESPACE
from app.core.config import Settings
from app.core.exceptions import ProviderRequestError
from app.factory import create_app
from app.query.router import query
from app.query.schemas import QueryRequest
from app.query.service import QueryService
from tests.support import memory_backend, unit_vector


class Embeddings:
    async def embed(self, text: str) -> Sequence[float]:
        return unit_vector()


class Provider:
    async def generate(self, prompt: str) -> str:
        return "answer"


class FailingProvider:
    async def generate(self, prompt: str) -> str:
        raise ProviderRequestError(
            "test-only-placeholder",
        )


def query_service(
    provider: Provider | FailingProvider,
) -> QueryService:
    return QueryService(
        SemanticCache(
            Embeddings(),
            memory_backend(),
            0.92,
        ),
        provider,
    )


def test_query_route(settings: Settings) -> None:
    app = create_app(settings)

    with TestClient(app) as client:
        app.state.query_service = query_service(Provider())
        response = client.post(
            "/api/v1/query",
            json={"prompt": "one"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["response"] == "answer"
    assert payload["cache_hit"] is False
    assert payload["provider_called"] is True
    assert "embedding" not in payload


def test_empty_prompt(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/v1/query",
            json={"prompt": "   "},
        )

    assert response.status_code == 422


def test_query_request_cache_policy_defaults_and_overrides() -> None:
    default_request = QueryRequest(prompt="one")
    assert default_request.namespace == DEFAULT_CACHE_NAMESPACE
    assert default_request.cache_policy.namespace == DEFAULT_CACHE_NAMESPACE
    assert default_request.cache_policy.read_enabled
    assert default_request.cache_policy.write_enabled

    disabled = QueryRequest(
        prompt="one",
        namespace="tenant-alpha",
        cache_enabled=False,
    )
    assert disabled.cache_policy.namespace == "tenant-alpha"
    assert not disabled.cache_policy.read_enabled
    assert not disabled.cache_policy.write_enabled

    private = QueryRequest(prompt="one", private=True)
    assert not private.cache_policy.read_enabled
    assert not private.cache_policy.write_enabled

    read_bypass = QueryRequest(
        prompt="one",
        cache_read_enabled=False,
    )
    assert not read_bypass.cache_policy.read_enabled
    assert read_bypass.cache_policy.write_enabled


def test_query_route_depends_on_query_service() -> None:
    annotation = get_type_hints(
        query,
        include_extras=True,
    )["service"]

    assert get_args(annotation)[0] is QueryService


def test_provider_error_response_hides_api_key(
    settings: Settings,
) -> None:
    app = create_app(settings)

    with TestClient(app) as client:
        app.state.query_service = query_service(FailingProvider())
        response = client.post(
            "/api/v1/query",
            json={"prompt": "one"},
        )

    assert response.status_code == 502
    assert response.json()["error"] == "upstream_error"
    assert "test-only-placeholder" not in response.text
