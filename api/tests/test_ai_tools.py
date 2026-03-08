"""Tests for AI tool definitions."""

import pytest

from llm_shell.services.ai import TOOLS


class TestToolsList:
    """Tests for TOOLS list definition."""

    def test_tools_is_list(self) -> None:
        """TOOLS should be a list."""
        assert isinstance(TOOLS, list)
        assert len(TOOLS) == 5

    def test_tools_have_required_fields(self) -> None:
        """Each tool should have name, description, and input_schema."""
        for tool in TOOLS:
            assert "name" in tool
            assert "description" in tool
            assert "input_schema" in tool
            assert isinstance(tool["name"], str)
            assert isinstance(tool["description"], str)
            assert isinstance(tool["input_schema"], dict)


class TestSuggestCommandTool:
    """Tests for suggest_command tool schema."""

    @pytest.fixture
    def suggest_command_tool(self) -> dict:
        """Get suggest_command tool definition."""
        for tool in TOOLS:
            if tool["name"] == "suggest_command":
                return tool
        pytest.fail("suggest_command tool not found")

    def test_suggest_command_exists(self, suggest_command_tool: dict) -> None:
        """suggest_command tool should exist."""
        assert suggest_command_tool["name"] == "suggest_command"

    def test_suggest_command_has_command_param(self, suggest_command_tool: dict) -> None:
        """suggest_command should have command parameter (string)."""
        schema = suggest_command_tool["input_schema"]
        assert "command" in schema["properties"]
        assert schema["properties"]["command"]["type"] == "string"
        assert "command" in schema["required"]

    def test_suggest_command_has_explanation_param(self, suggest_command_tool: dict) -> None:
        """suggest_command should have explanation parameter (string)."""
        schema = suggest_command_tool["input_schema"]
        assert "explanation" in schema["properties"]
        assert schema["properties"]["explanation"]["type"] == "string"
        assert "explanation" in schema["required"]

    def test_suggest_command_has_risk_level_param(self, suggest_command_tool: dict) -> None:
        """suggest_command should have risk_level parameter (enum: low/medium/high)."""
        schema = suggest_command_tool["input_schema"]
        assert "risk_level" in schema["properties"]
        prop = schema["properties"]["risk_level"]
        assert prop["type"] == "string"
        assert "enum" in prop
        assert set(prop["enum"]) == {"low", "medium", "high"}
        assert "risk_level" in schema["required"]

    def test_suggest_command_has_optional_thinking(self, suggest_command_tool: dict) -> None:
        """suggest_command should have optional thinking parameter (string)."""
        schema = suggest_command_tool["input_schema"]
        assert "thinking" in schema["properties"]
        assert schema["properties"]["thinking"]["type"] == "string"
        # thinking is optional, should not be in required
        assert "thinking" not in schema.get("required", [])


class TestSuggestCommandsTool:
    """Tests for suggest_commands tool schema."""

    @pytest.fixture
    def suggest_commands_tool(self) -> dict:
        """Get suggest_commands tool definition."""
        for tool in TOOLS:
            if tool["name"] == "suggest_commands":
                return tool
        pytest.fail("suggest_commands tool not found")

    def test_suggest_commands_exists(self, suggest_commands_tool: dict) -> None:
        """suggest_commands tool should exist."""
        assert suggest_commands_tool["name"] == "suggest_commands"

    def test_suggest_commands_has_commands_array(self, suggest_commands_tool: dict) -> None:
        """suggest_commands should have commands array parameter."""
        schema = suggest_commands_tool["input_schema"]
        assert "commands" in schema["properties"]
        commands_prop = schema["properties"]["commands"]
        assert commands_prop["type"] == "array"
        assert "commands" in schema["required"]

    def test_suggest_commands_command_items_have_required_fields(self, suggest_commands_tool: dict) -> None:
        """Each command in commands array should have command, explanation, risk_level."""
        schema = suggest_commands_tool["input_schema"]
        commands_prop = schema["properties"]["commands"]
        items = commands_prop["items"]

        # Check required fields in items
        assert "command" in items["properties"]
        assert items["properties"]["command"]["type"] == "string"
        assert "explanation" in items["properties"]
        assert items["properties"]["explanation"]["type"] == "string"
        assert "risk_level" in items["properties"]
        assert items["properties"]["risk_level"]["type"] == "string"
        assert "enum" in items["properties"]["risk_level"]
        assert set(items["properties"]["risk_level"]["enum"]) == {"low", "medium", "high"}

        # Check required array
        assert "required" in items
        assert "command" in items["required"]
        assert "explanation" in items["required"]
        assert "risk_level" in items["required"]

    def test_suggest_commands_has_optional_thinking(self, suggest_commands_tool: dict) -> None:
        """suggest_commands should have optional thinking parameter."""
        schema = suggest_commands_tool["input_schema"]
        assert "thinking" in schema["properties"]
        assert schema["properties"]["thinking"]["type"] == "string"
        assert "thinking" not in schema.get("required", [])


class TestSearchTerminalOutputTool:
    """Tests for search_terminal_output tool schema."""

    @pytest.fixture
    def search_tool(self) -> dict:
        """Get search_terminal_output tool definition."""
        for tool in TOOLS:
            if tool["name"] == "search_terminal_output":
                return tool
        pytest.fail("search_terminal_output tool not found")

    def test_search_terminal_output_exists(self, search_tool: dict) -> None:
        """search_terminal_output tool should exist."""
        assert search_tool["name"] == "search_terminal_output"

    def test_search_has_pattern_param(self, search_tool: dict) -> None:
        """search_terminal_output should have pattern parameter (string)."""
        schema = search_tool["input_schema"]
        assert "pattern" in schema["properties"]
        assert schema["properties"]["pattern"]["type"] == "string"
        assert "pattern" in schema["required"]

    def test_search_has_context_lines_param(self, search_tool: dict) -> None:
        """search_terminal_output should have context_lines parameter (int, default 3)."""
        schema = search_tool["input_schema"]
        assert "context_lines" in schema["properties"]
        prop = schema["properties"]["context_lines"]
        assert prop["type"] == "integer"
        assert prop["default"] == 3
        # context_lines is optional (has default)
        assert "context_lines" not in schema.get("required", [])


class TestToolSchemaFormat:
    """Tests for Claude API tool schema format compliance."""

    def test_all_tools_have_object_schema(self) -> None:
        """All tools should have input_schema with type 'object'."""
        for tool in TOOLS:
            schema = tool["input_schema"]
            assert schema["type"] == "object"
            assert "properties" in schema

    def test_all_tool_names_are_valid(self) -> None:
        """All tool names should be valid (1-128 chars, alphanumeric/underscore)."""
        for tool in TOOLS:
            name = tool["name"]
            assert 1 <= len(name) <= 128
            assert name.replace("_", "").isalnum()
