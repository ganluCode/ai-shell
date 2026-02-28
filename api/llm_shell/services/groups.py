"""Server group service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from llm_shell.db.database import Database
from llm_shell.exceptions import NotFoundError
from llm_shell.models.groups import ServerGroupCreate, ServerGroupOut, ServerGroupUpdate


class GroupsService:
    """Service for managing server groups."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def _row_to_out(self, row: dict[str, Any]) -> ServerGroupOut:
        """Convert database row to output model."""
        return ServerGroupOut(
            id=row["id"],
            name=row["name"],
            color=row["color"],
            sort_order=row["sort_order"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def list_all(self) -> list[ServerGroupOut]:
        """List all server groups ordered by sort_order."""
        rows = await self._db.fetchall(
            "SELECT * FROM server_groups ORDER BY sort_order, created_at"
        )
        return [self._row_to_out(row) for row in rows]

    async def get_by_id(self, group_id: str) -> ServerGroupOut:
        """Get a server group by ID."""
        row = await self._db.fetchone(
            "SELECT * FROM server_groups WHERE id = ?", (group_id,)
        )
        if row is None:
            raise NotFoundError("ServerGroup", group_id)
        return self._row_to_out(row)

    async def create(self, data: ServerGroupCreate) -> ServerGroupOut:
        """Create a new server group."""
        now = datetime.now(UTC).isoformat()
        group_id = str(uuid.uuid4())

        await self._db.execute(
            """
            INSERT INTO server_groups (id, name, color, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                group_id,
                data.name,
                data.color,
                data.sort_order,
                now,
                now,
            ),
        )
        await self._db.commit()

        return await self.get_by_id(group_id)

    async def update(self, group_id: str, data: ServerGroupUpdate) -> ServerGroupOut:
        """Update a server group (full update)."""
        # Check if exists first
        await self.get_by_id(group_id)

        now = datetime.now(UTC).isoformat()

        await self._db.execute(
            """
            UPDATE server_groups
            SET name = ?, color = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
            """,
            (data.name, data.color, data.sort_order, now, group_id),
        )
        await self._db.commit()

        return await self.get_by_id(group_id)

    async def delete(self, group_id: str) -> None:
        """Delete a server group. Sets group_id to NULL for related servers."""
        # Check if exists first
        await self.get_by_id(group_id)

        await self._db.execute("DELETE FROM server_groups WHERE id = ?", (group_id,))
        await self._db.commit()
