"""Tests for WebSocket terminal endpoint."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from llm_shell.db.database import Database
from llm_shell.exceptions import SSHAuthFailedError
from llm_shell.main import app
from llm_shell.services.session_manager import SessionManager
from llm_shell.services.ssh_session import SSHSession, SSHSessionStatus


@pytest.fixture
def mock_db() -> MagicMock:
    """Create a mock database."""
    return MagicMock(spec=Database)


@pytest.fixture
def mock_session() -> MagicMock:
    """Create a mock SSH session."""
    session = MagicMock(spec=SSHSession)
    session.id = "session-123"
    session.server_id = "server-123"
    session.status = SSHSessionStatus.CONNECTED
    session.server_info = {
        "uname": "Linux test 5.4.0",
        "shell": "/bin/bash",
        "os_release": "Ubuntu 20.04",
        "username": "root",
    }

    # Mock async methods
    session.write_input = AsyncMock()
    session.close = AsyncMock()
    session.change_terminal_size = MagicMock()

    # Mock process with stdout that supports read() and at_eof()
    mock_process = MagicMock()
    mock_stdout = MagicMock()

    # Simulate: first read returns data, then EOF
    _eof = False

    def at_eof():
        return _eof

    async def read(n=65536):
        nonlocal _eof
        if not _eof:
            _eof = True
            return "test output"
        return ""

    mock_stdout.at_eof = at_eof
    mock_stdout.read = read
    mock_process.stdout = mock_stdout
    session.process = mock_process

    # Mock output buffer
    session.output_buffer = MagicMock()
    session.output_buffer.append = MagicMock()

    return session


@pytest.fixture
def mock_session_manager(mock_session: MagicMock) -> MagicMock:
    """Create a mock session manager."""
    manager = MagicMock(spec=SessionManager)
    manager.open_session = AsyncMock(return_value=mock_session)
    manager.get_session = MagicMock(return_value=mock_session)
    manager.close_session = AsyncMock()
    return manager


class TestTerminalWebSocketConnection:
    """Tests for WebSocket connection establishment."""

    def test_ws_connection_sends_connected_status(
        self,
        mock_db: MagicMock,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test that WebSocket sends status:connected after session opens."""
        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-123/terminal"
                ) as websocket:
                    # Receive the first message - should be status:connected
                    data = websocket.receive_json()
                    assert data["type"] == "status"
                    assert data["status"] == "connected"
        finally:
            app.dependency_overrides.clear()

    def test_ws_connection_opens_session_with_server_id(
        self,
        mock_db: MagicMock,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test that WebSocket opens session with correct server_id."""
        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-456/terminal"
                ) as websocket:
                    # Consume the connected status message
                    websocket.receive_json()

                    # Verify open_session was called with correct server_id
                    mock_session_manager.open_session.assert_called_once_with(
                        "server-456"
                    )
        finally:
            app.dependency_overrides.clear()


class TestTerminalWebSocketInput:
    """Tests for WebSocket input message handling."""

    def test_ws_input_message_forwards_to_pty(
        self,
        mock_db: MagicMock,
        mock_session_manager: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Test that input messages are forwarded to PTY."""
        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-123/terminal"
                ) as websocket:
                    # Consume connected status
                    websocket.receive_json()

                    # Send input message
                    websocket.send_json({"type": "input", "data": "ls -la\r"})

                    # Give some time for async processing
                    import time

                    time.sleep(0.1)

                    # Verify write_input was called with correct data
                    mock_session.write_input.assert_called_with("ls -la\r")
        finally:
            app.dependency_overrides.clear()

    def test_ws_resize_message_calls_change_terminal_size(
        self,
        mock_db: MagicMock,
        mock_session_manager: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Test that resize messages call change_terminal_size."""
        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-123/terminal"
                ) as websocket:
                    # Consume connected status
                    websocket.receive_json()

                    # Send resize message
                    websocket.send_json({"type": "resize", "cols": 120, "rows": 40})

                    # Give some time for async processing
                    import time

                    time.sleep(0.1)

                    # Verify change_terminal_size was called with correct params
                    mock_session.change_terminal_size.assert_called_once_with(120, 40)
        finally:
            app.dependency_overrides.clear()


class TestTerminalWebSocketOutput:
    """Tests for WebSocket output forwarding."""

    def test_ws_forwards_pty_output_as_output_message(
        self,
        mock_db: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Test that PTY output is sent as output message to WebSocket."""
        # Create a session manager that returns our mock session
        manager = MagicMock(spec=SessionManager)
        manager.open_session = AsyncMock(return_value=mock_session)
        manager.get_session = MagicMock(return_value=mock_session)
        manager.close_session = AsyncMock()

        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-123/terminal"
                ) as websocket:
                    # First message should be connected status
                    status_msg = websocket.receive_json()
                    assert status_msg["type"] == "status"
                    assert status_msg["status"] == "connected"

                    # Second message should be PTY output
                    output_msg = websocket.receive_json()
                    assert output_msg["type"] == "output"
                    assert output_msg["data"] == "test output"
        finally:
            app.dependency_overrides.clear()


class TestTerminalWebSocketError:
    """Tests for WebSocket error handling."""

    def test_ws_sends_error_on_ssh_auth_failure(
        self,
        mock_db: MagicMock,
    ) -> None:
        """Test that SSHError sends error message before closing."""
        # Create a session manager that raises SSHAuthFailedError
        manager = MagicMock(spec=SessionManager)
        manager.open_session = AsyncMock(
            side_effect=SSHAuthFailedError(detail="Invalid credentials")
        )
        manager.close_session = AsyncMock()

        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-123/terminal"
                ) as websocket:
                    # Should receive error message
                    error_msg = websocket.receive_json()
                    assert error_msg["type"] == "error"
                    assert error_msg["code"] == "SSH_AUTH_FAILED"
                    assert "authentication" in error_msg["message"].lower()

                    # Connection should close after error
                    # WebSocket should close - receive_json will raise
                    with pytest.raises(Exception):
                        websocket.receive_json()
        finally:
            app.dependency_overrides.clear()

    def test_ws_sends_error_on_server_not_found(
        self,
        mock_db: MagicMock,
    ) -> None:
        """Test that NotFoundError sends error message before closing."""
        from llm_shell.exceptions import NotFoundError

        # Create a session manager that raises NotFoundError
        manager = MagicMock(spec=SessionManager)
        manager.open_session = AsyncMock(
            side_effect=NotFoundError("Server", "server-999")
        )
        manager.close_session = AsyncMock()

        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-999/terminal"
                ) as websocket:
                    # Should receive error message
                    error_msg = websocket.receive_json()
                    assert error_msg["type"] == "error"
                    assert error_msg["code"] == "NOT_FOUND"

                    # Connection should close after error
                    with pytest.raises(Exception):
                        websocket.receive_json()
        finally:
            app.dependency_overrides.clear()


class TestTerminalWebSocketCleanup:
    """Tests for WebSocket cleanup on disconnect."""

    def test_ws_closes_session_on_disconnect(
        self,
        mock_db: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Test that session is closed when WebSocket disconnects."""
        manager = MagicMock(spec=SessionManager)
        manager.open_session = AsyncMock(return_value=mock_session)
        manager.get_session = MagicMock(return_value=mock_session)
        manager.close_session = AsyncMock()

        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: manager

        try:
            with TestClient(app=app) as client:
                with client.websocket_connect(
                    "/api/sessions/server-123/terminal"
                ) as websocket:
                    # Consume connected status
                    websocket.receive_json()

                    # Close the WebSocket
                    websocket.close()

            # Give time for cleanup
            import time

            time.sleep(0.2)

            # Verify session was closed (may be called more than once due to
            # output forwarding EOF triggering reconnection + final cleanup)
            manager.close_session.assert_called()
        finally:
            app.dependency_overrides.clear()
