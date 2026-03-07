"""Assistant API routes - SSE chat endpoint."""

import json
import logging
from collections import deque
from collections.abc import AsyncGenerator
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from llm_shell.db.database import Database, get_database
from llm_shell.services.ai import chat, create_history_deque
from llm_shell.services.session_manager import SessionManager, get_shared_session_manager
from llm_shell.services.settings import SettingsService

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


def get_settings_service(
    db: Annotated[Database, Depends(get_database)],
) -> SettingsService:
    """Get SettingsService instance.

    Args:
        db: Database instance.

    Returns:
        SettingsService instance.
    """
    return SettingsService(db)


# Per-session conversation history storage
# Maps session_id -> deque of messages
_session_histories: dict[str, deque] = {}


def get_or_create_history(session_id: str) -> deque:
    """Get or create conversation history for a session.

    Args:
        session_id: The session identifier.

    Returns:
        A deque for storing conversation history.
    """
    if session_id not in _session_histories:
        _session_histories[session_id] = create_history_deque()
    return _session_histories[session_id]


class ChatRequest:
    """Chat request model.

    Using a simple class instead of Pydantic for direct attribute access.
    """

    def __init__(self, session_id: str, message: str) -> None:
        """Initialize chat request.

        Args:
            session_id: ID of the SSH session.
            message: User's message to the assistant.
        """
        self.session_id = session_id
        self.message = message


async def generate_sse_events(
    server_id: str,
    message: str,
    session_manager: SessionManager,
    settings_service: SettingsService,
) -> AsyncGenerator[str, None]:
    """Generate SSE events from chat.

    Args:
        server_id: ID of the server (used to find the active SSH session).
        message: User's message.
        session_manager: Session manager to get the session.
        settings_service: Settings service for configuration.

    Yields:
        SSE formatted strings ('data: {json}\\n\\n').
    """
    try:
        # Get the session by server_id
        session = session_manager.get_session_by_server_id(server_id)
        if session is None:
            error_event = json.dumps({
                "type": "error",
                "error": {
                    "code": "SESSION_NOT_FOUND",
                    "message": f"No active session for server '{server_id}'",
                },
            })
            yield f"data: {error_event}\n\n"
            yield 'data: {"type":"done"}\n\n'
            return

        # Build session dict for chat
        session_dict: dict[str, Any] = {
            "server_info": session.server_info or {},
            "output_buffer": (
                session.output_buffer.get_recent(session.output_buffer.total_lines)
                if hasattr(session.output_buffer, "get_recent")
                else list(session.output_buffer)
            ) if session.output_buffer else [],
        }

        # Get or create conversation history (keyed by server_id for consistency)
        history = get_or_create_history(server_id)

        # Stream chat events
        async for event in chat(session_dict, history, message, settings_service):
            event_json = json.dumps(event)
            yield f"data: {event_json}\n\n"

        # Send done event
        yield 'data: {"type":"done"}\n\n'

    except Exception as e:
        logger.exception(f"Error in chat stream: {e}")
        error_event = json.dumps({
            "type": "error",
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(e),
            },
        })
        yield f"data: {error_event}\n\n"
        yield 'data: {"type":"done"}\n\n'


@router.post("/assistant/chat")
async def assistant_chat(
    request: dict[str, str],
    session_manager: Annotated[SessionManager, Depends(get_session_manager)],
    settings_service: Annotated[SettingsService, Depends(get_settings_service)],
) -> StreamingResponse:
    """SSE endpoint for assistant chat.

    Accepts a chat message and streams AI responses as SSE events.

    Event types:
    - {"type": "text", "content": "..."} for text responses
    - {"type": "command", "command": "...", "explanation": "...", "risk_level": "..."}
    - {"type": "commands", "commands": [...]} for multiple command options
    - {"type": "error", "code": "...", "message": "..."} for errors
    - {"type": "done"} at end of stream

    Args:
        request: Chat request with session_id and message.
        session_manager: Session manager for SSH sessions.
        settings_service: Settings service for configuration.

    Returns:
        StreamingResponse with text/event-stream content type.
    """
    server_id = request.get("server_id", "")
    message = request.get("message", "")

    return StreamingResponse(
        generate_sse_events(server_id, message, session_manager, settings_service),
        media_type="text/event-stream",
    )
