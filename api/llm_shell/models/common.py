"""Common types and enums."""

from enum import Enum


class AuthType(str, Enum):
    """SSH authentication type."""

    KEY = "key"
    PASSWORD = "password"


class RiskLevel(str, Enum):
    """Command risk level."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CommandSource(str, Enum):
    """Command source type."""

    MANUAL = "manual"
    AI = "ai"
