"""Sessions API routes - WebSocket terminal endpoint."""

import asyncio
import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from llm_shell.db.database import Database, get_database
from llm_shell.exceptions import AppError, SSHError
from llm_shell.services.session_manager import SessionManager

logger = logging.getLogger(__name__)

router = APIRouter()

# Global session manager instance (singleton per database)
_session_managers: dict[str, SessionManager] = {}


def get_session_manager(
    db: Annotated[Database, Depends(get_database)],
) -> SessionManager:
    """Get or create a SessionManager instance.

    Uses a singleton pattern per database path to maintain session state.

    Args:
        db: Database instance.

    Returns:
        SessionManager instance.
    """
    # Use database path as key for singleton
    db_path = str(db._db_path) if hasattr(db, "_db_path") else "default"
    if db_path not in _session_managers:
        _session_managers[db_path] = SessionManager(db)
    return _session_managers[db_path]


class TerminalWebSocketHandler:
    """Handles WebSocket communication for terminal sessions.

    This class manages:
    - WebSocket connection lifecycle
    - Message routing between client and SSH session
    - Error handling and cleanup
    """

    def __init__(
        self,
        websocket: WebSocket,
        session_manager: SessionManager,
        server_id: str,
    ) -> None:
        """Initialize the terminal WebSocket handler.

        Args:
            websocket: The WebSocket connection.
            session_manager: The session manager for SSH sessions.
            server_id: The server ID to connect to.
        """
        self.websocket = websocket
        self.session_manager = session_manager
        self.server_id = server_id
        self.session: Any = None
        self._output_task: asyncio.Task[None] | None = None

    async def run(self) -> None:
        """Run the WebSocket handler.

        This method:
        1. Opens an SSH session
        2. Sends connected status
        3. Starts output forwarding task
        4. Handles incoming messages
        5. Cleans up on disconnect
        """
        try:
            # Open SSH session
            self.session = await self.session_manager.open_session(self.server_id)

            # Send connected status
            await self._send_status("connected")

            # Start output forwarding task
            self._output_task = asyncio.create_task(self._forward_output())

            # Handle incoming messages
            await self._handle_messages()

        except SSHError as e:
            await self._send_error(e.code, e.message)
            await self.websocket.close()
        except AppError as e:
            await self._send_error(e.code, e.message)
            await self.websocket.close()
        except Exception as e:
            logger.exception(f"Unexpected error in terminal WebSocket: {e}")
            await self._send_error("INTERNAL_ERROR", "An unexpected error occurred")
            await self.websocket.close()
        finally:
            await self._cleanup()

    async def _send_status(self, status: str, **kwargs: Any) -> None:
        """Send a status message to the client.

        Args:
            status: The status value (connected, disconnected, etc.)
            **kwargs: Additional fields to include in the message.
        """
        message: dict[str, Any] = {"type": "status", "status": status}
        message.update(kwargs)
        await self.websocket.send_json(message)

    async def _send_error(self, code: str, message: str) -> None:
        """Send an error message to the client.

        Args:
            code: Error code.
            message: Error message.
        """
        await self.websocket.send_json(
            {"type": "error", "code": code, "message": message}
        )

    async def _forward_output(self) -> None:
        """Forward PTY output to WebSocket.

        Continuously reads from the SSH session's output buffer and
        sends it as output messages to the WebSocket client.
        """
        if self.session is None or self.session.process is None:
            return

        try:
            async for data in self.session.process.stdout:
                if data:
                    # Send raw output with ANSI codes (xterm.js handles them)
                    await self.websocket.send_json(
                        {"type": "output", "data": data.decode("utf-8", errors="replace")}
                    )
        except asyncio.CancelledError:
            # Task was cancelled, this is expected during cleanup
            pass
        except Exception as e:
            logger.warning(f"Error reading PTY output: {e}")

    async def _handle_messages(self) -> None:
        """Handle incoming WebSocket messages.

        Processes messages until the WebSocket is disconnected.
        """
        try:
            while True:
                # Receive and parse message
                raw_data = await self.websocket.receive_text()
                try:
                    data = json.loads(raw_data)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON received: {raw_data}")
                    continue

                msg_type = data.get("type")

                if msg_type == "input":
                    await self._handle_input(data)
                elif msg_type == "resize":
                    await self._handle_resize(data)
                else:
                    logger.warning(f"Unknown message type: {msg_type}")

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for server {self.server_id}")
        except Exception as e:
            logger.warning(f"Error handling WebSocket messages: {e}")

    async def _handle_input(self, data: dict[str, Any]) -> None:
        """Handle input message.

        Args:
            data: Message data containing 'data' field with input.
        """
        if self.session is None:
            return

        input_data = data.get("data", "")
        if input_data:
            await self.session.write_input(input_data)

    async def _handle_resize(self, data: dict[str, Any]) -> None:
        """Handle resize message.

        Args:
            data: Message data containing 'cols' and 'rows' fields.
        """
        if self.session is None:
            return

        cols = data.get("cols")
        rows = data.get("rows")

        if isinstance(cols, int) and isinstance(rows, int):
            self.session.change_terminal_size(cols, rows)

    async def _cleanup(self) -> None:
        """Clean up resources on disconnect.

        Cancels the output task and closes the SSH session.
        """
        # Cancel output task
        if self._output_task is not None:
            self._output_task.cancel()
            try:
                await self._output_task
            except asyncio.CancelledError:
                pass

        # Close SSH session
        if self.session is not None:
            try:
                await self.session_manager.close_session(self.session.id)
            except Exception as e:
                logger.warning(f"Error closing SSH session: {e}")


@router.websocket("/sessions/{server_id}/terminal")
async def terminal_websocket(
    websocket: WebSocket,
    server_id: str,
    session_manager: Annotated[SessionManager, Depends(get_session_manager)],
) -> None:
    """WebSocket endpoint for interactive terminal sessions.

    Establishes an SSH connection to the specified server and provides
    bidirectional communication between the client and the remote PTY.

    Protocol:
    - Client -> Server: {"type": "input", "data": "..."}
    - Client -> Server: {"type": "resize", "cols": N, "rows": N}
    - Server -> Client: {"type": "status", "status": "connected"}
    - Server -> Client: {"type": "output", "data": "..."}
    - Server -> Client: {"type": "error", "code": "...", "message": "..."}

    Args:
        websocket: The WebSocket connection.
        server_id: ID of the server to connect to.
        session_manager: Session manager for SSH connections.
    """
    await websocket.accept()

    handler = TerminalWebSocketHandler(websocket, session_manager, server_id)
    await handler.run()
