"""Tests for SSHSession class."""

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from llm_shell.services.output_buffer import OutputBuffer
from llm_shell.services.ssh_session import SSHSession, SSHSessionStatus


class TestSSHSessionAttributes:
    """Test SSHSession has required attributes."""

    def test_ssh_session_has_id(self) -> None:
        """SSHSession should have an id attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.id == "test-session-id"

    def test_ssh_session_has_server_id(self) -> None:
        """SSHSession should have a server_id attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.server_id == "server-123"

    def test_ssh_session_has_connection(self) -> None:
        """SSHSession should have a connection attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.connection is mock_connection

    def test_ssh_session_has_process(self) -> None:
        """SSHSession should have a process attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.process is mock_process

    def test_ssh_session_has_output_buffer(self) -> None:
        """SSHSession should have an output_buffer attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.output_buffer is buffer

    def test_ssh_session_has_server_info(self) -> None:
        """SSHSession should have a server_info attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()
        server_info = {"hostname": "test-host", "os": "Linux"}

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
            server_info=server_info,
        )

        assert session.server_info == server_info

    def test_ssh_session_server_info_defaults_to_empty_dict(self) -> None:
        """SSHSession server_info should default to empty dict."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.server_info == {}

    def test_ssh_session_has_status(self) -> None:
        """SSHSession should have a status attribute."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert hasattr(session, "status")

    def test_ssh_session_status_defaults_to_connected(self) -> None:
        """SSHSession status should default to CONNECTED."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.status == SSHSessionStatus.CONNECTED


class TestSSHSessionChangeTerminalSize:
    """Test change_terminal_size method."""

    def test_change_terminal_size_calls_process(self) -> None:
        """change_terminal_size should call process.change_terminal_size."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        mock_process.change_terminal_size = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        session.change_terminal_size(120, 40)

        mock_process.change_terminal_size.assert_called_once_with(120, 40)

    def test_change_terminal_size_with_different_dimensions(self) -> None:
        """change_terminal_size should work with different dimensions."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        mock_process.change_terminal_size = MagicMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        session.change_terminal_size(80, 24)
        mock_process.change_terminal_size.assert_called_with(80, 24)

        session.change_terminal_size(200, 50)
        mock_process.change_terminal_size.assert_called_with(200, 50)


class TestSSHSessionWriteInput:
    """Test write_input method."""

    @pytest.mark.asyncio
    async def test_write_input_writes_to_stdin(self) -> None:
        """write_input should write data to process.stdin."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        # stdin.write() is synchronous, only drain() is async
        mock_stdin = MagicMock()
        mock_stdin.drain = AsyncMock()
        mock_process.stdin = mock_stdin
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        await session.write_input("ls -la\n")

        mock_stdin.write.assert_called_once_with(b"ls -la\n")

    @pytest.mark.asyncio
    async def test_write_input_with_bytes(self) -> None:
        """write_input should accept bytes."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        # stdin.write() is synchronous, only drain() is async
        mock_stdin = MagicMock()
        mock_stdin.drain = AsyncMock()
        mock_process.stdin = mock_stdin
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        await session.write_input(b"cd /tmp\n")

        mock_stdin.write.assert_called_once_with(b"cd /tmp\n")

    @pytest.mark.asyncio
    async def test_write_input_with_special_characters(self) -> None:
        """write_input should handle special characters like Ctrl-C."""
        mock_connection = MagicMock()
        mock_process = MagicMock()
        # stdin.write() is synchronous, only drain() is async
        mock_stdin = MagicMock()
        mock_stdin.drain = AsyncMock()
        mock_process.stdin = mock_stdin
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        await session.write_input("\x03")  # Ctrl-C

        mock_stdin.write.assert_called_once_with(b"\x03")


class TestSSHSessionReadOutput:
    """Test read_output method."""

    @pytest.mark.asyncio
    async def test_read_output_iterates_stdout(self) -> None:
        """read_output should iterate process.stdout and write to buffer."""
        mock_connection = MagicMock()
        mock_process = MagicMock()

        # Create async iterator for stdout
        async def stdout_generator() -> Any:
            yield b"line 1\n"
            yield b"line 2\n"
            yield b"line 3\n"

        mock_stdout = stdout_generator()
        mock_process.stdout = mock_stdout

        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        # Start read_output in background and collect some output
        read_task = asyncio.create_task(session.read_output())

        # Give some time for the task to process
        await asyncio.sleep(0.1)

        # Cancel the infinite loop
        read_task.cancel()
        try:
            await read_task
        except asyncio.CancelledError:
            pass

        # Verify buffer has the lines
        assert "line 1" in buffer.get_all()
        assert "line 2" in buffer.get_all()
        assert "line 3" in buffer.get_all()

    @pytest.mark.asyncio
    async def test_read_output_strips_ansi_codes(self) -> None:
        """read_output should write stripped output to buffer."""
        mock_connection = MagicMock()
        mock_process = MagicMock()

        async def stdout_generator() -> Any:
            yield b"\x1b[32mgreen text\x1b[0m\n"

        mock_stdout = stdout_generator()
        mock_process.stdout = mock_stdout

        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        read_task = asyncio.create_task(session.read_output())
        await asyncio.sleep(0.1)
        read_task.cancel()
        try:
            await read_task
        except asyncio.CancelledError:
            pass

        # ANSI codes should be stripped
        assert buffer.get_all() == ["green text"]


class TestSSHSessionClose:
    """Test close method."""

    @pytest.mark.asyncio
    async def test_close_closes_process(self) -> None:
        """close should close the process."""
        mock_connection = MagicMock()
        mock_connection.close = MagicMock()
        mock_connection.wait_closed = AsyncMock()
        mock_process = MagicMock()
        mock_process.close = MagicMock()
        mock_process.wait_closed = AsyncMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        await session.close()

        mock_process.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_closes_connection(self) -> None:
        """close should close the connection."""
        mock_connection = MagicMock()
        mock_connection.close = MagicMock()
        mock_connection.wait_closed = AsyncMock()
        mock_process = MagicMock()
        mock_process.close = MagicMock()
        mock_process.wait_closed = AsyncMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        await session.close()

        mock_connection.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_updates_status_to_disconnected(self) -> None:
        """close should update status to DISCONNECTED."""
        mock_connection = MagicMock()
        mock_connection.close = MagicMock()
        mock_connection.wait_closed = AsyncMock()
        mock_process = MagicMock()
        mock_process.close = MagicMock()
        mock_process.wait_closed = AsyncMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=mock_process,
            output_buffer=buffer,
        )

        assert session.status == SSHSessionStatus.CONNECTED

        await session.close()

        assert session.status == SSHSessionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_close_handles_none_process(self) -> None:
        """close should handle None process gracefully."""
        mock_connection = MagicMock()
        mock_connection.close = MagicMock()
        mock_connection.wait_closed = AsyncMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=mock_connection,
            process=None,
            output_buffer=buffer,
        )

        # Should not raise
        await session.close()

        mock_connection.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_handles_none_connection(self) -> None:
        """close should handle None connection gracefully."""
        mock_process = MagicMock()
        mock_process.close = MagicMock()
        mock_process.wait_closed = AsyncMock()
        buffer = OutputBuffer()

        session = SSHSession(
            id="test-session-id",
            server_id="server-123",
            connection=None,
            process=mock_process,
            output_buffer=buffer,
        )

        # Should not raise
        await session.close()

        mock_process.close.assert_called_once()


class TestSSHSessionStatus:
    """Test SSHSessionStatus enum."""

    def test_status_has_connected(self) -> None:
        """SSHSessionStatus should have CONNECTED value."""
        assert SSHSessionStatus.CONNECTED == "connected"

    def test_status_has_disconnected(self) -> None:
        """SSHSessionStatus should have DISCONNECTED value."""
        assert SSHSessionStatus.DISCONNECTED == "disconnected"

    def test_status_has_reconnecting(self) -> None:
        """SSHSessionStatus should have RECONNECTING value."""
        assert SSHSessionStatus.RECONNECTING == "reconnecting"
