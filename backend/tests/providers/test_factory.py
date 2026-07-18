import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.providers.adapters.anthropic import AnthropicProvider
from app.providers.factory import (
    create_embedding_provider,
    create_generation_provider,
    create_provider_bundle,
)
from app.providers.adapters.gemini import GeminiProvider
from app.providers.adapters.huggingface import HuggingFaceProvider
from app.providers.adapters.openai import OpenAIProvider

ORIGINS = ["http://localhost:5173"]


def test_hugging_face_remains_the_default() -> None:
    settings = Settings(
        hf_api_key="hf-key",
        allowed_origins=ORIGINS,
    )

    assert settings.embedding_provider == "huggingface"
    assert settings.generation_provider == "huggingface"
    assert settings.embedding_dimensions == 384


@pytest.mark.asyncio
async def test_factory_reuses_default_provider() -> None:
    settings = Settings(
        hf_api_key="hf-key",
        allowed_origins=ORIGINS,
    )
    async with httpx.AsyncClient() as client:
        bundle = create_provider_bundle(client, settings)

    assert isinstance(
        bundle.embedding_provider,
        HuggingFaceProvider,
    )
    assert bundle.embedding_provider is bundle.generation_provider


@pytest.mark.asyncio
async def test_providers_are_selected_independently() -> None:
    settings = Settings(
        embedding_provider="openai",
        generation_provider="anthropic",
        openai_api_key="openai-key",
        openai_embedding_model="text-embedding-3-small",
        openai_embedding_dimensions=256,
        anthropic_api_key="anthropic-key",
        anthropic_generation_model="claude-sonnet-4-5",
        hf_api_key=None,
        allowed_origins=ORIGINS,
    )
    async with httpx.AsyncClient() as client:
        embedding = create_embedding_provider(
            client,
            settings,
        )
        generation = create_generation_provider(
            client,
            settings,
        )

    assert isinstance(embedding, OpenAIProvider)
    assert isinstance(generation, AnthropicProvider)
    assert settings.embedding_dimensions == 256


@pytest.mark.asyncio
async def test_factory_reuses_gemini_for_both_capabilities() -> None:
    settings = Settings(
        embedding_provider="gemini",
        generation_provider="gemini",
        gemini_api_key="gemini-key",
        gemini_embedding_model="gemini-embedding-001",
        gemini_generation_model="gemini-2.5-flash",
        gemini_embedding_dimensions=768,
        hf_api_key=None,
        allowed_origins=ORIGINS,
    )
    async with httpx.AsyncClient() as client:
        bundle = create_provider_bundle(client, settings)

    assert isinstance(
        bundle.embedding_provider,
        GeminiProvider,
    )
    assert bundle.embedding_provider is bundle.generation_provider
    assert bundle.embedding_dimensions == 768


def test_only_selected_provider_credentials_are_required() -> None:
    settings = Settings(
        embedding_provider="openai",
        generation_provider="anthropic",
        openai_api_key="openai-key",
        openai_embedding_model="text-embedding-3-small",
        openai_embedding_dimensions=128,
        anthropic_api_key="anthropic-key",
        anthropic_generation_model="claude-sonnet-4-5",
        hf_api_key=None,
        gemini_api_key=None,
        allowed_origins=ORIGINS,
    )

    assert settings.hf_api_key is None
    assert settings.gemini_api_key is None


def test_blank_unselected_environment_values_are_ignored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "OPENAI_EMBEDDING_DIMENSIONS",
        "",
    )
    monkeypatch.setenv(
        "GEMINI_EMBEDDING_DIMENSIONS",
        "",
    )

    settings = Settings(
        hf_api_key="hf-key",
        allowed_origins=ORIGINS,
    )

    assert settings.openai_embedding_dimensions is None
    assert settings.gemini_embedding_dimensions is None


@pytest.mark.parametrize(
    ("values", "missing_name"),
    [
        (
            {
                "embedding_provider": "openai",
                "generation_provider": "huggingface",
                "openai_api_key": None,
                "openai_embedding_model": "embedding-model",
                "openai_embedding_dimensions": 128,
                "hf_api_key": "hf-key",
            },
            "OPENAI_API_KEY",
        ),
        (
            {
                "embedding_provider": "huggingface",
                "generation_provider": "anthropic",
                "hf_api_key": "hf-key",
                "anthropic_api_key": None,
                "anthropic_generation_model": "generation-model",
            },
            "ANTHROPIC_API_KEY",
        ),
    ],
)
def test_selected_provider_requires_credentials(
    values: dict[str, object],
    missing_name: str,
) -> None:
    with pytest.raises(
        ValidationError,
        match=missing_name,
    ):
        Settings.model_validate(
            {
                **values,
                "allowed_origins": ORIGINS,
            }
        )


def test_anthropic_cannot_be_selected_for_embeddings() -> None:
    with pytest.raises(
        ValidationError,
        match="generation only",
    ):
        Settings.model_validate(
            {
                "embedding_provider": "anthropic",
                "generation_provider": "anthropic",
                "anthropic_api_key": "anthropic-key",
                "anthropic_generation_model": "generation-model",
                "allowed_origins": ORIGINS,
            }
        )


def test_selected_base_url_must_be_https() -> None:
    with pytest.raises(
        ValidationError,
        match="absolute HTTPS",
    ):
        Settings(
            embedding_provider="openai",
            generation_provider="huggingface",
            openai_api_key="openai-key",
            openai_base_url="http://api.example.test",
            openai_embedding_model="embedding-model",
            openai_embedding_dimensions=128,
            hf_api_key="hf-key",
            allowed_origins=ORIGINS,
        )
