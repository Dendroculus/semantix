from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from pydantic import SecretStr

if TYPE_CHECKING:
    from app.core.config import Settings

EmbeddingProviderName = Literal[
    "huggingface",
    "openai",
    "gemini",
    "ollama",
    "mock",
]
GenerationProviderName = Literal[
    "huggingface",
    "openai",
    "anthropic",
    "gemini",
    "ollama",
    "mock",
]
MOCK_EMBEDDING_MODEL_ID = "stable-token-hash-v1"


def validate_provider_configuration(settings: Settings) -> None:
    _validate_embedding_provider(settings)
    _validate_generation_provider(settings)


def selected_embedding_dimensions(settings: Settings) -> int:
    match settings.embedding_provider:
        case "huggingface":
            value = settings.hf_embedding_dimensions
        case "openai":
            value = settings.openai_embedding_dimensions
        case "gemini":
            value = settings.gemini_embedding_dimensions
        case "ollama":
            value = settings.ollama_embedding_dimensions
        case "mock":
            value = settings.mock_embedding_dimensions

    if value is None:
        raise RuntimeError("Selected embedding dimensions were not validated")
    return value


def selected_embedding_space(settings: Settings) -> str:
    match settings.embedding_provider:
        case "huggingface":
            model = settings.hf_embedding_model
        case "openai":
            model = settings.openai_embedding_model
        case "gemini":
            model = settings.gemini_embedding_model
        case "ollama":
            model = settings.ollama_embedding_model
        case "mock":
            model = MOCK_EMBEDDING_MODEL_ID

    if model is None:
        raise RuntimeError("Selected embedding model was not validated")
    return f"{settings.embedding_provider}:{model}"


def _validate_embedding_provider(settings: Settings) -> None:
    match settings.embedding_provider:
        case "huggingface":
            _require_secret(settings.hf_api_key, "HF_API_KEY")
            _require_text(
                settings.hf_inference_base_url,
                "HF_INFERENCE_BASE_URL",
            )
            _require_text(
                settings.hf_embedding_model,
                "HF_EMBEDDING_MODEL",
            )
            _require_dimensions(
                settings.hf_embedding_dimensions,
                "HF_EMBEDDING_DIMENSIONS",
            )
        case "openai":
            _require_secret(settings.openai_api_key, "OPENAI_API_KEY")
            _require_text(settings.openai_base_url, "OPENAI_BASE_URL")
            _require_text(
                settings.openai_embedding_model,
                "OPENAI_EMBEDDING_MODEL",
            )
            _require_dimensions(
                settings.openai_embedding_dimensions,
                "OPENAI_EMBEDDING_DIMENSIONS",
            )
        case "gemini":
            _require_secret(settings.gemini_api_key, "GEMINI_API_KEY")
            _require_text(settings.gemini_base_url, "GEMINI_BASE_URL")
            _require_text(
                settings.gemini_embedding_model,
                "GEMINI_EMBEDDING_MODEL",
            )
            _require_dimensions(
                settings.gemini_embedding_dimensions,
                "GEMINI_EMBEDDING_DIMENSIONS",
            )
        case "ollama":
            _require_text(settings.ollama_base_url, "OLLAMA_BASE_URL")
            _require_text(
                settings.ollama_embedding_model,
                "OLLAMA_EMBEDDING_MODEL",
            )
            _require_dimensions(
                settings.ollama_embedding_dimensions,
                "OLLAMA_EMBEDDING_DIMENSIONS",
            )
        case "mock":
            _require_dimensions(
                settings.mock_embedding_dimensions,
                "MOCK_EMBEDDING_DIMENSIONS",
            )


def _validate_generation_provider(settings: Settings) -> None:
    match settings.generation_provider:
        case "huggingface":
            _require_secret(settings.hf_api_key, "HF_API_KEY")
            _require_text(settings.hf_chat_base_url, "HF_CHAT_BASE_URL")
            _require_text(
                settings.hf_generation_model,
                "HF_GENERATION_MODEL",
            )
        case "openai":
            _require_secret(settings.openai_api_key, "OPENAI_API_KEY")
            _require_text(settings.openai_base_url, "OPENAI_BASE_URL")
            _require_text(
                settings.openai_generation_model,
                "OPENAI_GENERATION_MODEL",
            )
        case "anthropic":
            _require_secret(
                settings.anthropic_api_key,
                "ANTHROPIC_API_KEY",
            )
            _require_text(
                settings.anthropic_base_url,
                "ANTHROPIC_BASE_URL",
            )
            _require_text(
                settings.anthropic_generation_model,
                "ANTHROPIC_GENERATION_MODEL",
            )
        case "gemini":
            _require_secret(settings.gemini_api_key, "GEMINI_API_KEY")
            _require_text(settings.gemini_base_url, "GEMINI_BASE_URL")
            _require_text(
                settings.gemini_generation_model,
                "GEMINI_GENERATION_MODEL",
            )
        case "ollama":
            _require_text(settings.ollama_base_url, "OLLAMA_BASE_URL")
            _require_text(
                settings.ollama_generation_model,
                "OLLAMA_GENERATION_MODEL",
            )
        case "mock":
            pass


def _require_secret(
    value: SecretStr | None,
    environment_name: str,
) -> None:
    if value is None or not value.get_secret_value().strip():
        raise ValueError(f"{environment_name} is required for the selected provider")


def _require_text(
    value: str | None,
    environment_name: str,
) -> None:
    if value is None or not value.strip():
        raise ValueError(f"{environment_name} is required for the selected provider")


def _require_dimensions(
    value: int | None,
    environment_name: str,
) -> None:
    if value is None:
        raise ValueError(f"{environment_name} is required for the selected provider")
