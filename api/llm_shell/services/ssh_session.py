"""SSH Session management."""

import logging
from enum import StrEnum
from typing import Any

from llm_shell.services.output_buffer import OutputBuffer

logger = logging.getLogger(__name__)


class SSHSessionStatus(StrEnum):
    """Status of an SSH session."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"


class SSHSession:
    """Encapsulates an SSH connection and PTY process.

    This class manages the state of an active SSH session with a PTY.

    Attributes:
        id: Unique session identifier.
        server_id: ID of the server this session connects to.
        connection: The asyncssh SSHClientConnection.
        process: The asyncssh SSHClientProcess for the PTY.
        output_buffer: Buffer for storing terminal output.
        server_info: Information about the remote server.
        status: Current session status.
    """

    def __init__(
        self,
        id: str,
        server_id: str,
        connection: Any,
        process: Any,
        output_buffer: OutputBuffer,
        server_info: dict[str, Any] | None = None,
    ) -> None:
        """Initialize an SSH session.

        Args:
            id: Unique session identifier.
            server_id: ID of the server this session connects to.
            connection: The asyncssh SSHClientConnection.
            process: The asyncssh SSHClientProcess for the PTY.
            output_buffer: Buffer for storing terminal output.
            server_info: Information about the remote server.
        """
        self.id = id
        self.server_id = server_id
        self.connection = connection
        self.process = process
        self.output_buffer = output_buffer
        self.server_info = server_info if server_info is not None else {}
        self.status = SSHSessionStatus.CONNECTED

    def change_terminal_size(self, cols: int, rows: int) -> None:
        """Change the terminal size of the PTY.

        Args:
            cols: Number of columns.
            rows: Number of rows.
        """
        if self.process is not None:
            self.process.change_terminal_size(cols, rows)

    async def write_input(self, data: str | bytes) -> None:
        """Write input to the PTY.

        Args:
            data: Input data to write (string or bytes).
        """
        if self.process is not None and self.process.stdin is not None:
            if isinstance(data, str):
                data = data.encode()
            self.process.stdin.write(data)
            if hasattr(self.process.stdin, "drain"):
                await self.process.stdin.drain()

    async def read_output(self) -> None:
        """Read output from the PTY and write to output buffer.

        This method runs as an infinite loop, reading from process.stdout
        and appending to the output buffer. It should be run as a background
        task.
        """
        if self.process is None or self.process.stdout is None:
            return

        async for data in self.process.stdout:
            if data:
                self.output_buffer.append(data)

    async def close(self) -> None:
        """Close the session.

        Closes the PTY process and SSH connection, and updates status.
        """
        if self.process is not None:
            self.process.close()
            if hasattr(self.process, "wait_closed"):
                await self.process.wait_closed()

        if self.connection is not None:
            self.connection.close()
            if hasattr(self.connection, "wait_closed"):
                await self.connection.wait_closed()

        self.status = SSHSessionStatus.DISCONNECTED


async def probe_server(conn: Any) -> dict[str, str]:
    """Probe a remote server to collect system information.

    Executes non-TTY commands to gather information about the remote server
    including kernel info, shell, OS release, and current username.

    Args:
        conn: An asyncssh SSHClientConnection.

    Returns:
        Dictionary containing:
            - uname: Output of 'uname -a' command
            - shell: Output of 'echo $SHELL' command
            - os_release: Output of 'cat /etc/os-release | head -5' command
            - username: Output of 'whoami' command
    """
    server_info: dict[str, str] = {
        "uname": "",
        "shell": "",
        "os_release": "",
        "username": "",
    }

    # Commands to probe
    commands = {
        "uname": "uname -a",
        "shell": "echo $SHELL",
        "os_release": "cat /etc/os-release | head -5",
        "username": "whoami",
    }

    for key, cmd in commands.items():
        try:
            result = await conn.exec(cmd)
            stdout = await result.stdout.read()
            # Decode and strip trailing whitespace
            output = stdout.decode("utf-8", errors="replace").strip()
            server_info[key] = output
        except Exception as e:
            logger.warning(f"Failed to probe {key} with command '{cmd}': {e}")
            server_info[key] = ""

    return server_info
