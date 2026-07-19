import pytest

from app.providers.shared.urls import (
    normalize_hosted_provider_url,
    normalize_ollama_url,
)


def test_hosted_provider_urls_require_https_origins() -> None:
    assert (
        normalize_hosted_provider_url("https://api.example.test/v1/")
        == "https://api.example.test/v1"
    )

    with pytest.raises(ValueError, match="absolute HTTPS"):
        normalize_hosted_provider_url("http://api.example.test")


@pytest.mark.parametrize(
    "value",
    [
        "http://localhost:11434",
        "http://ollama:11434",
        "https://ollama.example.test",
    ],
)
def test_ollama_accepts_absolute_http_or_https_origins(value: str) -> None:
    assert normalize_ollama_url(value) == value


@pytest.mark.parametrize(
    "value",
    [
        "ftp://ollama:11434",
        "http://user:secret@ollama:11434",
        "http://ollama:11434/api",
        "http://ollama:11434?token=secret",
    ],
)
def test_ollama_rejects_unsafe_or_non_origin_urls(value: str) -> None:
    with pytest.raises(ValueError, match="OLLAMA_BASE_URL"):
        normalize_ollama_url(value)
