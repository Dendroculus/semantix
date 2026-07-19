import os
import pytest

os.environ.setdefault("HF_API_KEY", "test-only-placeholder")
os.environ.setdefault("ALLOWED_ORIGINS", '["http://localhost:5173"]')
from app.core.config import Settings, get_settings


@pytest.fixture
def settings() -> Settings:
    get_settings.cache_clear()
    return Settings(
        hf_api_key="test-only-placeholder",
        cache_backend="memory",
        allowed_origins=["http://localhost:5173"],
    )
