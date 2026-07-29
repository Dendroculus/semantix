from hashlib import sha256

from fastapi.testclient import TestClient

from app.cache.domain.keys import prompt_cache_key
from app.core.config import Settings
from app.factory import create_app

VIEWER_TOKEN = "viewer-secret"
OPERATOR_TOKEN = "operator-secret"
ADMIN_TOKEN = "admin-secret"
NAMESPACE_ADMIN_TOKEN = "namespace-admin-secret"


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
            {
                "name": "namespace-administrator",
                "token_sha256": token_hash(NAMESPACE_ADMIN_TOKEN),
                "role": "admin",
                "namespaces": ["default"],
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


def test_auth_config_is_not_subject_to_the_application_rate_limit() -> None:
    with TestClient(create_app(settings())) as client:
        responses = [client.get("/api/v1/auth/config") for _ in range(25)]

    assert all(response.status_code == 200 for response in responses)
    assert all(
        response.json() == {"authentication_required": True} for response in responses
    )


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


def test_entry_operations_do_not_reveal_foreign_namespace_existence() -> None:
    foreign_prompt = "foreign namespace secret"
    foreign_key = prompt_cache_key(
        foreign_prompt,
        namespace="tenant-foreign",
    )
    missing_key = "0" * 64

    with TestClient(create_app(settings())) as client:
        created = client.post(
            "/api/v1/query",
            headers=authorization(ADMIN_TOKEN),
            json={
                "prompt": foreign_prompt,
                "namespace": "tenant-foreign",
            },
        )
        foreign_detail = client.get(
            f"/api/v1/cache/entries/{foreign_key}",
            headers=authorization(VIEWER_TOKEN),
        )
        missing_detail = client.get(
            f"/api/v1/cache/entries/{missing_key}",
            headers=authorization(VIEWER_TOKEN),
        )
        foreign_delete = client.delete(
            f"/api/v1/cache/entries/{foreign_key}",
            headers=authorization(NAMESPACE_ADMIN_TOKEN),
        )
        missing_delete = client.delete(
            f"/api/v1/cache/entries/{missing_key}",
            headers=authorization(NAMESPACE_ADMIN_TOKEN),
        )
        global_detail = client.get(
            f"/api/v1/cache/entries/{foreign_key}",
            headers=authorization(ADMIN_TOKEN),
        )
        global_delete = client.delete(
            f"/api/v1/cache/entries/{foreign_key}",
            headers=authorization(ADMIN_TOKEN),
        )

    assert created.status_code == 200
    assert foreign_detail.status_code == missing_detail.status_code == 404
    assert foreign_detail.json() == missing_detail.json()
    assert foreign_delete.status_code == missing_delete.status_code == 404
    assert foreign_delete.json() == missing_delete.json()
    assert global_detail.status_code == 200
    assert global_detail.json()["namespace"] == "tenant-foreign"
    assert global_delete.status_code == 200
