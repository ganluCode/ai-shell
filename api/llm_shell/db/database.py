"""Database connection and schema management."""

import importlib.resources
from pathlib import Path
from typing import Any

import aiosqlite
from platformdirs import user_data_dir


class Database:
    """Async SQLite database handler."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        """Connect to the database and initialize schema."""
        # Ensure directory exists
        self._db_path.parent.mkdir(parents=True, exist_ok=True)

        # Connect with restricted permissions
        self._conn = await aiosqlite.connect(self._db_path)
        await self._conn.execute("PRAGMA foreign_keys = ON")

        # Set file permissions to 0o600 (owner read/write only)
        self._db_path.chmod(0o600)

        # Initialize schema
        await self._init_schema()

    async def _init_schema(self) -> None:
        """Initialize database schema from SQL file."""
        schema_sql = (
            importlib.resources.files("llm_shell.db")
            .joinpath("schema.sql")
            .read_text()
        )
        await self._conn.executescript(schema_sql)
        await self._conn.commit()

    async def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def execute(
        self,
        query: str,
        params: tuple[Any, ...] = (),
    ) -> aiosqlite.Cursor:
        """Execute a query and return cursor."""
        if not self._conn:
            raise RuntimeError("Database not connected")
        return await self._conn.execute(query, params)

    async def fetchone(
        self,
        query: str,
        params: tuple[Any, ...] = (),
    ) -> dict[str, Any] | None:
        """Execute query and fetch one row as dict."""
        if not self._conn:
            raise RuntimeError("Database not connected")
        async with self._conn.execute(query, params) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))

    async def fetchall(
        self,
        query: str,
        params: tuple[Any, ...] = (),
    ) -> list[dict[str, Any]]:
        """Execute query and fetch all rows as dicts."""
        if not self._conn:
            raise RuntimeError("Database not connected")
        async with self._conn.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]

    async def commit(self) -> None:
        """Commit current transaction."""
        if self._conn:
            await self._conn.commit()


def get_default_db_path() -> Path:
    """Get the default database path using platformdirs."""
    data_dir = Path(user_data_dir("llm-shell"))
    return data_dir / "data.db"


# Global database instance
_db: Database | None = None


async def get_database() -> Database:
    """Get or create the database instance."""
    global _db
    if _db is None:
        from llm_shell.config import get_settings

        settings = get_settings()
        db_path = settings.database_path or get_default_db_path()
        _db = Database(db_path)
        await _db.connect()
    return _db


async def close_database() -> None:
    """Close the database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None
