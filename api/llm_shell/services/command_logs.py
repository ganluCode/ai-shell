"""Command logs service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from llm_shell.db.database import Database
from llm_shell.models.command_logs import CommandLogOut
from llm_shell.models.common import CommandSource, RiskLevel


class CommandLogsService:
    """Service for managing command logs."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def _row_to_out(self, row: dict[str, Any]) -> CommandLogOut:
        """Convert database row to output model."""
        return CommandLogOut(
            id=row["id"],
            server_id=row["server_id"],
            session_id=row["session_id"],
            command=row["command"],
            output_summary=row["output_summary"],
            risk_level=RiskLevel(row["risk_level"]) if row["risk_level"] else None,
            source=CommandSource(row["source"]),
            executed_at=row["executed_at"],
        )

    async def create(
        self,
        server_id: str,
        session_id: str,
        command: str,
        source: CommandSource,
        output_summary: str | None = None,
        risk_level: RiskLevel | None = None,
    ) -> CommandLogOut:
        """Create a new command log."""
        log_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()

        await self._db.execute(
            """
            INSERT INTO command_logs (
                id, server_id, session_id, command, output_summary,
                risk_level, source, executed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                log_id,
                server_id,
                session_id,
                command,
                output_summary,
                risk_level.value if risk_level else None,
                source.value,
                now,
            ),
        )
        await self._db.commit()

        row = await self._db.fetchone(
            "SELECT * FROM command_logs WHERE id = ?",
            (log_id,),
        )
        return self._row_to_out(row)

    async def get_by_server(
        self,
        server_id: str,
        offset: int,
        limit: int,
        source: CommandSource | None = None,
    ) -> list[CommandLogOut]:
        """Get command logs for a server with pagination and optional source filter."""
        if source:
            rows = await self._db.fetchall(
                """
                SELECT * FROM command_logs
                WHERE server_id = ? AND source = ?
                ORDER BY executed_at DESC
                LIMIT ? OFFSET ?
                """,
                (server_id, source.value, limit, offset),
            )
        else:
            rows = await self._db.fetchall(
                """
                SELECT * FROM command_logs
                WHERE server_id = ?
                ORDER BY executed_at DESC
                LIMIT ? OFFSET ?
                """,
                (server_id, limit, offset),
            )
        return [self._row_to_out(row) for row in rows]

    async def count_by_server(
        self,
        server_id: str,
        source: CommandSource | None = None,
    ) -> int:
        """Count total command logs for a server with optional source filter."""
        if source:
            row = await self._db.fetchone(
                "SELECT COUNT(*) as count FROM command_logs WHERE server_id = ? AND source = ?",
                (server_id, source.value),
            )
        else:
            row = await self._db.fetchone(
                "SELECT COUNT(*) as count FROM command_logs WHERE server_id = ?",
                (server_id,),
            )
        return row["count"] if row else 0
