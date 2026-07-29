from hashlib import sha256

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.factory import create_app

VIEWER_TOKEN = "metrics-viewer-secret"
OPERATOR_TOKEN = "metrics-operator-secret"
NAMESPACE_ADMIN_TOKEN = "metrics-namespace-admin-secret"
GLOBAL_ADMIN_TOKEN = "metrics-global-admin-secret"


def _token_hash(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _authorization(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _secured_settings() -> Settings:
    return Settings(
        embedding_provider="mock",
        generation_provider="mock",
        mock_embedding_dimensions=32,
        cache_backend="memory",
        cache_ttl_seconds=None,
        hf_api_key=None,
        allowed_origins=["http://localhost:5173"],
        rate_limit="1000/minute",
        auth_mode="token",
        auth_principals=[
            {
                "name": "metrics-viewer",
                "token_sha256": _token_hash(VIEWER_TOKEN),
                "role": "viewer",
                "namespaces": ["tenant-alpha"],
            },
            {
                "name": "metrics-operator",
                "token_sha256": _token_hash(OPERATOR_TOKEN),
                "role": "operator",
                "namespaces": ["tenant-alpha"],
            },
            {
                "name": "metrics-namespace-admin",
                "token_sha256": _token_hash(NAMESPACE_ADMIN_TOKEN),
                "role": "admin",
                "namespaces": ["tenant-alpha"],
            },
            {
                "name": "metrics-global-admin",
                "token_sha256": _token_hash(GLOBAL_ADMIN_TOKEN),
                "role": "admin",
                "namespaces": ["*"],
            },
        ],
    )


def test_metrics_endpoint_reports_live_query_and_cache_counters() -> None:
    settings = Settings(
        embedding_provider="mock",
        generation_provider="mock",
        mock_embedding_dimensions=32,
        cache_backend="memory",
        max_cache_size=1,
        cache_ttl_seconds=None,
        hf_api_key=None,
        prompt_typo_correction_enabled=False,
        allowed_origins=["http://localhost:5173"],
        rate_limit="1000/minute",
    )

    with TestClient(create_app(settings)) as client:
        initial = client.get("/api/v1/metrics")
        assert initial.status_code == 200
        assert initial.json() == {
            "observed_at": initial.json()["observed_at"],
            "uptime_seconds": initial.json()["uptime_seconds"],
            "request_count": 0,
            "error_count": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "provider_calls": 0,
            "in_flight_coalesced_requests": 0,
            "average_latency_ms": None,
            "p95_latency_ms": None,
            "latency_sample_size": 0,
            "cache_size": 0,
            "evictions": 0,
            "expirations": 0,
        }

        miss = client.post(
            "/api/v1/query",
            json={"prompt": "metrics alpha"},
        )
        assert miss.status_code == 200
        assert miss.json()["cache_hit"] is False

        hit = client.post("/api/v1/query", json={"prompt": "metrics alpha"})
        assert hit.status_code == 200
        assert hit.json()["cache_hit"] is True

        bypassed = client.post(
            "/api/v1/query",
            json={
                "prompt": "metrics beta",
                "cache_read_enabled": False,
            },
        )
        assert bypassed.status_code == 200

        response = client.get("/api/v1/metrics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["request_count"] == 3
    assert payload["error_count"] == 0
    assert payload["cache_hits"] == 1
    assert payload["cache_misses"] == 1
    assert payload["provider_calls"] == 2
    assert payload["in_flight_coalesced_requests"] == 0
    assert payload["average_latency_ms"] >= 0
    assert payload["p95_latency_ms"] >= 0
    assert payload["latency_sample_size"] == 3
    assert payload["cache_size"] == 1
    assert payload["evictions"] == 1
    assert payload["expirations"] == 0


@pytest.mark.parametrize(
    "token",
    [
        VIEWER_TOKEN,
        OPERATOR_TOKEN,
        NAMESPACE_ADMIN_TOKEN,
    ],
    ids=["scoped-viewer", "scoped-operator", "namespace-admin"],
)
def test_metrics_rejects_non_global_principals_without_leaking_foreign_activity(
    token: str,
) -> None:
    with TestClient(create_app(_secured_settings())) as client:
        created = client.post(
            "/api/v1/query",
            headers=_authorization(GLOBAL_ADMIN_TOKEN),
            json={
                "prompt": "foreign metrics activity",
                "namespace": "tenant-beta",
            },
        )
        scoped_cache_stats = client.get(
            "/api/v1/cache/stats",
            headers=_authorization(token),
        )
        response = client.get(
            "/api/v1/metrics",
            headers=_authorization(token),
        )

    assert created.status_code == 200
    assert scoped_cache_stats.status_code == 200
    assert scoped_cache_stats.json()["size"] == 0
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"
    assert "request_count" not in response.text
    assert "cache_size" not in response.text


def test_metrics_requires_authentication_when_token_auth_is_enabled() -> None:
    with TestClient(create_app(_secured_settings())) as client:
        response = client.get("/api/v1/metrics")

    assert response.status_code == 401
    assert response.json()["error"] == "authentication_required"


def test_global_admin_receives_unchanged_global_metrics_snapshot() -> None:
    with TestClient(create_app(_secured_settings())) as client:
        created = client.post(
            "/api/v1/query",
            headers=_authorization(GLOBAL_ADMIN_TOKEN),
            json={
                "prompt": "foreign metrics activity",
                "namespace": "tenant-beta",
            },
        )
        response = client.get(
            "/api/v1/metrics",
            headers=_authorization(GLOBAL_ADMIN_TOKEN),
        )

    assert created.status_code == 200
    assert response.status_code == 200
    payload = response.json()
    assert payload["request_count"] == 1
    assert payload["cache_misses"] == 1
    assert payload["provider_calls"] == 1
    assert payload["cache_size"] == 1
