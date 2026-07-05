from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", env_file_encoding="utf-8"
    )

    # --- GROQ Configuration ---
    GROQ_API_KEY: str
    GROQ_LLM_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_LLM_MODEL_CONTEXT_SUMMARY: str = "llama-3.1-8b-instant"
    GROQ_LLM_MODEL_SUMMARY: str = "llama-3.1-8b-instant"
    GROQ_LLM_MODEL_JUDGE: str = "openai/gpt-oss-120b"
    GROQ_JUDGE_MAX_TOKENS: int = 8192

    # --- MongoDB Configuration ---
    MONGO_URI: str = Field(
        default="mongodb://philoagents:philoagents@local_dev_atlas:27017/?directConnection=true",
        description="Connection URI for the local MongoDB Atlas instance.",
    )
    MONGO_DB_NAME: str = "philoagents"
    MONGO_STATE_CHECKPOINT_COLLECTION: str = "philosopher_state_checkpoints"
    MONGO_STATE_WRITES_COLLECTION: str = "philosopher_state_writes"
    MONGO_LONG_TERM_MEMORY_COLLECTION: str = "philosopher_long_term_memory"
    MONGO_GAME_STATE_COLLECTION: str = "game_state"

    # --- Comet ML & Opik Configuration ---
    COMET_API_KEY: str | None = Field(
        default=None, description="API key for Comet ML and Opik services."
    )
    COMET_PROJECT: str = Field(
        default="philoagents_course",
        description="Project name for Comet ML and Opik tracking.",
    )

    # --- Agents Configuration ---
    TOTAL_MESSAGES_SUMMARY_TRIGGER: int = 30
    TOTAL_MESSAGES_AFTER_SUMMARY: int = 5

    # --- Game Loop Configuration ---
    AI_ACTION_TIMEOUT_SECONDS: int = 120
    JUDGE_TIMEOUT_SECONDS: int = 300
    MAX_VP_AWARD_PER_ROUND: int = Field(
        default=20,
        description=(
            "Upper bound on the victory points the Judge can award a single "
            "character in one round; larger awards are clamped."
        ),
    )

    # --- API Security Configuration ---
    CORS_ALLOW_ORIGINS: list[str] = Field(
        default=["http://localhost:8080"],
        description="Origins permitted to call the API (JSON list in the environment).",
    )
    MAX_WS_MESSAGE_BYTES: int = Field(
        default=16_384,
        description="Maximum size of a single inbound WebSocket message, in bytes.",
    )
    MAX_CHAT_MESSAGE_CHARS: int = Field(
        default=4_000,
        description="Maximum length of a chat message's text content.",
    )

    @field_validator("CORS_ALLOW_ORIGINS")
    @classmethod
    def _reject_wildcard_origin(cls, value: list[str]) -> list[str]:
        # A wildcard origin is unsafe together with allow_credentials=True and
        # defeats the point of the allowlist. Reject it so an env misconfiguration
        # can't silently reintroduce the insecure configuration.
        if "*" in value:
            raise ValueError(
                'CORS_ALLOW_ORIGINS must not contain "*"; a wildcard origin is '
                "unsafe with credentialed requests. List explicit origins instead."
            )
        return value

    # --- RAG Configuration ---
    RAG_TEXT_EMBEDDING_MODEL_ID: str = "sentence-transformers/all-MiniLM-L6-v2"
    RAG_TEXT_EMBEDDING_MODEL_DIM: int = 384
    RAG_TOP_K: int = 3
    RAG_DEVICE: str = "cpu"
    RAG_CHUNK_SIZE: int = 256

    # --- Paths Configuration ---
    EVALUATION_DATASET_FILE_PATH: Path = Path("data/evaluation_dataset.json")
    SCENARIO_PATH: Path = Path("scenarios/a_clash_of_titans_216bce")


settings = Settings()
