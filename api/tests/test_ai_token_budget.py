"""Tests for AI token budget control."""

from collections import deque

import pytest

from llm_shell.services.ai import build_context, create_history_deque


class TestCreateHistoryDeque:
    """Tests for create_history_deque function."""

    def test_create_history_deque_with_max_chat_rounds(self) -> None:
        """create_history_deque should create deque with maxlen = max_chat_rounds * 2."""
        history = create_history_deque(max_chat_rounds=10)
        assert isinstance(history, deque)
        assert history.maxlen == 20  # 10 * 2

    def test_create_history_deque_default_max_chat_rounds(self) -> None:
        """create_history_deque should use default max_chat_rounds=10 if not specified."""
        history = create_history_deque()
        assert isinstance(history, deque)
        assert history.maxlen == 20  # default 10 * 2

    def test_create_history_deque_custom_max_chat_rounds(self) -> None:
        """create_history_deque should accept custom max_chat_rounds."""
        history = create_history_deque(max_chat_rounds=5)
        assert history.maxlen == 10  # 5 * 2

    def test_create_history_deque_respects_maxlen(self) -> None:
        """Deque should discard old messages when exceeding maxlen."""
        history = create_history_deque(max_chat_rounds=2)  # maxlen = 4
        history.append({"role": "user", "content": "msg1"})
        history.append({"role": "assistant", "content": "msg2"})
        history.append({"role": "user", "content": "msg3"})
        history.append({"role": "assistant", "content": "msg4"})
        history.append({"role": "user", "content": "msg5"})  # Should push out msg1

        assert len(history) == 4
        assert history[0] == {"role": "assistant", "content": "msg2"}


class TestTokenBudgetControl:
    """Tests for token budget control in build_context."""

    @pytest.fixture
    def large_session(self) -> dict:
        """Create a session with large output buffer."""
        return {
            "server_info": {
                "uname": "Linux server1 5.15.0-91-generic",
                "shell": "/bin/bash",
                "os_release": "Ubuntu 22.04",
                "username": "testuser",
                "cwd": "/home/testuser",
            },
            "output_buffer": [f"This is line {i} with some content to make it longer" for i in range(200)],
        }

    def test_context_uses_settings_context_lines(self, large_session: dict) -> None:
        """build_context should use context_lines from settings."""
        # With context_lines=50
        settings = {"context_lines": 50}
        context = build_context(large_session, settings)
        # Should show omission message for 200 - 50 = 150 lines
        assert "150" in context

    def test_context_uses_settings_context_lines_custom(self, large_session: dict) -> None:
        """build_context should respect custom context_lines value."""
        # With context_lines=30
        settings = {"context_lines": 30}
        context = build_context(large_session, settings)
        # Should show omission message for 200 - 30 = 170 lines
        assert "170" in context

    def test_context_default_context_lines(self, large_session: dict) -> None:
        """build_context should default to 50 context_lines when not specified."""
        settings = {}  # No context_lines specified
        context = build_context(large_session, settings)
        # Should default to 50, so 200 - 50 = 150 omitted
        assert "150" in context


class TestTokenBudgetIntegration:
    """Integration tests for token budget control."""

    def test_total_context_stays_within_budget(self) -> None:
        """Total context should target approximately 4000 tokens."""
        # Create a session with realistic content
        session = {
            "server_info": {
                "uname": "Linux webserver01 5.15.0-91-generic #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023 x86_64 GNU/Linux",
                "shell": "/bin/bash",
                "os_release": 'PRETTY_NAME="Ubuntu 22.04.3 LTS"\nNAME="Ubuntu"\nVERSION_ID="22.04"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"',
                "username": "admin",
                "cwd": "/var/www/production/app",
            },
            "output_buffer": [
                "2024-01-15 10:30:15 INFO  Starting application server...",
                "2024-01-15 10:30:16 INFO  Loading configuration from /etc/app/config.yaml",
                "2024-01-15 10:30:17 INFO  Database connection established",
                "2024-01-15 10:30:18 WARN  Cache miss for key: user_session_12345",
                "2024-01-15 10:30:19 ERROR Connection timeout to external API",
            ],
        }
        settings = {"context_lines": 50}

        context = build_context(session, settings)

        # Rough token estimation: ~4 characters per token
        # 4000 tokens ≈ 16000 characters
        # Context should be reasonably bounded
        estimated_tokens = len(context) // 4

        # Allow some flexibility but should be within reasonable range
        # The context itself is not the full input (system prompt + history also count)
        # So context alone should be well under 4000 tokens
        assert estimated_tokens < 3000, f"Context too large: ~{estimated_tokens} tokens"

    def test_history_deque_limits_conversation_tokens(self) -> None:
        """History deque should limit conversation history to reasonable size."""
        # With max_chat_rounds=10, maxlen=20 (10 pairs of user/assistant)
        history = create_history_deque(max_chat_rounds=10)

        # Add 15 rounds of conversation (30 messages)
        for i in range(15):
            history.append({"role": "user", "content": f"User message {i}"})
            history.append({"role": "assistant", "content": f"Assistant response {i}"})

        # Should only keep last 20 messages (10 rounds)
        assert len(history) == 20
        # First message should be from round 5 (0-indexed)
        assert "5" in history[0]["content"]
