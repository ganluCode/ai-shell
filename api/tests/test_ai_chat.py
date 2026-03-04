"""Tests for AI chat() async generator with tool use loop."""

from collections import deque
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from llm_shell.services.ai import chat


class TestChatAsyncGenerator:
    """Tests for chat() async generator basic behavior."""

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create mock session with server info and output buffer."""
        return {
            "server_info": {
                "uname": "Linux testhost 5.15.0",
                "shell": "/bin/bash",
                "username": "testuser",
                "cwd": "/home/testuser",
            },
            "output_buffer": ["line 1", "line 2", "line 3"],
        }

    @pytest.fixture
    def mock_settings_service(self) -> MagicMock:
        """Create mock settings service."""
        service = MagicMock()
        service.get_all = AsyncMock()
        service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="",
            context_lines="50",
            max_chat_rounds="10",
        )
        return service

    @pytest.mark.asyncio
    async def test_chat_is_async_generator(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """chat() should be an async generator."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # Mock response with text content only
                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Hello!")]
                mock_response.stop_reason = "end_turn"
                mock_client.messages.create = AsyncMock(return_value=mock_response)

                gen = chat(mock_session, [], "Hello", mock_settings_service)

                # Check that it's an async generator
                assert hasattr(gen, "__aiter__")
                assert hasattr(gen, "__anext__")

                # Consume the generator to avoid RuntimeWarning
                async for _ in gen:
                    pass

    @pytest.mark.asyncio
    async def test_chat_assembles_messages_from_history(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """chat() should assemble messages from history and user_message."""
        history = deque(
            [
                {"role": "user", "content": "Previous question"},
                {"role": "assistant", "content": "Previous answer"},
            ],
            maxlen=20,
        )

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Response")]
                mock_response.stop_reason = "end_turn"
                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(
                    mock_session, history, "New question", mock_settings_service
                ):
                    events.append(event)

                # Verify messages were assembled correctly
                call_args = mock_client.messages.create.call_args
                messages = call_args[1]["messages"]

                # Should contain history + new user message (with context prepended)
                assert len(messages) == 3
                assert messages[0]["role"] == "user"
                assert messages[0]["content"] == "Previous question"
                assert messages[1]["role"] == "assistant"
                assert messages[1]["content"] == "Previous answer"
                assert messages[2]["role"] == "user"
                # New message should contain context and user question
                assert "New question" in messages[2]["content"]
                assert "服务器信息" in messages[2]["content"]

    @pytest.mark.asyncio
    async def test_chat_yields_text_event_on_no_tool_use(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """chat() should yield text event when no tool_use in response."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Here's a text response")]
                mock_response.stop_reason = "end_turn"
                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(mock_session, [], "Hello", mock_settings_service):
                    events.append(event)

                # Should yield text event
                assert len(events) == 1
                assert events[0]["type"] == "text"
                assert "Here's a text response" in events[0]["content"]


class TestChatSearchTerminalOutput:
    """Tests for search_terminal_output tool handling."""

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create mock session with output buffer."""
        return {
            "server_info": {
                "uname": "Linux testhost 5.15.0",
                "shell": "/bin/bash",
                "username": "testuser",
            },
            "output_buffer": ["error: connection failed", "line 2", "error: timeout"],
        }

    @pytest.fixture
    def mock_settings_service(self) -> MagicMock:
        """Create mock settings service."""
        service = MagicMock()
        service.get_all = AsyncMock()
        service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="",
            context_lines="50",
            max_chat_rounds="10",
        )
        return service

    @pytest.mark.asyncio
    async def test_search_terminal_output_executes_search(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """search_terminal_output should execute buffer search and continue."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # First response: search request
                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "search_terminal_output"
                mock_tool_use.input = {"pattern": "error", "context_lines": 3}
                mock_tool_use.id = "toolu_123"

                mock_search_response = MagicMock()
                mock_search_response.content = [mock_tool_use]
                mock_search_response.stop_reason = "tool_use"

                # Second response: text after search
                mock_final_response = MagicMock()
                mock_final_response.content = [MagicMock(text="Found errors in output")]
                mock_final_response.stop_reason = "end_turn"

                mock_client.messages.create = AsyncMock(
                    side_effect=[mock_search_response, mock_final_response]
                )

                events = []
                async for event in chat(
                    mock_session, [], "Find errors", mock_settings_service
                ):
                    events.append(event)

                # Should have called API twice (search + continue)
                assert mock_client.messages.create.call_count == 2

                # Second call should include tool result
                second_call = mock_client.messages.create.call_args_list[1]
                messages = second_call[1]["messages"]
                # Should have user message + assistant tool_use + tool result
                assert len(messages) >= 3

                # Should yield final text event
                assert len(events) == 1
                assert events[0]["type"] == "text"

    @pytest.mark.asyncio
    async def test_search_terminal_output_includes_search_results(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """search_terminal_output results should be passed back to AI."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "search_terminal_output"
                mock_tool_use.input = {"pattern": "error", "context_lines": 3}
                mock_tool_use.id = "toolu_123"

                mock_search_response = MagicMock()
                mock_search_response.content = [mock_tool_use]
                mock_search_response.stop_reason = "tool_use"

                mock_final_response = MagicMock()
                mock_final_response.content = [MagicMock(text="Done")]
                mock_final_response.stop_reason = "end_turn"

                mock_client.messages.create = AsyncMock(
                    side_effect=[mock_search_response, mock_final_response]
                )

                events = []
                async for event in chat(
                    mock_session, [], "Find errors", mock_settings_service
                ):
                    events.append(event)

                # Verify tool result contains search results
                second_call = mock_client.messages.create.call_args_list[1]
                messages = second_call[1]["messages"]

                # Find tool_result message
                tool_result_msg = None
                for msg in messages:
                    if msg.get("role") == "user":
                        content = msg.get("content", [])
                        if isinstance(content, list):
                            for item in content:
                                if isinstance(item, dict) and item.get("type") == "tool_result":
                                    tool_result_msg = item
                                    break

                assert tool_result_msg is not None
                # Tool result should contain matched content
                assert "error" in tool_result_msg.get("content", "").lower()


class TestChatSuggestCommand:
    """Tests for suggest_command tool handling."""

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create mock session."""
        return {
            "server_info": {
                "uname": "Linux testhost 5.15.0",
                "shell": "/bin/bash",
                "username": "testuser",
            },
            "output_buffer": [],
        }

    @pytest.fixture
    def mock_settings_service(self) -> MagicMock:
        """Create mock settings service."""
        service = MagicMock()
        service.get_all = AsyncMock()
        service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="",
            context_lines="50",
            max_chat_rounds="10",
        )
        return service

    @pytest.mark.asyncio
    async def test_suggest_command_yields_command_event(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """suggest_command should yield command event after safety check."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "suggest_command"
                mock_tool_use.input = {
                    "command": "ls -la",
                    "explanation": "List files",
                    "risk_level": "low",
                }
                mock_tool_use.id = "toolu_123"

                mock_response = MagicMock()
                mock_response.content = [mock_tool_use]
                mock_response.stop_reason = "tool_use"

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(
                    mock_session, [], "List files", mock_settings_service
                ):
                    events.append(event)

                # Should yield command event
                assert len(events) == 1
                assert events[0]["type"] == "command"
                assert events[0]["command"] == "ls -la"
                assert events[0]["explanation"] == "List files"
                assert events[0]["risk_level"] == "low"

    @pytest.mark.asyncio
    async def test_suggest_command_safety_check_blocks_dangerous(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """Blocked commands should yield text event explaining block."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # rm -rf / is a blocked command
                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "suggest_command"
                mock_tool_use.input = {
                    "command": "rm -rf /",
                    "explanation": "Delete everything",
                    "risk_level": "high",
                }
                mock_tool_use.id = "toolu_123"

                mock_response = MagicMock()
                mock_response.content = [mock_tool_use]
                mock_response.stop_reason = "tool_use"

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(
                    mock_session, [], "Delete root", mock_settings_service
                ):
                    events.append(event)

                # Should yield text event (not command event) explaining block
                assert len(events) == 1
                assert events[0]["type"] == "text"
                # Check for block message (Chinese "阻止" or "blocked")
                content_lower = events[0]["content"].lower()
                assert "阻止" in events[0]["content"] or "blocked" in content_lower

    @pytest.mark.asyncio
    async def test_suggest_command_high_risk_override(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """High risk commands should have risk_level overridden to 'high'."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # rm -rf without / is high risk but not blocked
                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "suggest_command"
                mock_tool_use.input = {
                    "command": "rm -rf /tmp/test",
                    "explanation": "Delete temp",
                    "risk_level": "low",  # AI said low, but should be overridden
                }
                mock_tool_use.id = "toolu_123"

                mock_response = MagicMock()
                mock_response.content = [mock_tool_use]
                mock_response.stop_reason = "tool_use"

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(
                    mock_session, [], "Delete temp", mock_settings_service
                ):
                    events.append(event)

                # Should yield command event with risk_level overridden to high
                assert len(events) == 1
                assert events[0]["type"] == "command"
                assert events[0]["risk_level"] == "high"


class TestChatSuggestCommands:
    """Tests for suggest_commands tool handling."""

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create mock session."""
        return {
            "server_info": {
                "uname": "Linux testhost 5.15.0",
                "shell": "/bin/bash",
                "username": "testuser",
            },
            "output_buffer": [],
        }

    @pytest.fixture
    def mock_settings_service(self) -> MagicMock:
        """Create mock settings service."""
        service = MagicMock()
        service.get_all = AsyncMock()
        service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="",
            context_lines="50",
            max_chat_rounds="10",
        )
        return service

    @pytest.mark.asyncio
    async def test_suggest_commands_yields_commands_event(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """suggest_commands should yield commands event with array."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "suggest_commands"
                mock_tool_use.input = {
                    "commands": [
                        {
                            "command": "ls -la",
                            "explanation": "List files",
                            "risk_level": "low",
                        },
                        {
                            "command": "ls -lah",
                            "explanation": "List with hidden",
                            "risk_level": "low",
                        },
                    ]
                }
                mock_tool_use.id = "toolu_123"

                mock_response = MagicMock()
                mock_response.content = [mock_tool_use]
                mock_response.stop_reason = "tool_use"

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(
                    mock_session, [], "List files", mock_settings_service
                ):
                    events.append(event)

                # Should yield commands event
                assert len(events) == 1
                assert events[0]["type"] == "commands"
                assert len(events[0]["commands"]) == 2

    @pytest.mark.asyncio
    async def test_suggest_commands_applies_safety_check(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """suggest_commands should apply safety check to each command."""
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # One safe command, one high risk command
                mock_tool_use = MagicMock()
                mock_tool_use.type = "tool_use"
                mock_tool_use.name = "suggest_commands"
                mock_tool_use.input = {
                    "commands": [
                        {
                            "command": "ls -la",
                            "explanation": "List files",
                            "risk_level": "low",
                        },
                        {
                            "command": "rm -rf /tmp/test",
                            "explanation": "Delete temp",
                            "risk_level": "low",  # Should be overridden to high
                        },
                    ]
                }
                mock_tool_use.id = "toolu_123"

                mock_response = MagicMock()
                mock_response.content = [mock_tool_use]
                mock_response.stop_reason = "tool_use"

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                events = []
                async for event in chat(
                    mock_session, [], "Commands", mock_settings_service
                ):
                    events.append(event)

                # Should yield commands event
                assert len(events) == 1
                assert events[0]["type"] == "commands"

                # First command should remain low
                assert events[0]["commands"][0]["risk_level"] == "low"
                # Second command should be overridden to high
                assert events[0]["commands"][1]["risk_level"] == "high"


class TestChatConversationHistory:
    """Tests for conversation history management."""

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create mock session."""
        return {
            "server_info": {
                "uname": "Linux testhost 5.15.0",
                "shell": "/bin/bash",
                "username": "testuser",
            },
            "output_buffer": [],
        }

    @pytest.fixture
    def mock_settings_service(self) -> MagicMock:
        """Create mock settings service."""
        service = MagicMock()
        service.get_all = AsyncMock()
        service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="",
            context_lines="50",
            max_chat_rounds="10",
        )
        return service

    @pytest.mark.asyncio
    async def test_chat_maintains_conversation_history(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """chat() should maintain conversation history with deque."""
        history = deque(maxlen=20)

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Response")]
                mock_response.stop_reason = "end_turn"
                mock_client.messages.create = AsyncMock(return_value=mock_response)

                async for _ in chat(
                    mock_session, history, "Hello", mock_settings_service
                ):
                    pass

                # History should be updated with user message and assistant response
                assert len(history) == 2
                assert history[0]["role"] == "user"
                assert history[1]["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_chat_history_maxlen_20(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """chat() should maintain history with deque(maxlen=20)."""
        # Pre-fill history to test maxlen
        history = deque(maxlen=20)
        for i in range(18):
            history.append({"role": "user", "content": f"msg {i}"})

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Response")]
                mock_response.stop_reason = "end_turn"
                mock_client.messages.create = AsyncMock(return_value=mock_response)

                async for _ in chat(
                    mock_session, history, "New message", mock_settings_service
                ):
                    pass

                # History should not exceed maxlen
                assert len(history) <= 20
