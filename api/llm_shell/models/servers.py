"""Server models."""

from pydantic import BaseModel, Field, field_validator

from llm_shell.models.common import AuthType


class ServerBase(BaseModel):
    """Base server fields."""

    group_id: str | None = None
    label: str = Field(..., min_length=1, max_length=100)
    host: str = Field(..., min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(..., min_length=1)
    auth_type: AuthType
    key_id: str | None = None
    proxy_jump: str | None = None
    startup_cmd: str | None = None
    notes: str | None = None
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: int = Field(default=0, ge=0)


class ServerCreate(ServerBase):
    """Server creation request."""

    password: str | None = None  # For auth_type=password, stored in keyring

    @field_validator("key_id")
    @classmethod
    def validate_key_auth(cls, v: str | None, info) -> str | None:
        """Validate that key_id is provided when auth_type is key."""
        if info.data.get("auth_type") == AuthType.KEY and not v:
            raise ValueError("key_id is required when auth_type is 'key'")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_auth(cls, v: str | None, info) -> str | None:
        """Validate that password is provided when auth_type is password."""
        if info.data.get("auth_type") == AuthType.PASSWORD and not v:
            raise ValueError("password is required when auth_type is 'password'")
        return v


class ServerUpdate(ServerBase):
    """Server update request (full update)."""

    password: str | None = None  # For auth_type=password, stored in keyring


class ServerOut(BaseModel):
    """Server response."""

    id: str
    group_id: str | None = None
    label: str
    host: str
    port: int = 22
    username: str
    auth_type: AuthType
    key_id: str | None = None
    proxy_jump: str | None = None
    startup_cmd: str | None = None
    notes: str | None = None
    color: str | None = None
    sort_order: int = 0
    last_connected_at: str | None = None
    created_at: str
    updated_at: str
