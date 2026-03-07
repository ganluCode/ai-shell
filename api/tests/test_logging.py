"""Tests for structured logging service."""

import logging
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from llm_shell.services.logging import (
    SensitiveDataFilter,
    get_logger,
    log_ai_token_usage,
    setup_logging,
)


class TestSensitiveDataFilter:
    """Tests for SensitiveDataFilter."""

    def test_filter_redacts_password(self) -> None:
        """Test that password is redacted in log records."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='User login with password="secret123"',
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        assert "secret123" not in record.getMessage()
        assert "***REDACTED***" in record.getMessage()

    def test_filter_redacts_private_key(self) -> None:
        """Test that private_key is redacted."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='SSH key: private_key="-----BEGIN RSA PRIVATE KEY-----"',
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        assert "PRIVATE KEY" not in record.getMessage()
        assert "***REDACTED***" in record.getMessage()

    def test_filter_redacts_passphrase(self) -> None:
        """Test that passphrase is redacted."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='Key passphrase="my_secret_passphrase"',
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        assert "my_secret_passphrase" not in record.getMessage()
        assert "***REDACTED***" in record.getMessage()

    def test_filter_redacts_token(self) -> None:
        """Test that token is redacted."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='Auth token="eyJhbGciOiJIUzI1NiJ9"',
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        assert "eyJhbGciOiJIUzI1NiJ9" not in record.getMessage()
        assert "***REDACTED***" in record.getMessage()

    def test_filter_redacts_api_key_keeps_last_4_chars(self) -> None:
        """Test that API key is redacted but keeps last 4 characters."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='Using api_key="sk-ant-1234567890abcd"',
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        message = record.getMessage()
        # Should not contain the full API key
        assert "sk-ant-1234567890abcd" not in message
        # Should contain last 4 chars (abcd)
        assert "abcd" in message
        # Should have redaction marker
        assert "***" in message

    def test_filter_handles_multiple_sensitive_fields(self) -> None:
        """Test that multiple sensitive fields are redacted in one message."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='Login: password="secret" and token="abc123"',
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        message = record.getMessage()
        assert "secret" not in message
        assert "abc123" not in message
        assert message.count("***REDACTED***") >= 2

    def test_filter_preserves_non_sensitive_content(self) -> None:
        """Test that non-sensitive content is preserved."""
        filter_obj = SensitiveDataFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="User connected from 192.168.1.1",
            args=(),
            exc_info=None,
        )
        result = filter_obj.filter(record)
        assert result is True
        assert "192.168.1.1" in record.getMessage()


class TestSetupLogging:
    """Tests for setup_logging function."""

    def test_setup_logging_debug_mode(self) -> None:
        """Test setup_logging with debug=True configures console logging."""
        with patch("llm_shell.services.logging.structlog") as mock_structlog:
            setup_logging(debug=True)
            # Verify structlog configuration was called
            mock_structlog.configure.assert_called_once()

    def test_setup_logging_production_mode(self, tmp_path: Path) -> None:
        """Test setup_logging with debug=False configures file logging."""
        with patch("llm_shell.services.logging.structlog") as mock_structlog:
            with patch("llm_shell.services.logging.platformdirs") as mock_dirs:
                # Use a temp directory that we can write to
                mock_dirs.user_log_dir.return_value = str(tmp_path / "logs")
                setup_logging(debug=False)
                mock_structlog.configure.assert_called_once()

    def test_setup_logging_does_not_throw_exceptions(self, tmp_path: Path) -> None:
        """Test that setup_logging runs without exceptions."""
        # This test ensures the function can be called at startup
        with patch("llm_shell.services.logging.structlog"):
            with patch("llm_shell.services.logging.platformdirs") as mock_dirs:
                mock_dirs.user_log_dir.return_value = str(tmp_path / "logs")
                # Should not raise any exceptions
                setup_logging(debug=True)
                setup_logging(debug=False)


class TestGetLogger:
    """Tests for get_logger function."""

    def test_get_logger_returns_logger_for_ssh(self) -> None:
        """Test getting logger for ssh module."""
        logger = get_logger("ssh")
        assert logger is not None
        # The logger name should be llmshell.ssh

    def test_get_logger_returns_logger_for_ai(self) -> None:
        """Test getting logger for ai module."""
        logger = get_logger("ai")
        assert logger is not None

    def test_get_logger_returns_logger_for_ws(self) -> None:
        """Test getting logger for ws module."""
        logger = get_logger("ws")
        assert logger is not None

    def test_get_logger_returns_logger_for_api(self) -> None:
        """Test getting logger for api module."""
        logger = get_logger("api")
        assert logger is not None

    def test_get_logger_returns_logger_for_sftp(self) -> None:
        """Test getting logger for sftp module."""
        logger = get_logger("sftp")
        assert logger is not None


class TestLogAITokenUsage:
    """Tests for log_ai_token_usage function."""

    def test_log_ai_token_usage_logs_all_fields(self) -> None:
        """Test that AI token usage logs all required fields."""
        with patch("llm_shell.services.logging.get_logger") as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger

            log_ai_token_usage(
                model="claude-3-sonnet",
                input_tokens=100,
                output_tokens=50,
                stop_reason="end_turn",
                duration_ms=250,
            )

            mock_get_logger.assert_called_once_with("ai")
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            assert call_args is not None
            # Check the event name
            assert call_args[0][0] == "ai_token_usage"
            # Check the kwargs contain all required fields
            kwargs = call_args[1]
            assert kwargs["model"] == "claude-3-sonnet"
            assert kwargs["input_tokens"] == 100
            assert kwargs["output_tokens"] == 50
            assert kwargs["stop_reason"] == "end_turn"
            assert kwargs["duration_ms"] == 250
