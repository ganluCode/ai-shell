"""SSH disconnection detection and reconnection logic."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from llm_shell.db.database import Database
from llm_shell.services.session_manager import SessionManager

logger = logging.getLogger(__name__)

# Exponential backoff delays in seconds: 1, 2, 4, 8, 16
BACKOFF_DELAYS = [1, 2, 4, 8, 16]


def calculate_backoff_delay(retry_attempt: int) -> int:
    """Calculate the backoff delay for a given retry attempt.

    Uses exponential backoff: 1s, 2s, 4s, 8s, 16s.

    Args:
        retry_attempt: The current retry attempt (0-indexed).

    Returns:
        The delay in seconds before the next retry.
    """
    if retry_attempt < 0:
        return 1
    if retry_attempt >= len(BACKOFF_DELAYS):
        return BACKOFF_DELAYS[-1]  # Cap at 16 seconds
    return BACKOFF_DELAYS[retry_attempt]


class ReconnectionHandler:
    """Handles SSH disconnection detection and reconnection logic.

    This class manages:
    - Detecting SSH disconnections
    - Sending status messages to the WebSocket client
    - Implementing exponential backoff retry
    - Updating server timestamps on reconnection
    """

    def __init__(
        self,
        session_manager: SessionManager,
        server_id: str,
        websocket: Any,
        db: Database,
    ) -> None:
        """Initialize the reconnection handler.

        Args:
            session_manager: The session manager for creating new sessions.
            server_id: The ID of the server to reconnect to.
            websocket: The WebSocket connection to send status messages.
            db: Database instance for updating timestamps.
        """
        self.session_manager = session_manager
        self.server_id = server_id
        self.websocket = websocket
        self.db = db

    async def send_disconnected_status(self, retry: int, max_retry: int) -> None:
        """Send disconnected status message to the WebSocket client.

        Args:
            retry: The current retry attempt number.
            max_retry: The maximum number of retries allowed.
        """
        message = {
            "type": "status",
            "status": "disconnected",
            "retry": retry,
            "max_retry": max_retry,
        }
        await self.websocket.send_json(message)
        logger.info(f"Sent disconnected status: retry={retry}/{max_retry}")

    async def send_reconnected_status(self) -> None:
        """Send reconnected status message to the WebSocket client."""
        message = {
            "type": "status",
            "status": "reconnected",
        }
        await self.websocket.send_json(message)
        logger.info("Sent reconnected status")

    async def send_connection_lost_status(self) -> None:
        """Send connection_lost status message to the WebSocket client."""
        message = {
            "type": "status",
            "status": "connection_lost",
        }
        await self.websocket.send_json(message)
        logger.warning("Sent connection_lost status")

    async def _update_last_connected_at(self) -> None:
        """Update the server's last_connected_at timestamp."""
        now = datetime.now(UTC).isoformat()
        await self.db.execute(
            "UPDATE servers SET last_connected_at = ? WHERE id = ?",
            (now, self.server_id),
        )
        await self.db.commit()

    async def attempt_reconnect(self, max_retries: int = 5) -> bool:
        """Attempt to reconnect to the server with exponential backoff.

        Args:
            max_retries: Maximum number of reconnection attempts (default 5).

        Returns:
            True if reconnection was successful, False if all retries failed.
        """
        for attempt in range(1, max_retries + 1):
            # Send disconnected status before retry
            await self.send_disconnected_status(retry=attempt, max_retry=max_retries)

            # Calculate and wait for backoff delay
            delay = calculate_backoff_delay(attempt - 1)
            logger.info(f"Waiting {delay}s before retry attempt {attempt}")
            await asyncio.sleep(delay)

            try:
                # Attempt to create a new session
                await self.session_manager.open_session(self.server_id)

                # Update last_connected_at on successful reconnection
                await self._update_last_connected_at()

                # Send reconnected status
                await self.send_reconnected_status()

                logger.info(f"Reconnection successful on attempt {attempt}")
                return True

            except Exception as e:
                logger.warning(f"Reconnection attempt {attempt} failed: {e}")

                if attempt == max_retries:
                    # All retries exhausted
                    await self.send_connection_lost_status()
                    return False

        return False

    async def handle_disconnection(
        self,
        old_session: Any,
        max_retries: int = 5,
    ) -> Any | None:
        """Handle a detected disconnection and attempt reconnection.

        Args:
            old_session: The disconnected session to close.
            max_retries: Maximum number of reconnection attempts.

        Returns:
            The new session if reconnection was successful, None otherwise.
        """
        # Close the old session
        if old_session:
            try:
                await self.session_manager.close_session(old_session.id)
            except Exception as e:
                logger.warning(f"Error closing old session: {e}")

        # Attempt reconnection
        success = await self.attempt_reconnect(max_retries)

        if success:
            # Return the new session
            sessions = self.session_manager._sessions
            # Find the most recently created session for this server
            for _session_id, session in sessions.items():
                if session.server_id == self.server_id:
                    return session

        return None
