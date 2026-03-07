"""Tests for probe_server function."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from llm_shell.services.ssh_session import probe_server


class TestProbeServerCommands:
    """Test that probe_server executes the correct commands."""

    @pytest.mark.asyncio
    async def test_probe_server_executes_uname_a(self) -> None:
        """probe_server should execute 'uname -a' command."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            if cmd == "uname -a":
                mock_result.stdout = "Linux hostname 5.4.0 #1 SMP x86_64 GNU/Linux\n"
            else:
                mock_result.stdout = ""
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        assert result.get("uname") == "Linux hostname 5.4.0 #1 SMP x86_64 GNU/Linux"

    @pytest.mark.asyncio
    async def test_probe_server_executes_echo_shell(self) -> None:
        """probe_server should execute 'echo $SHELL' command."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            if cmd == "echo $SHELL":
                mock_result.stdout = "/bin/bash\n"
            else:
                mock_result.stdout = ""
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        assert result.get("shell") == "/bin/bash"

    @pytest.mark.asyncio
    async def test_probe_server_executes_os_release(self) -> None:
        """probe_server should execute 'cat /etc/os-release | head -5' command."""
        mock_conn = MagicMock()

        os_release_output = """PRETTY_NAME="Ubuntu 22.04.3 LTS"
NAME="Ubuntu"
VERSION_ID="22.04"
VERSION="22.04.3 LTS (Jammy Jellyfish)"
ID=ubuntu
"""

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            if cmd == "cat /etc/os-release | head -5":
                mock_result.stdout = os_release_output
            else:
                mock_result.stdout = ""
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        assert "PRETTY_NAME=\"Ubuntu 22.04.3 LTS\"" in result.get("os_release", "")
        assert "NAME=\"Ubuntu\"" in result.get("os_release", "")

    @pytest.mark.asyncio
    async def test_probe_server_executes_whoami(self) -> None:
        """probe_server should execute 'whoami' command."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            if cmd == "whoami":
                mock_result.stdout = "root\n"
            else:
                mock_result.stdout = ""
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        assert result.get("username") == "root"


class TestProbeServerResultFormat:
    """Test the format of probe_server results."""

    @pytest.mark.asyncio
    async def test_probe_server_returns_dict(self) -> None:
        """probe_server should return a dictionary."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            mock_result.stdout = "test\n"
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_probe_server_returns_all_fields(self) -> None:
        """probe_server should return all expected fields."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            mock_result.stdout = "test\n"
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        assert "uname" in result
        assert "shell" in result
        assert "os_release" in result
        assert "username" in result

    @pytest.mark.asyncio
    async def test_probe_server_strips_trailing_newlines(self) -> None:
        """probe_server should strip trailing newlines from output."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            mock_result.stdout = "test_value\n\n"
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        # All values should have trailing whitespace stripped
        for value in result.values():
            assert not value.endswith("\n")


class TestProbeServerEdgeCases:
    """Test edge cases for probe_server."""

    @pytest.mark.asyncio
    async def test_probe_server_handles_empty_output(self) -> None:
        """probe_server should handle empty command output gracefully."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            mock_result.stdout = ""
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        # Should return empty strings for empty output, not None
        assert result.get("uname") == ""
        assert result.get("shell") == ""
        assert result.get("os_release") == ""
        assert result.get("username") == ""

    @pytest.mark.asyncio
    async def test_probe_server_handles_missing_os_release(self) -> None:
        """probe_server should handle missing /etc/os-release gracefully."""
        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            mock_result.stdout = ""
            return mock_result

        mock_conn.run = mock_run

        result = await probe_server(mock_conn)

        # os_release should be empty string when file doesn't exist
        assert result.get("os_release") == ""


class TestProbeServerIntegration:
    """Integration tests for probe_server with SSHSession."""

    @pytest.mark.asyncio
    async def test_probe_server_result_can_be_stored_in_session(self) -> None:
        """probe_server result should be compatible with SSHSession.server_info."""
        from llm_shell.services.output_buffer import OutputBuffer
        from llm_shell.services.ssh_session import SSHSession

        mock_conn = MagicMock()

        async def mock_run(cmd: str, **kwargs: Any) -> Any:
            mock_result = MagicMock()
            mock_result.stdout = "test\n"
            return mock_result

        mock_conn.run = mock_run

        server_info = await probe_server(mock_conn)

        # Should be able to create SSHSession with probe result
        session = SSHSession(
            id="test-session",
            server_id="test-server",
            connection=mock_conn,
            process=MagicMock(),
            output_buffer=OutputBuffer(),
            server_info=server_info,
        )

        assert session.server_info == server_info
        assert session.server_info["uname"] == "test"
