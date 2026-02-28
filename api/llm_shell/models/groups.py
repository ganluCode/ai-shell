"""Server group models."""

from pydantic import BaseModel, Field


class ServerGroupBase(BaseModel):
    """Base server group fields."""

    name: str = Field(..., min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: int = Field(default=0, ge=0)


class ServerGroupCreate(ServerGroupBase):
    """Server group creation request."""

    pass


class ServerGroupUpdate(ServerGroupBase):
    """Server group update request (full update)."""

    pass


class ServerGroupOut(BaseModel):
    """Server group response."""

    id: str
    name: str
    color: str | None = None
    sort_order: int = 0
    created_at: str
    updated_at: str
