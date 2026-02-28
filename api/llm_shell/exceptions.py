"""Custom exceptions for the application."""

from typing import Any


class AppError(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        code: str,
        message: str,
        detail: str | None = None,
        status_code: int = 500,
    ) -> None:
        self.code = code
        self.message = message
        self.detail = detail
        self.status_code = status_code
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to error response format."""
        result: dict[str, Any] = {
            "error": {
                "code": self.code,
                "message": self.message,
            }
        }
        if self.detail:
            result["error"]["detail"] = self.detail
        return result


class NotFoundError(AppError):
    """Resource not found error."""

    def __init__(self, resource: str, resource_id: str) -> None:
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} not found",
            detail=f"Resource '{resource_id}' does not exist",
            status_code=404,
        )


class ValidationError(AppError):
    """Validation error."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            detail=detail,
            status_code=422,
        )


class ConflictError(AppError):
    """Resource conflict error."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(
            code="CONFLICT",
            message=message,
            detail=detail,
            status_code=409,
        )


class SSHError(AppError):
    """Base SSH-related error."""

    pass


class SSHConnectionRefusedError(SSHError):
    """SSH connection refused error."""

    def __init__(self, host: str, port: int) -> None:
        super().__init__(
            code="SSH_CONN_REFUSED",
            message="SSH connection refused",
            detail=f"Cannot connect to {host}:{port}",
            status_code=502,
        )


class SSHAuthFailedError(SSHError):
    """SSH authentication failed error."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(
            code="SSH_AUTH_FAILED",
            message="SSH authentication failed",
            detail=detail,
            status_code=502,
        )


class SSHHostKeyInvalidError(SSHError):
    """SSH host key invalid error."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(
            code="SSH_HOST_KEY_INVALID",
            message="SSH host key verification failed",
            detail=detail,
            status_code=502,
        )


class SSHConnectionLostError(SSHError):
    """SSH connection lost error."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(
            code="SSH_CONN_LOST",
            message="SSH connection lost",
            detail=detail,
            status_code=502,
        )


class SSHChannelFailedError(SSHError):
    """SSH channel failed error."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(
            code="SSH_CHANNEL_FAILED",
            message="SSH channel failed",
            detail=detail,
            status_code=502,
        )


class AIError(AppError):
    """Base AI-related error."""

    pass


class AIAuthFailedError(AIError):
    """AI authentication failed error."""

    def __init__(self) -> None:
        super().__init__(
            code="AI_AUTH_FAILED",
            message="Claude API key is invalid",
            detail="Please update your API key in settings",
            status_code=401,
        )


class AIRateLimitedError(AIError):
    """AI rate limited error."""

    def __init__(self) -> None:
        super().__init__(
            code="AI_RATE_LIMITED",
            message="AI service is busy, please retry later",
            detail="Rate limit exceeded",
            status_code=429,
        )


class AITimeoutError(AIError):
    """AI timeout error."""

    def __init__(self) -> None:
        super().__init__(
            code="AI_TIMEOUT",
            message="AI service response timeout",
            detail="Request timed out",
            status_code=504,
        )


class AIUnavailableError(AIError):
    """AI unavailable error."""

    def __init__(self) -> None:
        super().__init__(
            code="AI_UNAVAILABLE",
            message="AI service is unavailable",
            detail="Service temporarily unavailable",
            status_code=502,
        )


class CommandBlockedError(AppError):
    """Command blocked by security policy."""

    def __init__(self, command: str, reason: str) -> None:
        super().__init__(
            code="COMMAND_BLOCKED",
            message="Command blocked by security policy",
            detail=f"Command '{command}' blocked: {reason}",
            status_code=403,
        )
