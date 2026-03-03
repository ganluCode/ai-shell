"""Security service for keyring operations and command safety checking."""

import re
from typing import TypedDict

import keyring
import keyring.errors

SERVICE_NAME = "llm-shell"

# Patterns that should always be blocked - extremely dangerous commands
BLOCKED_PATTERNS: list[tuple[str, str]] = [
    # rm -rf at root level
    (r"\brm\s+(-[a-z]*r[a-z]*\s+)*(-[a-z]*f[a-z]*\s+)*(/\s*)?$", "rm -rf / pattern detected"),
    # mkfs - format filesystem
    (r"\bmkfs\b", "mkfs (format filesystem) detected"),
    # dd writing to /dev
    (r"\bdd\s+.*of=/dev/", "dd writing to /dev detected"),
    # fork bomb
    (r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:", "fork bomb detected"),
    # chmod -R 777 at root
    (r"\bchmod\s+(-[a-z]*R[a-z]*\s+)*777\s+/", "chmod -R 777 / detected"),
    # direct disk write with redirection
    (r">\s*/dev/(sda|nvme|hd|vd|mmcblk)", "direct disk write detected"),
    # reverse shell via /dev/tcp
    (r"\bexec\s+.*>/dev/tcp/", "reverse shell pattern detected"),
]

# Patterns that are high risk but may be allowed with confirmation
HIGH_RISK_PATTERNS: list[tuple[str, str]] = [
    # shutdown/reboot commands and service control
    (
        r"\b(shutdown|reboot|halt|poweroff|init\s+[06]|systemctl\s+(restart|stop|disable))\b",
        "system power control or service management command",
    ),
    # rm -rf (not at root level - that's blocked)
    (r"\brm\s+(-[a-z]*r[a-z]*\s+)*(-[a-z]*f[a-z]*\s+)+", "rm -rf command"),
    # SQL DROP TABLE
    (r"\bDROP\s+TABLE\b", "DROP TABLE detected"),
    # SQL TRUNCATE
    (r"\bTRUNCATE\s+(TABLE\s+)?", "TRUNCATE detected"),
]


class CommandSafetyResult(TypedDict):
    """Result of command safety check."""

    status: str
    reason: str


def store_secret(key: str, value: str) -> bool:
    """Store a secret in the system keyring.

    Args:
        key: The key identifier (e.g., 'api_key', 'passphrase:{keypair_id}',
             'password:{server_id}')
        value: The secret value to store

    Returns:
        True if successful
    """
    keyring.set_password(SERVICE_NAME, key, value)
    return True


def get_secret(key: str) -> str | None:
    """Retrieve a secret from the system keyring.

    Args:
        key: The key identifier

    Returns:
        The secret value if found, None otherwise
    """
    return keyring.get_password(SERVICE_NAME, key)


def delete_secret(key: str) -> bool:
    """Delete a secret from the system keyring.

    Args:
        key: The key identifier

    Returns:
        True if successful, False if the key doesn't exist
    """
    try:
        keyring.delete_password(SERVICE_NAME, key)
        return True
    except keyring.errors.PasswordDeleteError:
        return False


def check_command_safety(command: str) -> CommandSafetyResult:
    """Check if a command is safe to execute.

    Args:
        command: The command to check

    Returns:
        A dict with 'status' ('blocked', 'high', or 'pass') and 'reason'
    """
    # Check blocked patterns first
    for pattern, reason in BLOCKED_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return CommandSafetyResult(status="blocked", reason=reason)

    # Check high risk patterns
    for pattern, reason in HIGH_RISK_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return CommandSafetyResult(status="high", reason=reason)

    # Command is safe
    return CommandSafetyResult(status="pass", reason="")
