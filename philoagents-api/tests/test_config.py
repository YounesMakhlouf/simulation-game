import pytest
from pydantic import ValidationError

from philoagents.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(GROQ_API_KEY="test-key", **overrides)


def test_cors_origins_default_is_local_ui():
    assert _settings().CORS_ALLOW_ORIGINS == ["http://localhost:8080"]


def test_cors_origins_accepts_explicit_list():
    settings = _settings(CORS_ALLOW_ORIGINS=["https://a.example", "https://b.example"])
    assert settings.CORS_ALLOW_ORIGINS == ["https://a.example", "https://b.example"]


def test_cors_origins_rejects_wildcard():
    with pytest.raises(ValidationError, match='must not contain "\\*"'):
        _settings(CORS_ALLOW_ORIGINS=["https://a.example", "*"])
