"""Application configuration."""

from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="LLM_SHELL_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server configuration
    host: str = "127.0.0.1"
    port: int = 8765
    debug: bool = False

    # Database configuration
    database_path: Path | None = None  # If None, uses platformdirs default

    # CORS configuration
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # SSH configuration
    ssh_keepalive_interval: int = 15
    ssh_connection_timeout: int = 30

    # AI configuration
    default_model: str = "MiniMax-M2.5"
    anthropic_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_SHELL_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"),
    )
    anthropic_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_SHELL_ANTHROPIC_BASE_URL", "ANTHROPIC_BASE_URL"),
    )
    max_context_lines: int = 1000
    default_context_lines: int = 50
    max_chat_rounds: int = 10

    # Terminal configuration
    default_terminal_font: str = "Monaco"
    default_terminal_size: str = "14"

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"


def get_settings() -> Settings:
    """Get application settings singleton."""
    return Settings()
