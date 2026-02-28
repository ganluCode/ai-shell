"""Servers service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from llm_shell.db.database import Database
from llm_shell.exceptions import NotFoundError, ValidationError
from llm_shell.models.common import AuthType
from llm_shell.models.servers import ServerCreate, ServerOut, ServerUpdate


class ServersService:
    """Service for servers CRUD operations."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def _row_to_out(self, row: dict[str, Any]) -> ServerOut:
        """Convert database row to output model."""
        return ServerOut(
            id=row["id"],
            group_id=row["group_id"],
            label=row["label"],
            host=row["host"],
            port=row["port"],
            username=row["username"],
            auth_type=AuthType(row["auth_type"]),
            key_id=row["key_id"],
            proxy_jump=row["proxy_jump"],
            startup_cmd=row["startup_cmd"],
            notes=row["notes"],
            color=row["color"],
            sort_order=row["sort_order"],
            last_connected_at=row["last_connected_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def list_all(self, group_id: str | None = None) -> list[ServerOut]:
        """List all servers, optionally filtered by group."""
        if group_id:
            rows = await self._db.fetchall(
                "SELECT * FROM servers WHERE group_id = ? ORDER BY sort_order, created_at",
                (group_id,),
            )
        else:
            rows = await self._db.fetchall(
                "SELECT * FROM servers ORDER BY sort_order, created_at"
            )
        return [self._row_to_out(row) for row in rows]

    async def get_by_id(self, server_id: str) -> ServerOut:
        """Get a server by ID."""
        row = await self._db.fetchone(
            "SELECT * FROM servers WHERE id = ?",
            (server_id,),
        )
        if row is None:
            raise NotFoundError("Server", server_id)
        return self._row_to_out(row)

    async def _validate_references(
        self,
        group_id: str | None,
        key_id: str | None,
    ) -> None:
        """Validate that references exist."""
        if group_id:
            group = await self._db.fetchone(
                "SELECT id FROM server_groups WHERE id = ?",
                (group_id,),
            )
            if not group:
                raise ValidationError(f"Group '{group_id}' not found")

        if key_id:
            keypair = await self._db.fetchone(
                "SELECT id FROM keypairs WHERE id = ?",
                (key_id,),
            )
            if not keypair:
                raise ValidationError(f"KeyPair '{key_id}' not found")

    async def create(self, data: ServerCreate) -> ServerOut:
        """Create a new server."""
        # Validate references
        await self._validate_references(data.group_id, data.key_id)

        now = datetime.now(UTC).isoformat()
        server_id = str(uuid.uuid4())

        # Store password in keyring if provided
        if data.password:
            self._store_password(server_id, data.password)

        await self._db.execute(
            """
            INSERT INTO servers (
                id, group_id, label, host, port, username, auth_type, key_id,
                proxy_jump, startup_cmd, notes, color, sort_order,
                last_connected_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            (
                server_id,
                data.group_id,
                data.label,
                data.host,
                data.port,
                data.username,
                data.auth_type.value,
                data.key_id,
                data.proxy_jump,
                data.startup_cmd,
                data.notes,
                data.color,
                data.sort_order,
                now,
                now,
            ),
        )
        await self._db.commit()

        return await self.get_by_id(server_id)

    async def update(self, server_id: str, data: ServerUpdate) -> ServerOut:
        """Update a server (full update)."""
        # Check if exists
        await self.get_by_id(server_id)

        # Validate references
        await self._validate_references(data.group_id, data.key_id)

        now = datetime.now(UTC).isoformat()

        # Update password in keyring if provided
        if data.password is not None:
            self._store_password(server_id, data.password)

        await self._db.execute(
            """
            UPDATE servers
            SET group_id = ?, label = ?, host = ?, port = ?, username = ?,
                auth_type = ?, key_id = ?, proxy_jump = ?, startup_cmd = ?,
                notes = ?, color = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                data.group_id,
                data.label,
                data.host,
                data.port,
                data.username,
                data.auth_type.value,
                data.key_id,
                data.proxy_jump,
                data.startup_cmd,
                data.notes,
                data.color,
                data.sort_order,
                now,
                server_id,
            ),
        )
        await self._db.commit()

        return await self.get_by_id(server_id)

    async def delete(self, server_id: str) -> None:
        """Delete a server."""
        # Check if exists
        await self.get_by_id(server_id)

        # Delete password from keyring
        self._delete_password(server_id)

        await self._db.execute(
            "DELETE FROM servers WHERE id = ?",
            (server_id,),
        )
        await self._db.commit()

    def _store_password(self, server_id: str, password: str) -> None:
        """Store password in keyring."""
        import keyring

        keyring.set_password("llm-shell", f"server:{server_id}", password)

    def _delete_password(self, server_id: str) -> None:
        """Delete password from keyring."""
        import keyring

        try:
            keyring.delete_password("llm-shell", f"server:{server_id}")
        except keyring.errors.PasswordNotFoundError:
            pass  # Password doesn't exist, that's fine

    async def get_password(self, server_id: str) -> str | None:
        """Get password from keyring."""
        import keyring

        return keyring.get_password("llm-shell", f"server:{server_id}")
