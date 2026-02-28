"""Settings models."""


from pydantic import BaseModel, Field


class SettingsAllOut(BaseModel):
    """All settings response."""

    model: str
    terminal_font: str
    terminal_size: str
    theme: str
    output_buffer: str
    context_lines: str
    max_chat_rounds: str
    api_key_masked: str = ""  # Masked API key (e.g., "sk-***abcd")


class SettingsUpdate(BaseModel):
    """Settings partial update request."""

    model: str | None = None
    terminal_font: str | None = None
    terminal_size: str | None = None
    theme: str | None = Field(None, pattern=r"^(light|dark)$")
    output_buffer: str | None = None
    context_lines: str | None = None
    max_chat_rounds: str | None = None
    api_key: str | None = None  # Stored in keyring, not database


class SettingOut(BaseModel):
    """Single setting response."""

    key: str
    value: str
