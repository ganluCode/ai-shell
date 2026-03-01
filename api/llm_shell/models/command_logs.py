"""CommandLog models."""

from pydantic import BaseModel

from llm_shell.models.common import CommandSource, RiskLevel


class CommandLogOut(BaseModel):
    """Command log response."""

    id: str
    server_id: str
    session_id: str
    command: str
    output_summary: str | None = None
    risk_level: RiskLevel | None = None
    source: CommandSource
    executed_at: str


class CommandLogListResponse(BaseModel):
    """Paginated command log list response."""

    items: list[CommandLogOut]
    total: int
