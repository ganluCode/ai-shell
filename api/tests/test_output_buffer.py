"""Tests for OutputBuffer class."""

from llm_shell.services.output_buffer import OutputBuffer, search_output_buffer


class TestOutputBufferCapacity:
    """Test ring buffer capacity limit."""

    def test_default_capacity_is_1000(self) -> None:
        """OutputBuffer should have default capacity of 1000 lines."""
        buffer = OutputBuffer()
        assert buffer.capacity == 1000

    def test_custom_capacity_from_settings(self) -> None:
        """OutputBuffer should read capacity from settings."""
        buffer = OutputBuffer(capacity=500)
        assert buffer.capacity == 500

    def test_capacity_limit_enforced(self) -> None:
        """OutputBuffer should not exceed capacity."""
        buffer = OutputBuffer(capacity=5)

        # Add 10 lines
        for i in range(10):
            buffer.append(f"line {i}\n")

        # Should only keep last 5
        assert buffer.total_lines == 5
        assert buffer.get_all() == ["line 5", "line 6", "line 7", "line 8", "line 9"]

    def test_total_lines_accurate_after_overflow(self) -> None:
        """total_lines should be accurate after buffer overflow."""
        buffer = OutputBuffer(capacity=3)
        for i in range(10):
            buffer.append(f"line {i}\n")

        assert buffer.total_lines == 3


class TestOutputBufferANSIStripping:
    """Test ANSI escape code stripping."""

    def test_strip_ansi_color_codes(self) -> None:
        """ANSI color codes should be stripped."""
        buffer = OutputBuffer()
        # Green text: \x1b[32mHello\x1b[0m
        buffer.append("\x1b[32mHello\x1b[0m\n")

        assert buffer.get_all() == ["Hello"]

    def test_strip_ansi_cursor_movement(self) -> None:
        """ANSI cursor movement codes should be stripped."""
        buffer = OutputBuffer()
        # Move cursor up: \x1b[1A
        buffer.append("Line1\x1b[1ALine1\n")

        assert buffer.get_all() == ["Line1Line1"]

    def test_strip_ansi_clear_screen(self) -> None:
        """ANSI clear screen codes should be stripped."""
        buffer = OutputBuffer()
        # Clear screen: \x1b[2J
        buffer.append("\x1b[2JHello\n")

        assert buffer.get_all() == ["Hello"]

    def test_strip_ansi_multiple_codes(self) -> None:
        """Multiple ANSI codes should be stripped."""
        buffer = OutputBuffer()
        # Bold, green, reset
        buffer.append("\x1b[1m\x1b[32mBold Green\x1b[0m\x1b[0m\n")

        assert buffer.get_all() == ["Bold Green"]

    def test_preserve_plain_text(self) -> None:
        """Plain text should be preserved unchanged."""
        buffer = OutputBuffer()
        buffer.append("Hello, World!\n")

        assert buffer.get_all() == ["Hello, World!"]

    def test_empty_output(self) -> None:
        """Empty input should result in empty buffer."""
        buffer = OutputBuffer()
        buffer.append("")

        assert buffer.total_lines == 0
        assert buffer.get_all() == []


class TestOutputBufferGetRecent:
    """Test get_recent method."""

    def test_get_recent_returns_last_n_lines(self) -> None:
        """get_recent(n) should return last n lines."""
        buffer = OutputBuffer()
        for i in range(10):
            buffer.append(f"line {i}\n")

        recent = buffer.get_recent(3)
        assert recent == ["line 7", "line 8", "line 9"]

    def test_get_recent_with_n_greater_than_total(self) -> None:
        """get_recent(n) should return all lines if n > total."""
        buffer = OutputBuffer()
        for i in range(3):
            buffer.append(f"line {i}\n")

        recent = buffer.get_recent(10)
        assert recent == ["line 0", "line 1", "line 2"]

    def test_get_recent_empty_buffer(self) -> None:
        """get_recent on empty buffer should return empty list."""
        buffer = OutputBuffer()

        recent = buffer.get_recent(5)
        assert recent == []

    def test_get_recent_zero(self) -> None:
        """get_recent(0) should return empty list."""
        buffer = OutputBuffer()
        for i in range(5):
            buffer.append(f"line {i}\n")

        recent = buffer.get_recent(0)
        assert recent == []


class TestOutputBufferGetAll:
    """Test get_all method."""

    def test_get_all_returns_all_lines(self) -> None:
        """get_all should return all stored lines."""
        buffer = OutputBuffer()
        for i in range(5):
            buffer.append(f"line {i}\n")

        all_lines = buffer.get_all()
        assert all_lines == ["line 0", "line 1", "line 2", "line 3", "line 4"]

    def test_get_all_empty_buffer(self) -> None:
        """get_all on empty buffer should return empty list."""
        buffer = OutputBuffer()

        assert buffer.get_all() == []

    def test_get_all_after_overflow(self) -> None:
        """get_all should return only lines within capacity after overflow."""
        buffer = OutputBuffer(capacity=3)
        for i in range(10):
            buffer.append(f"line {i}\n")

        all_lines = buffer.get_all()
        assert all_lines == ["line 7", "line 8", "line 9"]


class TestOutputBufferTotalLines:
    """Test total_lines property."""

    def test_total_lines_empty(self) -> None:
        """total_lines should be 0 for empty buffer."""
        buffer = OutputBuffer()
        assert buffer.total_lines == 0

    def test_total_lines_after_appends(self) -> None:
        """total_lines should reflect number of appended lines."""
        buffer = OutputBuffer()
        for i in range(5):
            buffer.append(f"line {i}\n")

        assert buffer.total_lines == 5

    def test_total_lines_after_overflow(self) -> None:
        """total_lines should be capped at capacity after overflow."""
        buffer = OutputBuffer(capacity=3)
        for i in range(10):
            buffer.append(f"line {i}\n")

        assert buffer.total_lines == 3


class TestOutputBufferMultilineAppend:
    """Test append with multiple lines in one chunk."""

    def test_append_multiline_data(self) -> None:
        """append should split data on newlines."""
        buffer = OutputBuffer()
        buffer.append("line 1\nline 2\nline 3\n")

        assert buffer.total_lines == 3
        assert buffer.get_all() == ["line 1", "line 2", "line 3"]

    def test_append_partial_line_continued(self) -> None:
        """append should handle partial lines continued in next append."""
        buffer = OutputBuffer()
        buffer.append("line 1")  # No newline
        buffer.append(" continued\n")

        assert buffer.total_lines == 1
        assert buffer.get_all() == ["line 1 continued"]

    def test_append_multiline_with_ansi(self) -> None:
        """append should strip ANSI codes from multiline data."""
        buffer = OutputBuffer()
        buffer.append("\x1b[32mline 1\x1b[0m\n\x1b[31mline 2\x1b[0m\n")

        assert buffer.get_all() == ["line 1", "line 2"]

    def test_append_without_trailing_newline(self) -> None:
        """append without trailing newline should still store the line."""
        buffer = OutputBuffer()
        buffer.append("line 1\nline 2")

        assert buffer.total_lines == 2
        assert buffer.get_all() == ["line 1", "line 2"]


class TestSearchOutputBuffer:
    """Test search_output_buffer function."""

    def test_returns_matches_with_context_lines(self) -> None:
        """search_output_buffer should return matches with context lines."""
        buffer = [
            "line 0",
            "line 1",
            "error: something failed",
            "line 3",
            "line 4",
            "line 5",
        ]
        results = search_output_buffer(buffer, "error", context_lines=3)
        assert len(results) == 1
        assert results[0]["matched_line"] == "error: something failed"
        assert results[0]["line_number"] == 2
        assert results[0]["context"] == ["line 0", "line 1", "error: something failed", "line 3", "line 4", "line 5"]

    def test_escapes_invalid_regex_patterns(self) -> None:
        """Invalid regex patterns should be escaped and treated as literal."""
        buffer = ["file.txt", "other file"]
        # '[' is an invalid regex pattern
        results = search_output_buffer(buffer, "[invalid", context_lines=3)
        # Should find no match because '[' is escaped to literal
        assert results == []

    def test_valid_regex_pattern_works(self) -> None:
        """Valid regex patterns should work correctly."""
        buffer = ["error: 123", "warning: 456", "error: 789"]
        results = search_output_buffer(buffer, r"error: \d+", context_lines=0)
        assert len(results) == 2
        assert results[0]["matched_line"] == "error: 123"
        assert results[1]["matched_line"] == "error: 789"

    def test_returns_max_10_matches(self) -> None:
        """Should return max 10 matches to prevent token explosion."""
        buffer = [f"error line {i}" for i in range(20)]
        results = search_output_buffer(buffer, "error", context_lines=0)
        assert len(results) == 10

    def test_handles_empty_buffer_gracefully(self) -> None:
        """Empty buffer should return empty list."""
        results = search_output_buffer([], "pattern", context_lines=3)
        assert results == []

    def test_context_lines_default_is_3(self) -> None:
        """Default context_lines should be 3."""
        buffer = ["line 0", "line 1", "line 2", "match", "line 4", "line 5", "line 6"]
        results = search_output_buffer(buffer, "match")
        assert len(results) == 1
        # With context_lines=3: 3 before + match + 3 after = 7 lines
        assert len(results[0]["context"]) == 7

    def test_context_respects_buffer_boundaries(self) -> None:
        """Context should not go beyond buffer boundaries."""
        buffer = ["match", "line 1", "line 2"]
        results = search_output_buffer(buffer, "match", context_lines=3)
        assert len(results) == 1
        # No lines before match, so context should only include what exists
        assert results[0]["context"] == ["match", "line 1", "line 2"]

    def test_multiple_matches_with_separate_contexts(self) -> None:
        """Multiple matches should each have their own context."""
        buffer = [f"line {i}" for i in range(10)]
        buffer[2] = "error here"
        buffer[7] = "error there"
        results = search_output_buffer(buffer, "error", context_lines=1)
        assert len(results) == 2
        assert results[0]["matched_line"] == "error here"
        assert results[0]["context"] == ["line 1", "error here", "line 3"]
        assert results[1]["matched_line"] == "error there"
        assert results[1]["context"] == ["line 6", "error there", "line 8"]

    def test_no_matches_returns_empty_list(self) -> None:
        """Pattern not found should return empty list."""
        buffer = ["line 1", "line 2", "line 3"]
        results = search_output_buffer(buffer, "notfound", context_lines=3)
        assert results == []
