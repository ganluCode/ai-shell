"""SSH Config parsing service."""

from pathlib import Path

from pydantic import BaseModel


class SSHConfigEntry(BaseModel):
    """Represents a parsed SSH config entry."""

    label: str  # Host alias
    host: str | None = None  # HostName (falls back to label if not specified)
    username: str | None = None
    port: int = 22
    identity_file: str | None = None  # Expanded absolute path
    proxy_jump: str | None = None
    already_exists: bool = False  # Whether same host+port+username already exists


def parse_ssh_config(config_path: str) -> list[SSHConfigEntry]:
    """
    Parse SSH config file and return list of entries.

    Args:
        config_path: Path to SSH config file

    Returns:
        List of SSHConfigEntry objects

    Raises:
        FileNotFoundError: If config file doesn't exist
    """
    path = Path(config_path).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"SSH config file not found: {config_path}")

    entries: list[SSHConfigEntry] = []
    _parse_config_file(path, entries)

    return entries


def _parse_config_file(path: Path, entries: list[SSHConfigEntry]) -> None:
    """Parse a single config file, handling Include directives recursively."""
    content = path.read_text()

    current_host_patterns: list[str] = []
    current_fields: dict[str, str | int] = {}

    for line in content.splitlines():
        line = line.strip()

        # Skip empty lines and comments
        if not line or line.startswith("#"):
            continue

        # Handle Include directive
        if line.lower().startswith("include"):
            include_path = line.split(None, 1)[1].strip() if len(line.split(None, 1)) > 1 else ""
            if include_path:
                # Expand ~ and resolve relative to current file's directory
                include_path_expanded = Path(include_path).expanduser()
                if not include_path_expanded.is_absolute():
                    include_path_expanded = path.parent / include_path_expanded

                # Handle glob patterns in include path
                if "*" in str(include_path_expanded) or "?" in str(include_path_expanded):
                    import glob

                    for matched_path in sorted(glob.glob(str(include_path_expanded))):
                        _parse_config_file(Path(matched_path), entries)
                elif include_path_expanded.exists():
                    _parse_config_file(include_path_expanded, entries)
            continue

        # Parse directive
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue

        key = parts[0].lower()
        value = parts[1].strip()

        if key == "host":
            # Save previous host entry if exists
            if current_host_patterns:
                _add_host_entries(current_host_patterns, current_fields, entries)

            # Start new host block
            current_host_patterns = value.split()
            current_fields = {}
        elif current_host_patterns:
            # We're inside a Host block
            if key == "hostname":
                current_fields["host"] = value
            elif key == "user":
                current_fields["username"] = value
            elif key == "port":
                try:
                    current_fields["port"] = int(value)
                except ValueError:
                    pass  # Ignore invalid port
            elif key == "identityfile":
                # Only set identity_file if not already set
                if "identity_file" not in current_fields:
                    # Expand tilde to home directory
                    expanded_path = str(Path(value).expanduser())
                    current_fields["identity_file"] = expanded_path
            elif key == "proxyjump":
                current_fields["proxy_jump"] = value

    # Don't forget the last host entry
    if current_host_patterns:
        _add_host_entries(current_host_patterns, current_fields, entries)


def _add_host_entries(
    patterns: list[str],
    fields: dict[str, str | int],
    entries: list[SSHConfigEntry],
) -> None:
    """Add entries for each host pattern, skipping wildcards."""
    for pattern in patterns:
        # Skip wildcard patterns
        if pattern == "*" or pattern == "?":
            continue

        # Use label as host if HostName not specified
        host = fields.get("host", pattern)

        entry = SSHConfigEntry(
            label=pattern,
            host=host,
            username=fields.get("username"),
            port=fields.get("port", 22),
            identity_file=fields.get("identity_file"),
            proxy_jump=fields.get("proxy_jump"),
            already_exists=False,
        )
        entries.append(entry)
