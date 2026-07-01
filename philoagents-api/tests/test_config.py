from philoagents.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(GROQ_API_KEY="test-key", **overrides)


def test_cors_origins_default_is_local_ui():
    assert _settings().CORS_ALLOW_ORIGINS == ["http://localhost:8080"]


def test_cors_origins_parses_comma_separated_string():
    settings = _settings(
        CORS_ALLOW_ORIGINS="https://a.example, https://b.example ,https://c.example"
    )
    assert settings.CORS_ALLOW_ORIGINS == [
        "https://a.example",
        "https://b.example",
        "https://c.example",
    ]


def test_cors_origins_accepts_json_list():
    settings = _settings(CORS_ALLOW_ORIGINS='["https://a.example"]')
    assert settings.CORS_ALLOW_ORIGINS == ["https://a.example"]


def test_cors_origins_accepts_python_list():
    settings = _settings(CORS_ALLOW_ORIGINS=["https://a.example"])
    assert settings.CORS_ALLOW_ORIGINS == ["https://a.example"]
