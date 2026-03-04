"""Tests for AI prompt building."""

import pytest

from llm_shell.services.ai import SYSTEM_PROMPT, build_context


class TestSystemPrompt:
    """Tests for SYSTEM_PROMPT constant."""

    def test_system_prompt_exists(self) -> None:
        """SYSTEM_PROMPT should be defined."""
        assert SYSTEM_PROMPT is not None
        assert isinstance(SYSTEM_PROMPT, str)
        assert len(SYSTEM_PROMPT) > 0

    def test_system_prompt_defines_role(self) -> None:
        """SYSTEM_PROMPT should define the AI's role."""
        prompt_lower = SYSTEM_PROMPT.lower()
        # Should mention generating shell commands
        assert "shell" in prompt_lower or "command" in prompt_lower or "命令" in SYSTEM_PROMPT
        # Should mention tool use (English "tool" or Chinese "工具")
        assert "tool" in prompt_lower or "工具" in SYSTEM_PROMPT
        # Should mention risk evaluation (English "risk" or Chinese "风险")
        assert "risk" in prompt_lower or "风险" in SYSTEM_PROMPT
        # Should mention not fabricating (English "fabricat" or Chinese "真实/编造")
        assert "fabricat" in prompt_lower or "真实" in SYSTEM_PROMPT or "编造" in SYSTEM_PROMPT


class TestBuildContext:
    """Tests for build_context function."""

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create a mock session with server_info and output_buffer."""
        return {
            "server_info": {
                "uname": "Linux server1 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux",
                "shell": "/bin/bash",
                "os_release": "PRETTY_NAME=\"Ubuntu 22.04.3 LTS\"",
                "username": "testuser",
            },
            "output_buffer": [
                "line 1 of output",
                "line 2 of output",
                "line 3 of output",
                "line 4 of output",
                "line 5 of output",
            ],
        }

    @pytest.fixture
    def mock_settings(self) -> dict:
        """Create mock settings."""
        return {
            "context_lines": 50,
        }

    def test_build_context_contains_server_info(self, mock_session: dict, mock_settings: dict) -> None:
        """build_context should include server_info (OS, hostname, user, shell)."""
        context = build_context(mock_session, mock_settings)

        # Should contain OS info (from os_release or uname)
        assert "Ubuntu" in context or "Linux" in context
        # Should contain hostname (from uname)
        assert "server1" in context
        # Should contain user
        assert "testuser" in context
        # Should contain shell
        assert "/bin/bash" in context

    def test_build_context_contains_terminal_output(self, mock_session: dict, mock_settings: dict) -> None:
        """build_context should include terminal output."""
        context = build_context(mock_session, mock_settings)

        # Should contain the output lines
        assert "line 1 of output" in context
        assert "line 5 of output" in context

    def test_build_context_limits_output_lines(self) -> None:
        """build_context should limit terminal output to context_lines."""
        # Create session with more lines than context_lines
        session = {
            "server_info": {
                "uname": "Linux server1 5.15.0-91-generic",
                "shell": "/bin/bash",
                "os_release": "Ubuntu 22.04",
                "username": "testuser",
            },
            "output_buffer": [f"line {i}" for i in range(100)],  # 100 lines
        }
        settings = {"context_lines": 10}  # Only want 10 lines

        context = build_context(session, settings)

        # Should show omission message
        assert "省略" in context or "omitted" in context.lower()
        # Should contain last 10 lines
        assert "line 99" in context  # Last line
        # Should NOT contain early lines
        assert "line 0" not in context
        assert "line 5" not in context

    def test_build_context_shows_omission_message(self) -> None:
        """When output exceeds context_lines, show '[... 省略了前 X 行 ...]' message."""
        session = {
            "server_info": {
                "uname": "Linux server1 5.15.0-91-generic",
                "shell": "/bin/bash",
                "os_release": "Ubuntu 22.04",
                "username": "testuser",
            },
            "output_buffer": [f"line {i}" for i in range(50)],
        }
        settings = {"context_lines": 10}

        context = build_context(session, settings)

        # Should show the omission message with count
        # 50 total - 10 context_lines = 40 omitted
        assert "省略了前" in context
        assert "40" in context

    def test_build_context_handles_empty_output(self) -> None:
        """build_context should handle empty output buffer gracefully."""
        session = {
            "server_info": {
                "uname": "Linux server1",
                "shell": "/bin/bash",
                "os_release": "",
                "username": "testuser",
            },
            "output_buffer": [],
        }
        settings = {"context_lines": 50}

        context = build_context(session, settings)

        # Should still work without errors
        assert isinstance(context, str)
        assert "testuser" in context

    def test_build_context_includes_current_directory(self, mock_session: dict, mock_settings: dict) -> None:
        """build_context should include current working directory."""
        # Add cwd to server_info
        mock_session["server_info"]["cwd"] = "/home/testuser/project"

        context = build_context(mock_session, mock_settings)

        # Should contain the current working directory
        assert "/home/testuser/project" in context
