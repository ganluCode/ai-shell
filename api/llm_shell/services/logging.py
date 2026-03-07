"""Structured logging service with structlog."""

import logging
import re
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

import platformdirs
import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# Sensitive field patterns for redaction
SENSITIVE_FIELDS = ["password", "private_key", "passphrase", "token"]


class SensitiveDataFilter:
    """Logging filter that redacts sensitive data from log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        """Filter and redact sensitive data from log record message."""
        message = record.getMessage()

        # Redact full sensitive fields (password, private_key, passphrase, token)
        for field in SENSITIVE_FIELDS:
            # Match patterns like field="value", field='value', field: "value", field=value
            patterns = [
                rf'({field}["\s:=]+)"([^"]+)"',
                rf"({field}['\s:=]+)'([^']+)'",
                rf"({field}[\s:=]+)([^\s]+)",
            ]
            for pattern in patterns:
                message = re.sub(pattern, rf'\1"***REDACTED***"', message, flags=re.IGNORECASE)

        # Redact API key but keep last 4 characters
        def redact_api_key_quoted(match: re.Match[str]) -> str:
            prefix = match.group(1)
            key = match.group(2)
            if len(key) > 4:
                return f'{prefix}"***{key[-4:]}"'
            return f'{prefix}"***REDACTED***"'

        def redact_api_key_unquoted(match: re.Match[str]) -> str:
            prefix = match.group(1)
            key = match.group(2)
            if len(key) > 4:
                return f'{prefix}***{key[-4:]}'
            return f'{prefix}***REDACTED***'

        # Handle api_key with double quotes
        message = re.sub(
            r'(api_key=)"([^"]+)"',
            redact_api_key_quoted,
            message,
            flags=re.IGNORECASE,
        )
        # Handle api_key with single quotes
        message = re.sub(
            r"(api_key=)'([^']+)'",
            redact_api_key_quoted,
            message,
            flags=re.IGNORECASE,
        )
        # Handle api_key without quotes (value doesn't start with quote)
        message = re.sub(
            r"(api_key[=:\s]+)([^\"'\s]+)",
            redact_api_key_unquoted,
            message,
            flags=re.IGNORECASE,
        )

        # Update the record's message
        record.msg = message
        record.args = ()
        return True


def setup_logging(debug: bool = False) -> None:
    """Set up structured logging configuration.

    Args:
        debug: If True, use ConsoleRenderer for development.
               If False, use JSONRenderer with RotatingFileHandler for production.
    """
    # Get log directory using platformdirs
    log_dir = Path(platformdirs.user_log_dir("llmshell"))
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "llmshell.log"

    # Configure standard logging
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Clear existing handlers
    root_logger.handlers.clear()

    # Add filter to root logger
    sensitive_filter = SensitiveDataFilter()

    if debug:
        # Development mode: Console output with pretty formatting
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        console_handler.addFilter(sensitive_filter)
        root_logger.addHandler(console_handler)

        # Configure structlog for development
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.dev.ConsoleRenderer(colors=True),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Production mode: File output with JSON format
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
        )
        file_handler.setLevel(logging.INFO)
        file_handler.addFilter(sensitive_filter)
        root_logger.addHandler(file_handler)

        # Configure structlog for production
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )


def get_logger(module: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger for a specific module.

    Args:
        module: Module name (e.g., 'ssh', 'ai', 'ws', 'api', 'sftp').

    Returns:
        A structlog BoundLogger for the module.
    """
    return structlog.get_logger(f"llmshell.{module}")


def log_ai_token_usage(
    model: str,
    input_tokens: int,
    output_tokens: int,
    stop_reason: str,
    duration_ms: int,
) -> None:
    """Log AI token usage information.

    Args:
        model: The AI model used.
        input_tokens: Number of input tokens.
        output_tokens: Number of output tokens.
        stop_reason: Reason for stopping (e.g., 'end_turn', 'max_tokens').
        duration_ms: Request duration in milliseconds.
    """
    logger = get_logger("ai")
    logger.info(
        "ai_token_usage",
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        stop_reason=stop_reason,
        duration_ms=duration_ms,
    )


class LoggingMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for logging HTTP requests."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request and log HTTP method, path, status, and duration."""
        logger = get_logger("api")

        # Record start time
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)

        # Log request details
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )

        return response
