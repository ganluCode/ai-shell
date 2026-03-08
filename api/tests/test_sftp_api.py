"""Tests for SFTP API endpoints in sessions.py."""

import os
from pathlib import Path
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from llm_shell.db.database import Database
from llm_shell.main import app
from llm_shell.services.session_manager import SessionManager
from llm_shell.services.ssh_session import SSHSession, SSHSessionStatus


@pytest.fixture
def async_mock_download():
    """Create an async mock for download_file."""
    mock = AsyncMock()
    yield mock


@pytest.fixture
def async_mock_upload():
    """Create an async mock for upload_file."""
    mock = AsyncMock()
    yield mock


@pytest.fixture
def mock_session() -> MagicMock:
    """Create a mock SSH session with connection."""
    session = MagicMock(spec=SSHSession)
    session.id = "session-123"
    session.server_id = "server-123"
    session.status = SSHSessionStatus.CONNECTED

    # Mock connection for SFTP operations
    mock_connection = MagicMock()
    session.connection = mock_connection

    return session


@pytest.fixture
def mock_session_manager(mock_session: MagicMock) -> MagicMock:
    """Create a mock session manager."""
    manager = MagicMock(spec=SessionManager)
    manager.get_session = MagicMock(return_value=mock_session)
    manager.get_session_by_server_id = MagicMock(return_value=mock_session)
    return manager


class TestDownloadEndpoint:
    """Tests for GET /sessions/{session_id}/download endpoint."""

    def test_download_returns_file_stream(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
        tmp_path: Path,
    ) -> None:
        """GET /sessions/{session_id}/download should return file stream with application/octet-stream."""
        from llm_shell.api.sessions import get_session_manager

        # Create a test file to download
        test_file = tmp_path / "test_download.txt"
        test_file.write_text("test content for download")

        # Mock download_file to return our test file path
        with patch("llm_shell.services.sftp.download_file") as mock_download:
            mock_download.return_value = str(test_file)

            app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

            try:
                with TestClient(app=app) as client:
                    response = client.get(
                        "/api/sessions/session-123/download",
                        params={"path": "/remote/path/test.txt"},
                    )

                assert response.status_code == 200
                assert response.headers["content-type"] == "application/octet-stream"
                assert response.content == b"test content for download"
            finally:
                app.dependency_overrides.clear()

    def test_download_includes_content_disposition_header(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Download response should include Content-Disposition header."""
        from llm_shell.api.sessions import get_session_manager

        # Create a test file to download
        test_file = tmp_path / "report.pdf"
        test_file.write_bytes(b"pdf content")

        with patch("llm_shell.services.sftp.download_file") as mock_download:
            mock_download.return_value = str(test_file)

            app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

            try:
                with TestClient(app=app) as client:
                    response = client.get(
                        "/api/sessions/session-123/download",
                        params={"path": "/remote/docs/report.pdf"},
                    )

                assert response.status_code == 200
                assert "content-disposition" in response.headers
                assert "attachment" in response.headers["content-disposition"]
                assert "report.pdf" in response.headers["content-disposition"]
            finally:
                app.dependency_overrides.clear()

    def test_download_returns_404_when_session_not_found(
        self,
        mock_session_manager: MagicMock,
    ) -> None:
        """Download should return 404 when session does not exist."""
        from llm_shell.api.sessions import get_session_manager

        # Return None for session lookup
        mock_session_manager.get_session.return_value = None

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                response = client.get(
                    "/api/sessions/nonexistent-session/download",
                    params={"path": "/remote/test.txt"},
                )

            assert response.status_code == 404
            data = response.json()
            assert data["detail"]["error"]["code"] == "NOT_FOUND"
        finally:
            app.dependency_overrides.clear()

    def test_download_requires_path_parameter(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
    ) -> None:
        """Download should require path query parameter."""
        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                response = client.get("/api/sessions/session-123/download")

            assert response.status_code == 422  # Validation error
        finally:
            app.dependency_overrides.clear()


class TestUploadEndpoint:
    """Tests for POST /sessions/{session_id}/upload endpoint."""

    def test_upload_accepts_multipart_form_data(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
        tmp_path: Path,
    ) -> None:
        """POST /sessions/{session_id}/upload should accept multipart/form-data."""
        from llm_shell.api.sessions import get_session_manager

        # Create a test file to upload
        test_file = tmp_path / "upload_test.txt"
        test_file.write_text("content to upload")

        with patch("llm_shell.services.sftp.upload_file") as mock_upload:
            mock_upload.return_value = {
                "remote_path": "/remote/path/upload_test.txt",
                "size": 17,
            }

            app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

            try:
                with TestClient(app=app) as client:
                    with open(test_file, "rb") as f:
                        response = client.post(
                            "/api/sessions/session-123/upload",
                            params={"path": "/remote/path/upload_test.txt"},
                            files={"file": ("upload_test.txt", f, "text/plain")},
                        )

                assert response.status_code == 200
                data = response.json()
                assert "remote_path" in data
                assert "size" in data
            finally:
                app.dependency_overrides.clear()

    def test_upload_returns_remote_path_and_size(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Upload should return {remote_path, size} JSON response."""
        from llm_shell.api.sessions import get_session_manager

        # Create a test file to upload
        test_file = tmp_path / "data.csv"
        test_file.write_text("col1,col2\n1,2\n3,4\n")

        expected_size = test_file.stat().st_size

        with patch("llm_shell.services.sftp.upload_file") as mock_upload:
            mock_upload.return_value = {
                "remote_path": "/remote/data/data.csv",
                "size": expected_size,
            }

            app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

            try:
                with TestClient(app=app) as client:
                    with open(test_file, "rb") as f:
                        response = client.post(
                            "/api/sessions/session-123/upload",
                            params={"path": "/remote/data/data.csv"},
                            files={"file": ("data.csv", f, "text/csv")},
                        )

                assert response.status_code == 200
                data = response.json()
                assert data["remote_path"] == "/remote/data/data.csv"
                assert data["size"] == expected_size
            finally:
                app.dependency_overrides.clear()

    def test_upload_returns_404_when_session_not_found(
        self,
        mock_session_manager: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Upload should return 404 when session does not exist."""
        from llm_shell.api.sessions import get_session_manager

        # Return None for session lookup
        mock_session_manager.get_session.return_value = None

        # Create a test file to upload
        test_file = tmp_path / "test.txt"
        test_file.write_text("test")

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                with open(test_file, "rb") as f:
                    response = client.post(
                        "/api/sessions/nonexistent-session/upload",
                        params={"path": "/remote/test.txt"},
                        files={"file": ("test.txt", f, "text/plain")},
                    )

            assert response.status_code == 404
            data = response.json()
            assert data["detail"]["error"]["code"] == "NOT_FOUND"
        finally:
            app.dependency_overrides.clear()

    def test_upload_requires_path_parameter(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Upload should require path query parameter."""
        from llm_shell.api.sessions import get_session_manager

        test_file = tmp_path / "test.txt"
        test_file.write_text("test")

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                with open(test_file, "rb") as f:
                    response = client.post(
                        "/api/sessions/session-123/upload",
                        files={"file": ("test.txt", f, "text/plain")},
                    )

            assert response.status_code == 422  # Validation error
        finally:
            app.dependency_overrides.clear()

    def test_upload_requires_file_in_form_data(
        self,
        mock_session: MagicMock,
        mock_session_manager: MagicMock,
    ) -> None:
        """Upload should require file in multipart form data."""
        from llm_shell.api.sessions import get_session_manager

        app.dependency_overrides[get_session_manager] = lambda: mock_session_manager

        try:
            with TestClient(app=app) as client:
                response = client.post(
                    "/api/sessions/session-123/upload",
                    params={"path": "/remote/test.txt"},
                    data={},  # No file provided
                )

            assert response.status_code == 422  # Validation error
        finally:
            app.dependency_overrides.clear()
