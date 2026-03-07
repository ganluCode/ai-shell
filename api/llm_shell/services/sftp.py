"""SFTP service for file transfer operations."""

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


async def download_file(conn: Any, remote_path: str) -> str:
    """Download a file from remote server via SFTP.

    Args:
        conn: An asyncssh SSHClientConnection.
        remote_path: Path to the remote file to download.

    Returns:
        Local path to the downloaded file.

    Raises:
        asyncssh.SFTPError: If the file cannot be downloaded.
    """
    # Create SFTP client
    sftp = await conn.start_sftp_client()

    try:
        # Create temp directory for downloads
        temp_dir = tempfile.mkdtemp(prefix="llmshell_sftp_")

        # Extract filename from remote path
        filename = os.path.basename(remote_path)
        local_path = os.path.join(temp_dir, filename)

        # Download file
        await sftp.get(remote_path, local_path)

        logger.info(f"Downloaded {remote_path} to {local_path}")
        return local_path
    finally:
        await sftp.exit()


async def upload_file(conn: Any, local_path: str, remote_path: str) -> dict[str, Any]:
    """Upload a file to remote server via SFTP.

    Args:
        conn: An asyncssh SSHClientConnection.
        local_path: Path to the local file to upload.
        remote_path: Destination path on the remote server.

    Returns:
        Dictionary with remote_path and size of uploaded file.

    Raises:
        asyncssh.SFTPError: If the file cannot be uploaded.
    """
    # Create SFTP client
    sftp = await conn.start_sftp_client()

    try:
        # Get local file size
        file_size = Path(local_path).stat().st_size

        # Upload file
        await sftp.put(local_path, remote_path)

        logger.info(f"Uploaded {local_path} to {remote_path} ({file_size} bytes)")

        return {
            "remote_path": remote_path,
            "size": file_size,
        }
    finally:
        await sftp.exit()
