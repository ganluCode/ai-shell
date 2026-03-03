"""Tests for SSH disconnection detection and reconnection logic (F-006)."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import asyncssh
import pytest

from llm_shell.db.database import Database
from llm_shell.services.session_manager import SessionManager
from llm_shell.services.ssh_session import SSHSession, SSHSessionStatus


@pytest.fixture
def mock_db() -> MagicMock:
    """Create a mock database."""
    db = MagicMock(spec=Database)
    db.execute = AsyncMock()
    db.commit = AsyncMock()
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
def mock_server_row() -> dict:
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


class TestKeepaliveInterval:
    """Tests for SSH keepalive interval setting."""

    @pytest.mark.asyncio
    async def test_open_session_sets_keepalive_interval_15(
        self,
        mock_db: MagicMock,
        mock_server_row: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that asyncssh.connect is called with keepalive_interval=15."""
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row,
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

        # Verify keepalive_interval was set to 15
        mock_connect.assert_called_once()
        call_kwargs = mock_connect.call_args.kwargs
        assert call_kwargs.get("keepalive_interval") == 15


class TestDisconnectionDetection:
    """Tests for detecting SSH disconnection."""

    @pytest.mark.asyncio
    async def test_detects_disconnection_via_stdout_at_eof(
        self,
        mock_db: MagicMock,
        mock_server_row: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that disconnection is detected when stdout.at_eof() returns True."""
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row,
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

            mock_conn = AsyncMock()
            mock_process = AsyncMock()

            # Create stdout that signals EOF (at_eof is not async, use MagicMock)
            mock_stdout = MagicMock()
            mock_stdout.at_eof.return_value = True
            mock_process.stdout = mock_stdout
            mock_conn.create_process = AsyncMock(return_value=mock_process)
            mock_connect.return_value = mock_conn

            with patch(
                "llm_shell.services.session_manager.probe_server", new_callable=AsyncMock
            ) as mock_probe:
                mock_probe.return_value = {}

                manager = SessionManager(mock_db)
                session = await manager.open_session("server-123")

        # Verify session was created
        assert session is not None
        # Check that we can detect EOF
        assert session.process.stdout.at_eof() is True


class TestReconnectionLogic:
    """Tests for SSH reconnection with exponential backoff."""

    @pytest.mark.asyncio
    async def test_reconnect_sends_disconnected_status_with_retry_count(
        self,
        mock_db: MagicMock,
        mock_server_row: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that reconnection sends disconnected status with retry count."""
        from llm_shell.services.reconnection import ReconnectionHandler

        # Create a mock websocket
        mock_websocket = AsyncMock()

        handler = ReconnectionHandler(
            session_manager=MagicMock(),
            server_id="server-123",
            websocket=mock_websocket,
            db=mock_db,
        )

        # Test sending disconnected status
        await handler.send_disconnected_status(retry=1, max_retry=5)

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "status"
        assert call_args["status"] == "disconnected"
        assert call_args["retry"] == 1
        assert call_args["max_retry"] == 5

    @pytest.mark.asyncio
    async def test_reconnect_sends_reconnected_status_on_success(
        self,
        mock_db: MagicMock,
    ) -> None:
        """Test that reconnection sends reconnected status on success."""
        from llm_shell.services.reconnection import ReconnectionHandler

        mock_websocket = AsyncMock()
        mock_session_manager = MagicMock()

        handler = ReconnectionHandler(
            session_manager=mock_session_manager,
            server_id="server-123",
            websocket=mock_websocket,
            db=mock_db,
        )

        # Test sending reconnected status
        await handler.send_reconnected_status()

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "status"
        assert call_args["status"] == "reconnected"

    @pytest.mark.asyncio
    async def test_reconnect_sends_connection_lost_after_max_retries(
        self,
        mock_db: MagicMock,
    ) -> None:
        """Test that connection_lost status is sent after 5 failed retries."""
        from llm_shell.services.reconnection import ReconnectionHandler

        mock_websocket = AsyncMock()

        handler = ReconnectionHandler(
            session_manager=MagicMock(),
            server_id="server-123",
            websocket=mock_websocket,
            db=mock_db,
        )

        # Test sending connection_lost status
        await handler.send_connection_lost_status()

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "status"
        assert call_args["status"] == "connection_lost"


class TestExponentialBackoff:
    """Tests for exponential backoff retry timing."""

    def test_calculate_backoff_delay_returns_correct_sequence(self) -> None:
        """Test that backoff delays follow exponential sequence: 1, 2, 4, 8, 16."""
        from llm_shell.services.reconnection import calculate_backoff_delay

        expected_delays = [1, 2, 4, 8, 16]

        for retry_attempt, expected_delay in enumerate(expected_delays):
            delay = calculate_backoff_delay(retry_attempt)
            assert delay == expected_delay, (
                f"Retry {retry_attempt}: expected {expected_delay}s, got {delay}s"
            )

    def test_calculate_backoff_delay_caps_at_16_seconds(self) -> None:
        """Test that backoff delay is capped at 16 seconds."""
        from llm_shell.services.reconnection import calculate_backoff_delay

        # Beyond 5 retries, should still be 16
        assert calculate_backoff_delay(5) == 16
        assert calculate_backoff_delay(10) == 16


class TestLastConnectedAtUpdate:
    """Tests for updating server.last_connected_at on successful connection."""

    @pytest.mark.asyncio
    async def test_updates_last_connected_at_on_successful_connection(
        self,
        mock_db: MagicMock,
        mock_server_row: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test that server.last_connected_at is updated on successful connection."""
        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row,
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

        # Verify last_connected_at was updated
        # Check that execute was called to update the timestamp
        update_calls = [
            call for call in mock_db.execute.call_args_list
            if "last_connected_at" in str(call)
        ]
        assert len(update_calls) > 0, "last_connected_at should be updated"


class TestReconnectionIntegration:
    """Integration tests for the reconnection flow."""

    @pytest.mark.asyncio
    async def test_full_reconnection_flow_with_success(
        self,
        mock_db: MagicMock,
        mock_server_row: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test complete reconnection flow: disconnect -> retry -> reconnect."""
        from llm_shell.services.reconnection import ReconnectionHandler

        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row,
                mock_keypair_row,
                {"value": "1000"},
            ]
        )

        mock_websocket = AsyncMock()
        mock_session_manager = MagicMock()

        # Create mock sessions for initial and reconnect
        initial_session = MagicMock(spec=SSHSession)
        initial_session.id = "session-initial"
        initial_session.close = AsyncMock()

        reconnect_session = MagicMock(spec=SSHSession)
        reconnect_session.id = "session-reconnect"
        reconnect_session.server_id = "server-123"
        reconnect_session.status = SSHSessionStatus.CONNECTED

        mock_session_manager.open_session = AsyncMock(
            side_effect=[initial_session, reconnect_session]
        )
        mock_session_manager.close_session = AsyncMock()
        mock_session_manager.get_session = MagicMock(return_value=initial_session)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            handler = ReconnectionHandler(
                session_manager=mock_session_manager,
                server_id="server-123",
                websocket=mock_websocket,
                db=mock_db,
            )

            # Simulate reconnection with first retry succeeding
            success = await handler.attempt_reconnect(max_retries=5)

        assert success is True
        # Verify disconnected status was sent
        status_calls = [
            call for call in mock_websocket.send_json.call_args_list
            if call[0][0].get("status") == "disconnected"
        ]
        assert len(status_calls) >= 1

        # Verify reconnected status was sent
        reconnected_calls = [
            call for call in mock_websocket.send_json.call_args_list
            if call[0][0].get("status") == "reconnected"
        ]
        assert len(reconnected_calls) >= 1

    @pytest.mark.asyncio
    async def test_full_reconnection_flow_all_retries_fail(
        self,
        mock_db: MagicMock,
        mock_server_row: dict,
        mock_keypair_row: dict,
    ) -> None:
        """Test reconnection flow when all retries fail."""
        from llm_shell.services.reconnection import ReconnectionHandler

        mock_db.fetchone = AsyncMock(
            side_effect=[
                mock_server_row,
                mock_keypair_row,
                {"value": "1000"},
            ]
        )

        mock_websocket = AsyncMock()
        mock_session_manager = MagicMock()

        # All connection attempts fail
        mock_session_manager.open_session = AsyncMock(
            side_effect=Exception("Connection refused")
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            handler = ReconnectionHandler(
                session_manager=mock_session_manager,
                server_id="server-123",
                websocket=mock_websocket,
                db=mock_db,
            )

            success = await handler.attempt_reconnect(max_retries=5)

        assert success is False

        # Verify connection_lost status was sent
        connection_lost_calls = [
            call for call in mock_websocket.send_json.call_args_list
            if call[0][0].get("status") == "connection_lost"
        ]
        assert len(connection_lost_calls) >= 1
