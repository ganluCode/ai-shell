"""Tests for OutputBuffer class."""

from llm_shell.services.output_buffer import OutputBuffer


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
            buffer.append(f"line {i}\n".encode())

        # Should only keep last 5
        assert buffer.total_lines == 5
        assert buffer.get_all() == ["line 5", "line 6", "line 7", "line 8", "line 9"]

    def test_total_lines_accurate_after_overflow(self) -> None:
        """total_lines should be accurate after buffer overflow."""
        buffer = OutputBuffer(capacity=3)
        for i in range(10):
            buffer.append(f"line {i}\n".encode())

        assert buffer.total_lines == 3


class TestOutputBufferANSIStripping:
    """Test ANSI escape code stripping."""

    def test_strip_ansi_color_codes(self) -> None:
        """ANSI color codes should be stripped."""
        buffer = OutputBuffer()
        # Green text: \x1b[32mHello\x1b[0m
        buffer.append(b"\x1b[32mHello\x1b[0m\n")

        assert buffer.get_all() == ["Hello"]

    def test_strip_ansi_cursor_movement(self) -> None:
        """ANSI cursor movement codes should be stripped."""
        buffer = OutputBuffer()
        # Move cursor up: \x1b[1A
        buffer.append(b"Line1\x1b[1ALine1\n")

        assert buffer.get_all() == ["Line1Line1"]

    def test_strip_ansi_clear_screen(self) -> None:
        """ANSI clear screen codes should be stripped."""
        buffer = OutputBuffer()
        # Clear screen: \x1b[2J
        buffer.append(b"\x1b[2JHello\n")

        assert buffer.get_all() == ["Hello"]

    def test_strip_ansi_multiple_codes(self) -> None:
        """Multiple ANSI codes should be stripped."""
        buffer = OutputBuffer()
        # Bold, green, reset
        buffer.append(b"\x1b[1m\x1b[32mBold Green\x1b[0m\x1b[0m\n")

        assert buffer.get_all() == ["Bold Green"]

    def test_preserve_plain_text(self) -> None:
        """Plain text should be preserved unchanged."""
        buffer = OutputBuffer()
        buffer.append(b"Hello, World!\n")

        assert buffer.get_all() == ["Hello, World!"]

    def test_empty_output(self) -> None:
        """Empty input should result in empty buffer."""
        buffer = OutputBuffer()
        buffer.append(b"")

        assert buffer.total_lines == 0
        assert buffer.get_all() == []


class TestOutputBufferGetRecent:
    """Test get_recent method."""

    def test_get_recent_returns_last_n_lines(self) -> None:
        """get_recent(n) should return last n lines."""
        buffer = OutputBuffer()
        for i in range(10):
            buffer.append(f"line {i}\n".encode())

        recent = buffer.get_recent(3)
        assert recent == ["line 7", "line 8", "line 9"]

    def test_get_recent_with_n_greater_than_total(self) -> None:
        """get_recent(n) should return all lines if n > total."""
        buffer = OutputBuffer()
        for i in range(3):
            buffer.append(f"line {i}\n".encode())

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
            buffer.append(f"line {i}\n".encode())

        recent = buffer.get_recent(0)
        assert recent == []


class TestOutputBufferGetAll:
    """Test get_all method."""

    def test_get_all_returns_all_lines(self) -> None:
        """get_all should return all stored lines."""
        buffer = OutputBuffer()
        for i in range(5):
            buffer.append(f"line {i}\n".encode())

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
            buffer.append(f"line {i}\n".encode())

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
            buffer.append(f"line {i}\n".encode())

        assert buffer.total_lines == 5

    def test_total_lines_after_overflow(self) -> None:
        """total_lines should be capped at capacity after overflow."""
        buffer = OutputBuffer(capacity=3)
        for i in range(10):
            buffer.append(f"line {i}\n".encode())

        assert buffer.total_lines == 3


class TestOutputBufferMultilineAppend:
    """Test append with multiple lines in one chunk."""

    def test_append_multiline_data(self) -> None:
        """append should split data on newlines."""
        buffer = OutputBuffer()
        buffer.append(b"line 1\nline 2\nline 3\n")

        assert buffer.total_lines == 3
        assert buffer.get_all() == ["line 1", "line 2", "line 3"]

    def test_append_partial_line_continued(self) -> None:
        """append should handle partial lines continued in next append."""
        buffer = OutputBuffer()
        buffer.append(b"line 1")  # No newline
        buffer.append(b" continued\n")

        assert buffer.total_lines == 1
        assert buffer.get_all() == ["line 1 continued"]

    def test_append_multiline_with_ansi(self) -> None:
        """append should strip ANSI codes from multiline data."""
        buffer = OutputBuffer()
        buffer.append(b"\x1b[32mline 1\x1b[0m\n\x1b[31mline 2\x1b[0m\n")

        assert buffer.get_all() == ["line 1", "line 2"]

    def test_append_without_trailing_newline(self) -> None:
        """append without trailing newline should still store the line."""
        buffer = OutputBuffer()
        buffer.append(b"line 1\nline 2")

        assert buffer.total_lines == 2
        assert buffer.get_all() == ["line 1", "line 2"]
