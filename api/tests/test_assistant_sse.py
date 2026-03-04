"""Tests for SSE assistant chat endpoint."""

import json
from collections import deque
from typing import Any, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from llm_shell.api import assistant
from llm_shell.main import app


@pytest.fixture
def mock_session_manager() -> MagicMock:
    """Create a mock session manager."""
    manager = MagicMock()
    # Create a mock session with output buffer
    mock_session = MagicMock()
    mock_session.id = "test-session-id"
    mock_session.server_id = "test-server-id"
    mock_session.server_info = {
        "uname": "Linux testhost 5.4.0",
        "shell": "/bin/bash",
        "os_release": "Ubuntu 20.04",
        "username": "testuser",
    }
    mock_session.output_buffer = ["line1", "line2"]
    manager.get_session.return_value = mock_session
    return manager


@pytest.fixture
def mock_settings_service() -> AsyncMock:
    """Create a mock settings service."""
    service = AsyncMock()
    settings = MagicMock()
    settings.model = "claude-3-sonnet"
    settings.base_url = None
    settings.context_lines = 50
    settings.max_chat_rounds = 10
    service.get_all.return_value = settings
    return service


class TestSSEEndpoint:
    """Tests for SSE assistant chat endpoint."""

    def test_post_request_receives_sse_event_stream(
        self,
        mock_session_manager: MagicMock,
        mock_settings_service: AsyncMock,
    ) -> None:
        """POST request receives SSE event stream."""
        # Mock the chat generator to yield a text event
        async def mock_chat(
            session: dict,
            history: deque,
            user_message: str,
            settings_service: Any,
        ) -> Any:
            yield {"type": "text", "content": "Hello from AI"}

        # Override dependencies
        app.dependency_overrides[assistant.get_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[assistant.get_settings_service] = lambda: mock_settings_service

        try:
            with (
                patch("llm_shell.api.assistant.chat", side_effect=mock_chat),
                patch("llm_shell.api.assistant.create_history_deque", return_value=deque()),
            ):
                client = TestClient(app)
                response = client.post(
                    "/api/assistant/chat",
                    json={"session_id": "test-session-id", "message": "Hello"},
                )

                assert response.status_code == 200
                assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        finally:
            app.dependency_overrides.clear()

    def test_events_formatted_correctly_as_data_json(
        self,
        mock_session_manager: MagicMock,
        mock_settings_service: AsyncMock,
    ) -> None:
        """Events formatted correctly as 'data: json'."""
        async def mock_chat(
            session: dict,
            history: deque,
            user_message: str,
            settings_service: Any,
        ) -> Any:
            yield {"type": "text", "content": "Response text"}
            yield {
                "type": "command",
                "command": "ls -la",
                "explanation": "List files",
                "risk_level": "low",
            }

        # Override dependencies
        app.dependency_overrides[assistant.get_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[assistant.get_settings_service] = lambda: mock_settings_service

        try:
            with (
                patch("llm_shell.api.assistant.chat", side_effect=mock_chat),
                patch("llm_shell.api.assistant.create_history_deque", return_value=deque()),
            ):
                client = TestClient(app)
                response = client.post(
                    "/api/assistant/chat",
                    json={"session_id": "test-session-id", "message": "Hello"},
                )

                content = response.text
                lines = [l for l in content.split("\n") if l.startswith("data: ")]

                # Check first event (text)
                data1 = json.loads(lines[0][6:])  # Remove 'data: ' prefix
                assert data1["type"] == "text"
                assert data1["content"] == "Response text"

                # Check second event (command)
                data2 = json.loads(lines[1][6:])
                assert data2["type"] == "command"
                assert data2["command"] == "ls -la"
        finally:
            app.dependency_overrides.clear()

    def test_final_done_event_received(
        self,
        mock_session_manager: MagicMock,
        mock_settings_service: AsyncMock,
    ) -> None:
        """Final 'done' event received."""
        async def mock_chat(
            session: dict,
            history: deque,
            user_message: str,
            settings_service: Any,
        ) -> Any:
            yield {"type": "text", "content": "Done"}

        # Override dependencies
        app.dependency_overrides[assistant.get_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[assistant.get_settings_service] = lambda: mock_settings_service

        try:
            with (
                patch("llm_shell.api.assistant.chat", side_effect=mock_chat),
                patch("llm_shell.api.assistant.create_history_deque", return_value=deque()),
            ):
                client = TestClient(app)
                response = client.post(
                    "/api/assistant/chat",
                    json={"session_id": "test-session-id", "message": "Hello"},
                )

                content = response.text
                lines = [l for l in content.split("\n") if l.startswith("data: ")]

                # Last event should be 'done'
                last_line = lines[-1]
                data = json.loads(last_line[6:])
                assert data["type"] == "done"
        finally:
            app.dependency_overrides.clear()

    def test_sends_error_events_on_exceptions(
        self,
        mock_session_manager: MagicMock,
        mock_settings_service: AsyncMock,
    ) -> None:
        """Sends error events on exceptions."""
        async def mock_chat_error(
            session: dict,
            history: deque,
            user_message: str,
            settings_service: Any,
        ) -> Any:
            raise RuntimeError("Something went wrong")
            yield  # Never reached, but needed for async generator

        # Override dependencies
        app.dependency_overrides[assistant.get_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[assistant.get_settings_service] = lambda: mock_settings_service

        try:
            with (
                patch("llm_shell.api.assistant.chat", side_effect=mock_chat_error),
                patch("llm_shell.api.assistant.create_history_deque", return_value=deque()),
            ):
                client = TestClient(app)
                response = client.post(
                    "/api/assistant/chat",
                    json={"session_id": "test-session-id", "message": "Hello"},
                )

                content = response.text
                lines = [l for l in content.split("\n") if l.startswith("data: ")]

                # Should have error event
                error_line = lines[0]
                data = json.loads(error_line[6:])
                assert data["type"] == "error"

                # Should still have done event
                last_line = lines[-1]
                data = json.loads(last_line[6:])
                assert data["type"] == "done"
        finally:
            app.dependency_overrides.clear()

    def test_sends_error_event_when_session_not_found(
        self,
        mock_settings_service: AsyncMock,
    ) -> None:
        """Sends error event when session not found (SSE returns 200 with error event)."""
        # Session manager returns None for session
        mock_manager = MagicMock()
        mock_manager.get_session.return_value = None

        # Override dependencies
        app.dependency_overrides[assistant.get_session_manager] = lambda: mock_manager
        app.dependency_overrides[assistant.get_settings_service] = lambda: mock_settings_service

        try:
            client = TestClient(app)
            response = client.post(
                "/api/assistant/chat",
                json={"session_id": "nonexistent", "message": "Hello"},
            )

            # SSE returns 200 with error event in stream
            assert response.status_code == 200
            content = response.text
            lines = [l for l in content.split("\n") if l.startswith("data: ")]

            # First event should be error
            data = json.loads(lines[0][6:])
            assert data["type"] == "error"
            assert data["code"] == "SESSION_NOT_FOUND"

            # Last event should be done
            last_data = json.loads(lines[-1][6:])
            assert last_data["type"] == "done"
        finally:
            app.dependency_overrides.clear()
