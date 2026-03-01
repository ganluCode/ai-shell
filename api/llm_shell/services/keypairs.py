"""SSH keypairs service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from llm_shell.db.database import Database
from llm_shell.exceptions import NotFoundError
from llm_shell.models.keypairs import KeyPairCreate, KeyPairOut, KeyPairUpdate


class KeyPairsService:
    """Service for SSH keypairs CRUD operations."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def _row_to_out(self, row: dict[str, Any]) -> KeyPairOut:
        """Convert database row to output model."""
        return KeyPairOut(
            id=row["id"],
            label=row["label"],
            private_key_path=row["private_key_path"],
            public_key_path=row["public_key_path"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def list_all(self) -> list[KeyPairOut]:
        """List all SSH keypairs."""
        rows = await self._db.fetchall(
            "SELECT * FROM keypairs ORDER BY created_at"
        )
        return [self._row_to_out(row) for row in rows]

    async def get_by_id(self, keypair_id: str) -> KeyPairOut:
        """Get an SSH keypair by ID."""
        row = await self._db.fetchone(
            "SELECT * FROM keypairs WHERE id = ?",
            (keypair_id,),
        )
        if row is None:
            raise NotFoundError("KeyPair", keypair_id)
        return self._row_to_out(row)

    async def create(self, data: KeyPairCreate) -> KeyPairOut:
        """Create a new SSH keypair."""
        now = datetime.now(UTC).isoformat()
        keypair_id = str(uuid.uuid4())

        # Store passphrase in keyring if provided
        if data.passphrase:
            self._store_passphrase(keypair_id, data.passphrase)

        await self._db.execute(
            """
            INSERT INTO keypairs (id, label, private_key_path, public_key_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                keypair_id,
                data.label,
                data.private_key_path,
                data.public_key_path,
                now,
                now,
            ),
        )
        await self._db.commit()

        return await self.get_by_id(keypair_id)

    async def update(self, keypair_id: str, data: KeyPairUpdate) -> KeyPairOut:
        """Update an SSH keypair (full update)."""
        # Check if exists
        await self.get_by_id(keypair_id)

        now = datetime.now(UTC).isoformat()

        # Update passphrase in keyring if provided
        if data.passphrase:
            self._store_passphrase(keypair_id, data.passphrase)

        await self._db.execute(
            """
            UPDATE keypairs
            SET label = ?, private_key_path = ?, public_key_path = ?, updated_at = ?
            WHERE id = ?
            """,
            (data.label, data.private_key_path, data.public_key_path, now, keypair_id),
        )
        await self._db.commit()

        return await self.get_by_id(keypair_id)

    async def delete(self, keypair_id: str) -> None:
        """Delete an SSH keypair."""
        # Check if exists
        await self.get_by_id(keypair_id)

        # Delete from keyring
        self._delete_passphrase(keypair_id)

        await self._db.execute(
            "DELETE FROM keypairs WHERE id = ?",
            (keypair_id,),
        )
        await self._db.commit()

    def _store_passphrase(self, keypair_id: str, passphrase: str) -> None:
        """Store passphrase in keyring."""
        import keyring

        keyring.set_password("llm-shell", f"keypair:{keypair_id}", passphrase)

    def _delete_passphrase(self, keypair_id: str) -> None:
        """Delete passphrase from keyring."""
        import keyring

        try:
            keyring.delete_password("llm-shell", f"keypair:{keypair_id}")
        except keyring.errors.PasswordDeleteError:
            pass  # Password doesn't exist, that's fine

    async def get_passphrase(self, keypair_id: str) -> str | None:
        """Get passphrase from keyring."""
        import keyring

        return keyring.get_password("llm-shell", f"keypair:{keypair_id}")
