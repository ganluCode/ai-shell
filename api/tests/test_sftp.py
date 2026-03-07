"""Tests for SFTP service."""

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from llm_shell.services.sftp import download_file, upload_file


class TestDownloadFile:
    """Test download_file function."""

    @pytest.mark.asyncio
    async def test_download_file_succeeds(self, tmp_path: Path) -> None:
        """download_file should create SFTP client and download to temp directory."""
        # Mock connection and SFTP client
        mock_sftp = AsyncMock()
        mock_sftp.get = AsyncMock()

        mock_conn = MagicMock()
        mock_conn.start_sftp_client = AsyncMock(return_value=mock_sftp)

        # Mock tempfile to use tmp_path
        with patch("llm_shell.services.sftp.tempfile.mkdtemp") as mock_mkdtemp:
            mock_mkdtemp.return_value = str(tmp_path)

            result = await download_file(mock_conn, "/remote/path/file.txt")

        # Verify SFTP client was created
        mock_conn.start_sftp_client.assert_called_once()

        # Verify file was downloaded to local temp directory
        expected_local_path = str(tmp_path / "file.txt")
        mock_sftp.get.assert_called_once_with("/remote/path/file.txt", expected_local_path)

        # Verify return value is local path
        assert result == expected_local_path

    @pytest.mark.asyncio
    async def test_download_file_handles_file_not_found(self, tmp_path: Path) -> None:
        """download_file should handle file not found error."""
        import asyncssh

        # Mock connection and SFTP client
        mock_sftp = AsyncMock()
        mock_sftp.get = AsyncMock(side_effect=asyncssh.SFTPError("No such file", 2))

        mock_conn = MagicMock()
        mock_conn.start_sftp_client = AsyncMock(return_value=mock_sftp)

        with patch("llm_shell.services.sftp.tempfile.mkdtemp") as mock_mkdtemp:
            mock_mkdtemp.return_value = str(tmp_path)

            with pytest.raises(asyncssh.SFTPError):
                await download_file(mock_conn, "/remote/path/nonexistent.txt")

    @pytest.mark.asyncio
    async def test_download_file_closes_sftp_client(self, tmp_path: Path) -> None:
        """download_file should close SFTP client after download."""
        mock_sftp = AsyncMock()
        mock_sftp.get = AsyncMock()
        mock_sftp.exit = AsyncMock()

        mock_conn = MagicMock()
        mock_conn.start_sftp_client = AsyncMock(return_value=mock_sftp)

        with patch("llm_shell.services.sftp.tempfile.mkdtemp") as mock_mkdtemp:
            mock_mkdtemp.return_value = str(tmp_path)

            await download_file(mock_conn, "/remote/path/file.txt")

        mock_sftp.exit.assert_called_once()


class TestUploadFile:
    """Test upload_file function."""

    @pytest.mark.asyncio
    async def test_upload_file_succeeds(self, tmp_path: Path) -> None:
        """upload_file should create SFTP client and upload file."""
        # Create a local test file
        local_file = tmp_path / "test_file.txt"
        local_file.write_text("test content")
        file_size = local_file.stat().st_size

        # Mock connection and SFTP client
        mock_sftp = AsyncMock()
        mock_sftp.put = AsyncMock()

        mock_conn = MagicMock()
        mock_conn.start_sftp_client = AsyncMock(return_value=mock_sftp)

        result = await upload_file(mock_conn, str(local_file), "/remote/path/test_file.txt")

        # Verify SFTP client was created
        mock_conn.start_sftp_client.assert_called_once()

        # Verify file was uploaded
        mock_sftp.put.assert_called_once_with(str(local_file), "/remote/path/test_file.txt")

        # Verify return value
        assert result["remote_path"] == "/remote/path/test_file.txt"
        assert result["size"] == file_size

    @pytest.mark.asyncio
    async def test_upload_file_handles_permission_denied(self, tmp_path: Path) -> None:
        """upload_file should handle permission denied error."""
        import asyncssh

        # Create a local test file
        local_file = tmp_path / "test_file.txt"
        local_file.write_text("test content")

        # Mock connection and SFTP client
        mock_sftp = AsyncMock()
        mock_sftp.put = AsyncMock(side_effect=asyncssh.SFTPError("Permission denied", 3))

        mock_conn = MagicMock()
        mock_conn.start_sftp_client = AsyncMock(return_value=mock_sftp)

        with pytest.raises(asyncssh.SFTPError):
            await upload_file(mock_conn, str(local_file), "/remote/readonly/test.txt")

    @pytest.mark.asyncio
    async def test_upload_file_closes_sftp_client(self, tmp_path: Path) -> None:
        """upload_file should close SFTP client after upload."""
        # Create a local test file
        local_file = tmp_path / "test_file.txt"
        local_file.write_text("test content")

        # Mock connection and SFTP client
        mock_sftp = AsyncMock()
        mock_sftp.put = AsyncMock()
        mock_sftp.exit = AsyncMock()

        mock_conn = MagicMock()
        mock_conn.start_sftp_client = AsyncMock(return_value=mock_sftp)

        await upload_file(mock_conn, str(local_file), "/remote/path/test_file.txt")

        mock_sftp.exit.assert_called_once()
