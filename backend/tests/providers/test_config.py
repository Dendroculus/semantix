import pytest
from pydantic import ValidationError

from app.core.config import Settings

ORIGINS = ["http://localhost:5173"]


def settings(**values: object) -> Settings:
    return Settings.model_validate(
        {
            "embedding_provider": "mock",
            "generation_provider": "mock",
            "hf_api_key": None,
            "cache_backend": "memory",
            "database_url": None,
            "allowed_origins": ORIGINS,
            **values,
        }
    )


def test_ollama_generation_only_requires_only_generation_fields() -> None:
    configured = settings(
        generation_provider="ollama",
        ollama_generation_model="gemma3",
    )

    assert configured.ollama_embedding_model is None
    assert configured.ollama_embedding_dimensions is None


def test_ollama_embedding_only_requires_only_embedding_fields() -> None:
    configured = settings(
        embedding_provider="ollama",
        ollama_embedding_model="embeddinggemma",
        ollama_embedding_dimensions=768,
    )

    assert configured.ollama_generation_model is None
    assert configured.embedding_dimensions == 768
    assert configured.embedding_space == "ollama:embeddinggemma"


def test_ollama_supports_both_capabilities() -> None:
    configured = settings(
        embedding_provider="ollama",
        generation_provider="ollama",
        ollama_embedding_model="embeddinggemma",
        ollama_generation_model="gemma3",
        ollama_embedding_dimensions=768,
    )

    assert configured.embedding_provider == "ollama"
    assert configured.generation_provider == "ollama"


@pytest.mark.parametrize(
    ("values", "missing_name"),
    [
        (
            {
                "generation_provider": "ollama",
                "ollama_generation_model": None,
            },
            "OLLAMA_GENERATION_MODEL",
        ),
        (
            {
                "embedding_provider": "ollama",
                "ollama_embedding_model": None,
                "ollama_embedding_dimensions": 384,
            },
            "OLLAMA_EMBEDDING_MODEL",
        ),
        (
            {
                "embedding_provider": "ollama",
                "ollama_embedding_model": "embeddinggemma",
                "ollama_embedding_dimensions": None,
            },
            "OLLAMA_EMBEDDING_DIMENSIONS",
        ),
    ],
)
def test_selected_ollama_capability_requires_its_configuration(
    values: dict[str, object],
    missing_name: str,
) -> None:
    with pytest.raises(ValidationError, match=missing_name):
        settings(**values)


@pytest.mark.parametrize(
    "base_url",
    [
        "http://localhost:11434",
        "http://127.0.0.1:11434",
        "http://host.docker.internal:11434",
        "http://ollama:11434",
        "https://ollama.internal",
    ],
)
def test_accepts_safe_ollama_origins(base_url: str) -> None:
    configured = settings(ollama_base_url=base_url)

    assert configured.ollama_base_url == base_url


@pytest.mark.parametrize(
    "base_url",
    [
        "localhost:11434",
        "ftp://localhost:11434",
        "http://",
        "http://user:password@localhost:11434",
        "http://localhost:11434/api",
        "http://localhost:11434?token=value",
        "http://localhost:11434#fragment",
        "http://localhost:not-a-port",
    ],
)
def test_rejects_unsafe_ollama_urls(base_url: str) -> None:
    with pytest.raises(ValidationError, match="OLLAMA_BASE_URL"):
        settings(ollama_base_url=base_url)


def test_hosted_provider_http_remains_rejected() -> None:
    with pytest.raises(ValidationError, match="absolute HTTPS"):
        settings(
            embedding_provider="openai",
            openai_api_key="openai-key",
            openai_base_url="http://api.openai.test/v1",
            openai_embedding_model="embedding-model",
            openai_embedding_dimensions=384,
        )


def test_unselected_ollama_models_are_not_required() -> None:
    configured = settings()

    assert configured.ollama_embedding_model is None
    assert configured.ollama_generation_model is None


def test_mock_providers_require_no_credentials() -> None:
    configured = settings(mock_embedding_dimensions=32)

    assert configured.embedding_dimensions == 32
    assert configured.embedding_space == "mock:stable-token-hash-v1"
    assert configured.configured_secrets() == ()
