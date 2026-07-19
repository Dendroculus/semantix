from fastapi.testclient import TestClient

from app.core.config import Settings
from app.factory import create_app


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
