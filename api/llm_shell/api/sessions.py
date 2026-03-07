"""Sessions API routes - WebSocket terminal endpoint and SFTP file transfer."""

import asyncio
import json
import logging
import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from llm_shell.db.database import Database, get_database
from llm_shell.exceptions import AppError, NotFoundError, SSHError
from llm_shell.services.reconnection import ReconnectionHandler
from llm_shell.services.session_manager import SessionManager, get_shared_session_manager
from llm_shell.services import sftp

logger = logging.getLogger(__name__)

router = APIRouter()


def get_session_manager(
    db: Annotated[Database, Depends(get_database)],
) -> SessionManager:
    """Get or create a SessionManager instance.

    Args:
        db: Database instance.

    Returns:
        SessionManager instance.
    """
    return get_shared_session_manager(db)


class TerminalWebSocketHandler:
    """Handles WebSocket communication for terminal sessions.

    This class manages:
    - WebSocket connection lifecycle
    - Message routing between client and SSH session
    - Disconnection detection and reconnection
    - Error handling and cleanup
    """

    def __init__(
        self,
        websocket: WebSocket,
        session_manager: SessionManager,
        server_id: str,
        db: Database,
    ) -> None:
        """Initialize the terminal WebSocket handler.

        Args:
            websocket: The WebSocket connection.
            session_manager: The session manager for SSH sessions.
            server_id: The server ID to connect to.
            db: Database instance for updating timestamps.
        """
        self.websocket = websocket
        self.session_manager = session_manager
        self.server_id = server_id
        self.db = db
        self.session: Any = None
        self._output_task: asyncio.Task[None] | None = None
        self._reconnecting = False

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

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected during setup for server {self.server_id}")
        except SSHError as e:
            await self._safe_send_error(e.code, e.message)
        except AppError as e:
            await self._safe_send_error(e.code, e.message)
        except Exception as e:
            logger.exception(f"Unexpected error in terminal WebSocket: {e}")
            await self._safe_send_error("INTERNAL_ERROR", "An unexpected error occurred")
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

    async def _safe_send_error(self, code: str, message: str) -> None:
        """Send an error message, ignoring failures if WebSocket is already closed."""
        try:
            await self._send_error(code, message)
            await self.websocket.close()
        except Exception:
            pass

    async def _forward_output(self) -> None:
        """Forward PTY output to WebSocket.

        Continuously reads from the SSH session's output buffer and
        sends it as output messages to the WebSocket client.
        Detects disconnection and triggers reconnection logic.
        """
        if self.session is None or self.session.process is None:
            return

        try:
            while not self.session.process.stdout.at_eof():
                data = await self.session.process.stdout.read(65536)
                if not data:
                    break
                # Send raw output with ANSI codes (xterm.js handles them)
                await self.websocket.send_json(
                    {"type": "output", "data": data}
                )
                # Store in output buffer for AI context
                self.session.output_buffer.append(data)

            # If we reach here, the stream ended (EOF) - connection likely lost
            logger.warning(f"SSH stdout EOF detected for server {self.server_id}")
            await self._handle_disconnection()

        except asyncio.CancelledError:
            # Task was cancelled, this is expected during cleanup
            pass
        except Exception as e:
            logger.warning(f"Error reading PTY output: {e}")
            # Connection error - trigger reconnection
            await self._handle_disconnection()

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

    async def _handle_disconnection(self) -> None:
        """Handle SSH disconnection and attempt reconnection.

        Uses ReconnectionHandler to manage the reconnection process with
        exponential backoff. On success, updates the session and restarts
        output forwarding.
        """
        if self._reconnecting:
            return

        self._reconnecting = True

        try:
            handler = ReconnectionHandler(
                session_manager=self.session_manager,
                server_id=self.server_id,
                websocket=self.websocket,
                db=self.db,
            )

            new_session = await handler.handle_disconnection(
                old_session=self.session,
                max_retries=5,
            )

            if new_session:
                # Reconnection successful - update session and restart output
                self.session = new_session
                self._reconnecting = False

                # Restart output forwarding with new session
                self._output_task = asyncio.create_task(self._forward_output())
            else:
                # All retries failed - connection lost
                logger.error(f"Connection lost to server {self.server_id}")
                # The ReconnectionHandler already sent connection_lost status

        except Exception as e:
            logger.exception(f"Error during reconnection: {e}")
        finally:
            self._reconnecting = False

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
    db: Annotated[Database, Depends(get_database)],
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
    - Server -> Client: {"type": "status", "status": "disconnected", "retry": N, "max_retry": 5}
    - Server -> Client: {"type": "status", "status": "reconnected"}
    - Server -> Client: {"type": "status", "status": "connection_lost"}

    Args:
        websocket: The WebSocket connection.
        server_id: ID of the server to connect to.
        db: Database instance.
        session_manager: Session manager for SSH connections.
    """
    await websocket.accept()

    handler = TerminalWebSocketHandler(websocket, session_manager, server_id, db)
    await handler.run()


@router.get("/sessions/{session_id}/download")
async def download_file(
    session_id: str,
    path: Annotated[str, Query(description="Remote file path to download")],
    session_manager: Annotated[SessionManager, Depends(get_session_manager)],
) -> FileResponse:
    """Download a file from the remote server via SFTP.

    Downloads the specified file from the remote server and returns it
    as a file stream with application/octet-stream content type.

    Args:
        session_id: ID of the active SSH session.
        path: Remote file path to download.
        session_manager: Session manager for SSH connections.

    Returns:
        FileResponse with the downloaded file.

    Raises:
        HTTPException: 404 if session not found, 500 if download fails.
    """
    # Get the active session
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Session not found"}},
        )

    try:
        # Download file via SFTP
        local_path = await sftp.download_file(session.connection, path)

        # Get filename from path for Content-Disposition header
        filename = os.path.basename(path)

        return FileResponse(
            path=local_path,
            media_type="application/octet-stream",
            filename=filename,
        )
    except Exception as e:
        logger.error(f"Failed to download file {path}: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "DOWNLOAD_FAILED", "message": str(e)}},
        )


@router.post("/sessions/{session_id}/upload")
async def upload_file(
    session_id: str,
    path: Annotated[str, Query(description="Remote destination path")],
    file: Annotated[UploadFile, File(description="File to upload")],
    session_manager: Annotated[SessionManager, Depends(get_session_manager)],
) -> dict[str, Any]:
    """Upload a file to the remote server via SFTP.

    Accepts a file via multipart/form-data and uploads it to the specified
    remote path on the server.

    Args:
        session_id: ID of the active SSH session.
        path: Remote destination path for the file.
        file: The file to upload.
        session_manager: Session manager for SSH connections.

    Returns:
        Dictionary with remote_path and size of uploaded file.

    Raises:
        HTTPException: 404 if session not found, 500 if upload fails.
    """
    # Get the active session
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Session not found"}},
        )

    try:
        # Save uploaded file to temp location
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            local_path = tmp.name

        # Upload file via SFTP
        result = await sftp.upload_file(session.connection, local_path, path)

        # Clean up temp file
        os.unlink(local_path)

        return result
    except Exception as e:
        logger.error(f"Failed to upload file to {path}: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "UPLOAD_FAILED", "message": str(e)}},
        )
