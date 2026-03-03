"""Ring buffer for terminal output with ANSI escape code stripping."""

import re
from collections import deque

# ANSI escape code pattern
# Matches: ESC [ followed by any number of parameter bytes (0x30-0x3F)
# and intermediate bytes (0x20-0x2F), followed by a final byte (0x40-0x7E)
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


class OutputBuffer:
    """Ring buffer for storing terminal output with ANSI escape code stripping.

    This class stores terminal output lines in a fixed-size ring buffer.
    ANSI escape codes are automatically stripped from the output.

    Attributes:
        capacity: Maximum number of lines to store (default 1000).
    """

    def __init__(self, capacity: int = 1000) -> None:
        """Initialize the output buffer.

        Args:
            capacity: Maximum number of lines to store. Defaults to 1000.
        """
        self._capacity = capacity
        self._buffer: deque[str] = deque(maxlen=capacity)
        self._partial_line: str = ""

    @property
    def capacity(self) -> int:
        """Return the buffer capacity."""
        return self._capacity

    @property
    def total_lines(self) -> int:
        """Return the current number of lines in the buffer.

        This includes any partial line that hasn't been terminated yet.
        """
        count = len(self._buffer)
        if self._partial_line:
            count += 1
        return count

    def append(self, data: bytes) -> None:
        """Append data to the buffer.

        Data is decoded as UTF-8 and split on newlines. ANSI escape codes
        are stripped from the output. Lines are stored without the trailing
        newline character.

        Args:
            data: Raw bytes from terminal output.
        """
        # Decode and strip ANSI escape codes
        text = data.decode("utf-8", errors="replace")
        text = ANSI_ESCAPE_PATTERN.sub("", text)

        # Combine with any partial line from previous append
        text = self._partial_line + text
        self._partial_line = ""

        # Split on newlines and process each line
        lines = text.split("\n")

        # Last element is either a partial line (if text didn't end with \n)
        # or an empty string (if text ended with \n)
        if lines:
            self._partial_line = lines.pop()

        # Add complete lines to buffer
        for line in lines:
            self._buffer.append(line)

    def get_recent(self, n: int) -> list[str]:
        """Get the most recent n lines.

        Args:
            n: Number of lines to return.

        Returns:
            List of the most recent n lines, or all lines if n > total_lines.
            Includes any partial line at the end.
        """
        if n <= 0:
            return []

        # Build list including partial line if present
        all_lines = list(self._buffer)
        if self._partial_line:
            all_lines.append(self._partial_line)

        if n >= len(all_lines):
            return all_lines
        return all_lines[-n:]

    def get_all(self) -> list[str]:
        """Get all lines in the buffer.

        Returns:
            List of all lines currently in the buffer, including any partial line.
        """
        lines = list(self._buffer)
        if self._partial_line:
            lines.append(self._partial_line)
        return lines
