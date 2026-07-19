from fastapi.testclient import TestClient

from app.core.config import Settings
from app.factory import create_app


def test_health_reports_configured_provider_names_only() -> None:
    settings = Settings(
        embedding_provider="mock",
        generation_provider="ollama",
        ollama_base_url="http://host.docker.internal:11434",
        ollama_generation_model="gemma3",
        hf_api_key=None,
        cache_backend="memory",
        allowed_origins=["http://localhost:5173"],
    )

    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "embedding_provider": "mock",
        "generation_provider": "ollama",
    }
    assert "host.docker.internal" not in response.text
    assert "gemma3" not in response.text
