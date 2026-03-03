"""Tests for SessionManager class."""

from unittest.mock import AsyncMock, MagicMock, patch

import asyncssh
import pytest

from llm_shell.db.database import Database
from llm_shell.exceptions import (
    NotFoundError,
    SSHAuthFailedError,
    SSHConnectionRefusedError,
)
from llm_shell.services.session_manager import SessionManager


@pytest.fixture
def mock_db() -> MagicMock:
    """Create a mock database."""
    db = MagicMock(spec=Database)
    return db


@pytest.fixture
def mock_keypair_row() -> dict:
    """Create a mock keypair row."""
    return {
        "id": "key-123",
        "label": "Test Key",
        "private_key_path": "/home/user/.ssh/id_rsa",
        "public_key_path": "/home/user/.ssh/id_rsa.pub",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }


@pytest.fixture
def mock_server_row_key_auth() -> dict:
    """Create a mock server row with key authentication."""
    return {
        "id": "server-123",
        "group_id": None,
        "label": "Test Server",
        "host": "192.168.1.100",
        "port": 22,
        "username": "root",
        "auth_type": "key",
        "key_id": "key-123",
        "proxy_jump": None,
        "startup_cmd": None,
        "notes": None,
        "color": None,
        "sort_order": 0,
        "last_connected_at": None,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }


@pytest.fixture
def mock_server_row_password_auth() -> dict:
    """Create a mock server row with password authentication."""
    return {
        "id": "server-456",
        "group_id": None,
        "label": "Password Server",
        "host": "192.168.1.200",
        "port": 22,
        "username": "admin",
        "auth_type": "password",
        "key_id": None,
        "proxy_jump": None,
        "startup_cmd": None,
        "notes": None,
        "color": None,
        "sort_order": 0,
        "last_connected_at": None,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }


class TestSessionManagerOpenSession:
    """Tests for SessionManager.open_session."""

    @pytest.mark.asyncio
    async def test_open_session_server_not_found(
        self, mock_db: MagicMock
    ) -> None:
        """Test that NotFoundError is raised when server doesn't exist."""
        mock_db.fetchone = AsyncMock(return_value=None)

        manager = SessionManager(mock_db)

        with pytest.raises(NotFoundError) as exc_info:
            await manager.open_session("nonexistent-server")

        assert exc_info.value.code == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_open_session_key_auth_success(
        self,
        mock_db: MagicMock,
        mock_server_row_key_auth: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test successful session creation with key authentication."""
        # Setup database mocks
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row_key_auth,  # Server lookup
                mock_keypair_row,  # Keypair lookup
                {"value": "1000"},  # output_buffer setting
            ]
        )
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Setup keyring mock
        with (
            patch(
                "llm_shell.services.security.get_secret"
            ) as mock_get_secret,
            patch(
                "asyncssh.connect", new_callable=AsyncMock
            ) as mock_connect,
        ):
            mock_get_secret.return_value = "test-passphrase"

            # Setup asyncssh mock
            mock_conn = AsyncMock()
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stdout.__aiter__ = MagicMock(return_value=iter([]))
            mock_conn.create_process = AsyncMock(return_value=mock_process)
            mock_connect.return_value = mock_conn

            # Setup probe_server mock
            with patch(
                "llm_shell.services.session_manager.probe_server", new_callable=AsyncMock
            ) as mock_probe:
                mock_probe.return_value = {
                    "uname": "Linux test 5.4.0",
                    "shell": "/bin/bash",
                    "os_release": "Ubuntu 20.04",
                    "username": "root",
                }

                manager = SessionManager(mock_db)
                session = await manager.open_session("server-123")

        # Verify session was created
        assert session is not None
        assert session.server_id == "server-123"
        assert session.server_info["uname"] == "Linux test 5.4.0"

        # Verify asyncssh.connect was called with correct params
        mock_connect.assert_called_once()
        call_kwargs = mock_connect.call_args.kwargs
        assert call_kwargs["host"] == "192.168.1.100"
        assert call_kwargs["port"] == 22
        assert call_kwargs["username"] == "root"
        assert call_kwargs["client_keys"] == ["/home/user/.ssh/id_rsa"]
        assert call_kwargs["passphrase"] == "test-passphrase"

        # Verify PTY was created with correct params
        mock_conn.create_process.assert_called_once()
        pty_kwargs = mock_conn.create_process.call_args.kwargs
        assert pty_kwargs["term_type"] == "xterm-256color"
        assert pty_kwargs["term_size"] == (80, 24)

        # Verify session is registered
        assert manager.get_session(session.id) is session

    @pytest.mark.asyncio
    async def test_open_session_password_auth_success(
        self,
        mock_db: MagicMock,
        mock_server_row_password_auth: dict,
    ) -> None:
        """Test successful session creation with password authentication."""
        # Setup database mocks
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row_password_auth,  # Server lookup
                {"value": "1000"},  # output_buffer setting
            ]
        )
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Setup keyring mock
        with (
            patch(
                "llm_shell.services.security.get_secret"
            ) as mock_get_secret,
            patch(
                "asyncssh.connect", new_callable=AsyncMock
            ) as mock_connect,
        ):
            mock_get_secret.return_value = "test-password"

            # Setup asyncssh mock
            mock_conn = AsyncMock()
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stdout.__aiter__ = MagicMock(return_value=iter([]))
            mock_conn.create_process = AsyncMock(return_value=mock_process)
            mock_connect.return_value = mock_conn

            # Setup probe_server mock
            with patch(
                "llm_shell.services.session_manager.probe_server", new_callable=AsyncMock
            ) as mock_probe:
                mock_probe.return_value = {
                    "uname": "Linux test 5.4.0",
                    "shell": "/bin/bash",
                    "os_release": "Ubuntu 20.04",
                    "username": "admin",
                }

                manager = SessionManager(mock_db)
                session = await manager.open_session("server-456")

        # Verify session was created
        assert session is not None
        assert session.server_id == "server-456"

        # Verify asyncssh.connect was called with password
        mock_connect.assert_called_once()
        call_kwargs = mock_connect.call_args.kwargs
        assert call_kwargs["host"] == "192.168.1.200"
        assert call_kwargs["password"] == "test-password"
        # client_keys should not be set for password auth
        assert "client_keys" not in call_kwargs

    @pytest.mark.asyncio
    async def test_open_session_auth_failure(
        self,
        mock_db: MagicMock,
        mock_server_row_key_auth: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that SSHAuthFailedError is raised on authentication failure."""
        # Setup database mocks
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row_key_auth,
                mock_keypair_row,
                {"value": "1000"},
            ]
        )

        with (
            patch(
                "llm_shell.services.security.get_secret"
            ) as mock_get_secret,
            patch(
                "asyncssh.connect", new_callable=AsyncMock
            ) as mock_connect,
        ):
            mock_get_secret.return_value = "wrong-passphrase"

            # Simulate auth failure
            mock_connect.side_effect = asyncssh.PermissionDenied("Auth failed")

            manager = SessionManager(mock_db)

            with pytest.raises(SSHAuthFailedError) as exc_info:
                await manager.open_session("server-123")

            assert exc_info.value.code == "SSH_AUTH_FAILED"

    @pytest.mark.asyncio
    async def test_open_session_connection_refused(
        self,
        mock_db: MagicMock,
        mock_server_row_key_auth: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that SSHConnectionRefusedError is raised on connection refused."""
        # Setup database mocks
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row_key_auth,
                mock_keypair_row,
                {"value": "1000"},
            ]
        )

        with (
            patch(
                "llm_shell.services.security.get_secret"
            ) as mock_get_secret,
            patch(
                "asyncssh.connect", new_callable=AsyncMock
            ) as mock_connect,
        ):
            mock_get_secret.return_value = "test-passphrase"

            # Simulate connection refused
            mock_connect.side_effect = OSError("Connection refused")

            manager = SessionManager(mock_db)

            with pytest.raises(SSHConnectionRefusedError) as exc_info:
                await manager.open_session("server-123")

            assert exc_info.value.code == "SSH_CONN_REFUSED"


class TestSessionManagerGetSession:
    """Tests for SessionManager.get_session."""

    def test_get_session_exists(self, mock_db: MagicMock) -> None:
        """Test getting an existing session."""
        manager = SessionManager(mock_db)

        # Manually add a mock session
        mock_session = MagicMock()
        mock_session.id = "session-123"
        manager._sessions["session-123"] = mock_session

        result = manager.get_session("session-123")
        assert result is mock_session

    def test_get_session_not_exists(self, mock_db: MagicMock) -> None:
        """Test getting a non-existent session returns None."""
        manager = SessionManager(mock_db)

        result = manager.get_session("nonexistent-session")
        assert result is None


class TestSessionManagerCloseSession:
    """Tests for SessionManager.close_session."""

    @pytest.mark.asyncio
    async def test_close_session_exists(self, mock_db: MagicMock) -> None:
        """Test closing an existing session."""
        manager = SessionManager(mock_db)

        # Manually add a mock session
        mock_session = AsyncMock()
        mock_session.id = "session-123"
        manager._sessions["session-123"] = mock_session

        await manager.close_session("session-123")

        # Verify session.close() was called
        mock_session.close.assert_called_once()

        # Verify session was removed from manager
        assert manager.get_session("session-123") is None

    @pytest.mark.asyncio
    async def test_close_session_not_exists(self, mock_db: MagicMock) -> None:
        """Test closing a non-existent session does nothing."""
        manager = SessionManager(mock_db)

        # Should not raise
        await manager.close_session("nonexistent-session")


class TestSessionManagerServerProbing:
    """Tests for server probing during session creation."""

    @pytest.mark.asyncio
    async def test_server_probing_stored_in_session(
        self,
        mock_db: MagicMock,
        mock_server_row_key_auth: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that server probing results are stored in the session."""
        # Setup database mocks
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row_key_auth,
                mock_keypair_row,
                {"value": "1000"},
            ]
        )
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        with (
            patch(
                "llm_shell.services.security.get_secret"
            ) as mock_get_secret,
            patch(
                "asyncssh.connect", new_callable=AsyncMock
            ) as mock_connect,
        ):
            mock_get_secret.return_value = "test-passphrase"

            mock_conn = AsyncMock()
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stdout.__aiter__ = MagicMock(return_value=iter([]))
            mock_conn.create_process = AsyncMock(return_value=mock_process)
            mock_connect.return_value = mock_conn

            expected_info = {
                "uname": "Linux testhost 5.15.0-91-generic #101-Ubuntu SMP x86_64",
                "shell": "/bin/zsh",
                "os_release": "PRETTY_NAME=\"Ubuntu 22.04.3 LTS\"",
                "username": "testuser",
            }

            with patch(
                "llm_shell.services.session_manager.probe_server", new_callable=AsyncMock
            ) as mock_probe:
                mock_probe.return_value = expected_info

                manager = SessionManager(mock_db)
                session = await manager.open_session("server-123")

        # Verify probing was called with the connection
        mock_probe.assert_called_once_with(mock_conn)

        # Verify server_info was stored correctly
        assert session.server_info == expected_info
        assert session.server_info["shell"] == "/bin/zsh"
        assert session.server_info["username"] == "testuser"


class TestSessionManagerSettings:
    """Tests for SessionManager using settings."""

    @pytest.mark.asyncio
    async def test_uses_output_buffer_setting(
        self,
        mock_db: MagicMock,
        mock_server_row_key_auth: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that output buffer capacity is read from settings."""
        # Setup database mocks with custom buffer size
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row_key_auth,
                mock_keypair_row,
                {"value": "500"},  # Custom output_buffer setting
            ]
        )
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        with (
            patch(
                "llm_shell.services.security.get_secret"
            ) as mock_get_secret,
            patch(
                "asyncssh.connect", new_callable=AsyncMock
            ) as mock_connect,
            patch(
                "llm_shell.services.session_manager.OutputBuffer"
            ) as mock_buffer_class,
        ):
            mock_get_secret.return_value = "test-passphrase"

            mock_conn = AsyncMock()
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stdout.__aiter__ = MagicMock(return_value=iter([]))
            mock_conn.create_process = AsyncMock(return_value=mock_process)
            mock_connect.return_value = mock_conn

            with patch(
                "llm_shell.services.session_manager.probe_server", new_callable=AsyncMock
            ) as mock_probe:
                mock_probe.return_value = {}

                manager = SessionManager(mock_db)
                await manager.open_session("server-123")

        # Verify OutputBuffer was created with correct capacity
        mock_buffer_class.assert_called_once_with(capacity=500)
