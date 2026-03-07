"""SSH Config Import API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from llm_shell.api.keypairs import get_keypairs_service
from llm_shell.api.servers import get_servers_service
from llm_shell.models.common import AuthType
from llm_shell.models.keypairs import KeyPairCreate
from llm_shell.models.servers import ServerCreate
from llm_shell.services.keypairs import KeyPairsService
from llm_shell.services.servers import ServersService
from llm_shell.services.ssh_config import SSHConfigEntry, parse_ssh_config

router = APIRouter()


class SSHConfigPreviewOut(BaseModel):
    """SSH config preview response."""

    entries: list[SSHConfigEntry]


class SSHConfigImportRequest(BaseModel):
    """SSH config import request."""

    labels: list[str]


class ImportedServer(BaseModel):
    """Imported server info."""

    label: str
    host: str
    server_id: str


class SSHConfigImportOut(BaseModel):
    """SSH config import response."""

    imported_count: int
    servers: list[ImportedServer]


@router.get("/import/ssh-config/preview", response_model=SSHConfigPreviewOut)
async def preview_ssh_config(
    servers_service: Annotated[ServersService, Depends(get_servers_service)],
    config_path: str = "~/.ssh/config",
) -> SSHConfigPreviewOut:
    """
    Preview SSH config entries.

    Compares with existing servers by host+port+username and marks already_exists.
    """
    entries = parse_ssh_config(config_path)

    # Get existing servers for comparison
    existing_servers = await servers_service.list_all()

    # Create a set of (host, port, username) tuples for quick lookup
    existing_keys = {
        (s.host, s.port, s.username) for s in existing_servers
    }

    # Mark entries that already exist
    for entry in entries:
        key = (entry.host, entry.port, entry.username)
        if key in existing_keys:
            entry.already_exists = True

    return SSHConfigPreviewOut(entries=entries)


@router.post("/import/ssh-config", response_model=SSHConfigImportOut)
async def import_ssh_config(
    request: SSHConfigImportRequest,
    servers_service: Annotated[ServersService, Depends(get_servers_service)],
    keypairs_service: Annotated[KeyPairsService, Depends(get_keypairs_service)],
    config_path: str = "~/.ssh/config",
) -> SSHConfigImportOut:
    """
    Import selected SSH config entries.

    Creates server and keypair records for selected labels.
    Skips entries with already_exists=true.
    Deduplicates identity file paths when creating keypairs.
    """
    # Parse config and get existing servers
    entries = parse_ssh_config(config_path)
    existing_servers = await servers_service.list_all()

    # Create lookup maps
    existing_keys = {
        (s.host, s.port, s.username) for s in existing_servers
    }

    # Mark entries that already exist
    for entry in entries:
        key = (entry.host, entry.port, entry.username)
        if key in existing_keys:
            entry.already_exists = True

    # Filter to selected labels
    selected_labels = set(request.labels)
    entries_by_label = {e.label: e for e in entries}

    # Track identity file paths to keypair IDs for deduplication
    identity_to_keypair: dict[str, str] = {}

    # Get existing keypairs for deduplication
    existing_keypairs = await keypairs_service.list_all()
    for kp in existing_keypairs:
        identity_to_keypair[kp.private_key_path] = kp.id

    imported_servers: list[ImportedServer] = []

    for label in selected_labels:
        entry = entries_by_label.get(label)
        if entry is None:
            continue

        # Skip if already exists
        if entry.already_exists:
            continue

        # Handle identity file / keypair
        key_id: str | None = None
        if entry.identity_file:
            # Check if we already created/found a keypair for this path
            if entry.identity_file in identity_to_keypair:
                key_id = identity_to_keypair[entry.identity_file]
            else:
                # Create new keypair
                keypair = await keypairs_service.create(
                    KeyPairCreate(
                        label=label,
                        private_key_path=entry.identity_file,
                        public_key_path=None,
                    )
                )
                key_id = keypair.id
                identity_to_keypair[entry.identity_file] = key_id

        # Create server
        server = await servers_service.create(
            ServerCreate(
                label=entry.label,
                host=entry.host,
                port=entry.port,
                username=entry.username,
                auth_type=AuthType.KEY if key_id else AuthType.PASSWORD,
                key_id=key_id,
                proxy_jump=entry.proxy_jump,
            )
        )

        imported_servers.append(
            ImportedServer(
                label=server.label,
                host=server.host,
                server_id=server.id,
            )
        )

    return SSHConfigImportOut(
        imported_count=len(imported_servers),
        servers=imported_servers,
    )
