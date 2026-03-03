"""Session manager for managing active SSH sessions."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import asyncssh

from llm_shell.db.database import Database
from llm_shell.exceptions import (
    NotFoundError,
    SSHAuthFailedError,
    SSHConnectionRefusedError,
    SSHHostKeyInvalidError,
)
from llm_shell.services import security
from llm_shell.services.output_buffer import OutputBuffer
from llm_shell.services.ssh_session import SSHSession, probe_server

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages active SSH sessions.

    This class is responsible for:
    - Creating and establishing SSH connections
    - Managing PTY processes
    - Registering and tracking active sessions
    - Mapping asyncssh exceptions to application errors
    """

    def __init__(self, db: Database) -> None:
        """Initialize the session manager.

        Args:
            db: Database instance for reading server configurations.
        """
        self._db = db
        self._sessions: dict[str, SSHSession] = {}

    async def _get_output_buffer_capacity(self) -> int:
        """Get output buffer capacity from settings.

        Returns:
            Buffer capacity (default 1000).
        """
        row = await self._db.fetchone(
            "SELECT value FROM settings WHERE key = 'output_buffer'"
        )
        if row:
            try:
                return int(row["value"])
            except (ValueError, TypeError):
                pass
        return 1000

    async def open_session(self, server_id: str) -> SSHSession:
        """Open a new SSH session to a server.

        Args:
            server_id: ID of the server to connect to.

        Returns:
            The created SSHSession instance.

        Raises:
            NotFoundError: If the server doesn't exist.
            SSHAuthFailedError: If authentication fails.
            SSHConnectionRefusedError: If connection is refused.
            SSHHostKeyInvalidError: If host key verification fails.
        """
        # Read server config from database
        server_row = await self._db.fetchone(
            "SELECT * FROM servers WHERE id = ?",
            (server_id,),
        )
        if server_row is None:
            raise NotFoundError("Server", server_id)

        # Prepare connection parameters
        host = server_row["host"]
        port = server_row["port"]
        username = server_row["username"]
        auth_type = server_row["auth_type"]

        conn_params: dict[str, Any] = {
            "host": host,
            "port": port,
            "username": username,
            "keepalive_interval": 15,
        }

        # Get authentication credentials
        if auth_type == "key":
            # Read keypair from database
            key_id = server_row["key_id"]
            if key_id:
                keypair_row = await self._db.fetchone(
                    "SELECT * FROM keypairs WHERE id = ?",
                    (key_id,),
                )
                if keypair_row:
                    conn_params["client_keys"] = [keypair_row["private_key_path"]]
                    # Get passphrase from keyring
                    passphrase = security.get_secret(f"passphrase:{key_id}")
                    if passphrase:
                        conn_params["passphrase"] = passphrase
        else:  # password auth
            # Get password from keyring
            password = security.get_secret(f"password:{server_id}")
            conn_params["password"] = password

        # Get output buffer capacity
        buffer_capacity = await self._get_output_buffer_capacity()

        # Connect via asyncssh
        try:
            conn = await asyncssh.connect(**conn_params)
        except asyncssh.PermissionDenied as e:
            logger.warning(f"SSH auth failed for {host}:{port}: {e}")
            raise SSHAuthFailedError(detail=str(e)) from e
        except asyncssh.HostKeyNotVerifiable as e:
            logger.warning(f"SSH host key verification failed for {host}:{port}: {e}")
            raise SSHHostKeyInvalidError(detail=str(e)) from e
        except OSError as e:
            logger.warning(f"SSH connection refused for {host}:{port}: {e}")
            raise SSHConnectionRefusedError(host, port) from e

        # Create PTY process
        process = await conn.create_process(
            term_type="xterm-256color",
            term_size=(80, 24),
        )

        # Probe server for information
        server_info = await probe_server(conn)

        # Create output buffer
        output_buffer = OutputBuffer(capacity=buffer_capacity)

        # Create session
        session_id = str(uuid.uuid4())
        session = SSHSession(
            id=session_id,
            server_id=server_id,
            connection=conn,
            process=process,
            output_buffer=output_buffer,
            server_info=server_info,
        )

        # Register session
        self._sessions[session_id] = session

        # Update server's last_connected_at timestamp
        now = datetime.now(UTC).isoformat()
        await self._db.execute(
            "UPDATE servers SET last_connected_at = ? WHERE id = ?",
            (now, server_id),
        )
        await self._db.commit()

        logger.info(f"Opened SSH session {session_id} to {host}:{port}")

        return session

    def get_session(self, session_id: str) -> SSHSession | None:
        """Get an active session by ID.

        Args:
            session_id: ID of the session to retrieve.

        Returns:
            The SSHSession if found, None otherwise.
        """
        return self._sessions.get(session_id)

    async def close_session(self, session_id: str) -> None:
        """Close and remove a session.

        Args:
            session_id: ID of the session to close.
        """
        session = self._sessions.pop(session_id, None)
        if session:
            await session.close()
            logger.info(f"Closed SSH session {session_id}")
