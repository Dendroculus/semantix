from dataclasses import dataclass

import httpx
from pydantic import SecretStr

from app.core.config import Settings
from app.providers.adapters.anthropic import AnthropicProvider
from app.providers.adapters.gemini import GeminiProvider
from app.providers.adapters.huggingface import HuggingFaceProvider
from app.providers.adapters.mock import (
    MockEmbeddingProvider,
    MockGenerationProvider,
)
from app.providers.adapters.ollama import OllamaProvider
from app.providers.adapters.openai import OpenAIProvider
from app.providers.protocols import (
    EmbeddingProvider,
    GenerationProvider,
)


@dataclass(frozen=True, slots=True)
class ProviderBundle:
    embedding_provider: EmbeddingProvider
    generation_provider: GenerationProvider
    embedding_dimensions: int


def create_embedding_provider(
    client: httpx.AsyncClient,
    settings: Settings,
) -> EmbeddingProvider:
    match settings.embedding_provider:
        case "huggingface":
            return _create_huggingface(client, settings)
        case "openai":
            return _create_openai(client, settings)
        case "gemini":
            return _create_gemini(client, settings)
        case "ollama":
            return _create_ollama(client, settings)
        case "mock":
            return MockEmbeddingProvider(
                settings.mock_embedding_dimensions,
            )


def create_generation_provider(
    client: httpx.AsyncClient,
    settings: Settings,
) -> GenerationProvider:
    match settings.generation_provider:
        case "huggingface":
            return _create_huggingface(client, settings)
        case "openai":
            return _create_openai(client, settings)
        case "anthropic":
            return AnthropicProvider(
                client=client,
                api_key=_secret(
                    settings.anthropic_api_key,
                    "ANTHROPIC_API_KEY",
                ),
                base_url=_text(
                    settings.anthropic_base_url,
                    "ANTHROPIC_BASE_URL",
                ),
                generation_model=_text(
                    settings.anthropic_generation_model,
                    "ANTHROPIC_GENERATION_MODEL",
                ),
                max_new_tokens=settings.generation_max_new_tokens,
            )
        case "gemini":
            return _create_gemini(client, settings)
        case "ollama":
            return _create_ollama(client, settings)
        case "mock":
            return MockGenerationProvider()


def create_provider_bundle(
    client: httpx.AsyncClient,
    settings: Settings,
) -> ProviderBundle:
    if (
        settings.embedding_provider == settings.generation_provider
        and settings.embedding_provider != "mock"
    ):
        embedding_provider = create_embedding_provider(
            client,
            settings,
        )
        if not isinstance(
            embedding_provider,
            (
                HuggingFaceProvider,
                OpenAIProvider,
                GeminiProvider,
                OllamaProvider,
            ),
        ):
            raise RuntimeError("Selected provider does not support both capabilities")
        generation_provider: GenerationProvider = embedding_provider
    else:
        embedding_provider = create_embedding_provider(
            client,
            settings,
        )
        generation_provider = create_generation_provider(
            client,
            settings,
        )

    return ProviderBundle(
        embedding_provider=embedding_provider,
        generation_provider=generation_provider,
        embedding_dimensions=settings.embedding_dimensions,
    )


def _create_huggingface(
    client: httpx.AsyncClient,
    settings: Settings,
) -> HuggingFaceProvider:
    return HuggingFaceProvider(
        client=client,
        api_key=_secret(settings.hf_api_key, "HF_API_KEY"),
        inference_base_url=settings.hf_inference_base_url,
        chat_base_url=settings.hf_chat_base_url,
        embedding_model=settings.hf_embedding_model,
        generation_model=settings.hf_generation_model,
        embedding_dimensions=settings.hf_embedding_dimensions,
        max_new_tokens=settings.generation_max_new_tokens,
    )


def _create_openai(
    client: httpx.AsyncClient,
    settings: Settings,
) -> OpenAIProvider:
    return OpenAIProvider(
        client=client,
        api_key=_secret(settings.openai_api_key, "OPENAI_API_KEY"),
        base_url=_text(settings.openai_base_url, "OPENAI_BASE_URL"),
        embedding_model=settings.openai_embedding_model,
        generation_model=settings.openai_generation_model,
        embedding_dimensions=settings.openai_embedding_dimensions,
        max_new_tokens=settings.generation_max_new_tokens,
    )


def _create_gemini(
    client: httpx.AsyncClient,
    settings: Settings,
) -> GeminiProvider:
    return GeminiProvider(
        client=client,
        api_key=_secret(settings.gemini_api_key, "GEMINI_API_KEY"),
        base_url=_text(settings.gemini_base_url, "GEMINI_BASE_URL"),
        embedding_model=settings.gemini_embedding_model,
        generation_model=settings.gemini_generation_model,
        embedding_dimensions=settings.gemini_embedding_dimensions,
        max_new_tokens=settings.generation_max_new_tokens,
    )


def _create_ollama(
    client: httpx.AsyncClient,
    settings: Settings,
) -> OllamaProvider:
    return OllamaProvider(
        client=client,
        base_url=settings.ollama_base_url,
        embedding_model=settings.ollama_embedding_model,
        generation_model=settings.ollama_generation_model,
        embedding_dimensions=settings.ollama_embedding_dimensions,
        max_new_tokens=settings.generation_max_new_tokens,
    )


def _secret(
    value: SecretStr | None,
    environment_name: str,
) -> str:
    if value is None:
        raise RuntimeError(f"{environment_name} was not validated")
    return value.get_secret_value()


def _text(
    value: str | None,
    environment_name: str,
) -> str:
    if value is None:
        raise RuntimeError(f"{environment_name} was not validated")
    return value
