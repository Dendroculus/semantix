from hashlib import sha256

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.factory import create_app

VIEWER_TOKEN = "viewer-secret"
OPERATOR_TOKEN = "operator-secret"
ADMIN_TOKEN = "admin-secret"


def token_hash(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def settings() -> Settings:
    return Settings(
        embedding_provider="mock",
        generation_provider="mock",
        hf_api_key=None,
        cache_backend="memory",
        allowed_origins=["http://localhost:5173"],
        auth_mode="token",
        auth_principals=[
            {
                "name": "reader",
                "token_sha256": token_hash(VIEWER_TOKEN),
                "role": "viewer",
                "namespaces": ["default"],
            },
            {
                "name": "operator",
                "token_sha256": token_hash(OPERATOR_TOKEN),
                "role": "operator",
                "namespaces": ["default"],
            },
            {
                "name": "administrator",
                "token_sha256": token_hash(ADMIN_TOKEN),
                "role": "admin",
                "namespaces": ["*"],
            },
        ],
    )


def authorization(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}



def test_auth_config_is_public_and_does_not_disclose_principals() -> None:
    with TestClient(create_app(settings())) as client:
        response = client.get("/api/v1/auth/config")

    assert response.status_code == 200
    assert response.json() == {"authentication_required": True}
    assert "reader" not in response.text

def test_protected_routes_require_a_valid_token() -> None:
    with TestClient(create_app(settings())) as client:
        response = client.get("/api/v1/cache/stats")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"] == "authentication_required"


def test_viewer_can_read_its_namespace_but_cannot_clear_cache() -> None:
    with TestClient(create_app(settings())) as client:
        read_response = client.get(
            "/api/v1/cache/stats",
            headers=authorization(VIEWER_TOKEN),
        )
        clear_response = client.delete(
            "/api/v1/cache",
            headers=authorization(VIEWER_TOKEN),
        )

    assert read_response.status_code == 200
    assert clear_response.status_code == 403


def test_operator_can_submit_queries_for_an_authorized_namespace() -> None:
    with TestClient(create_app(settings())) as client:
        response = client.post(
            "/api/v1/query",
            headers=authorization(OPERATOR_TOKEN),
            json={"prompt": "Explain semantic caching", "namespace": "default"},
        )

    assert response.status_code == 200


def test_operator_cannot_escape_its_namespace_scope() -> None:
    with TestClient(create_app(settings())) as client:
        response = client.post(
            "/api/v1/query",
            headers=authorization(OPERATOR_TOKEN),
            json={"prompt": "Explain semantic caching", "namespace": "other"},
        )

    assert response.status_code == 403


def test_global_admin_can_update_the_threshold() -> None:
    with TestClient(create_app(settings())) as client:
        response = client.put(
            "/api/v1/cache/threshold",
            headers=authorization(ADMIN_TOKEN),
            json={"threshold": 0.9},
        )

    assert response.status_code == 200
    assert response.json() == {"threshold": 0.9}


def test_auth_session_returns_only_principal_metadata() -> None:
    with TestClient(create_app(settings())) as client:
        response = client.get(
            "/api/v1/auth/session",
            headers=authorization(VIEWER_TOKEN),
        )

    assert response.status_code == 200
    assert response.json() == {
        "name": "reader",
        "role": "viewer",
        "namespaces": ["default"],
    }
    assert VIEWER_TOKEN not in response.text
