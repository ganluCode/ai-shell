"""Tests for SSH Config Import API."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from llm_shell.main import app
from llm_shell.services.keypairs import KeyPairsService
from llm_shell.services.servers import ServersService
from llm_shell.services.ssh_config import SSHConfigEntry


@pytest.fixture
def mock_parse_ssh_config() -> MagicMock:
    """Mock parse_ssh_config function."""
    with patch("llm_shell.api.import_config.parse_ssh_config") as mock:
        yield mock


@pytest.fixture
def mock_servers_service(client: TestClient) -> MagicMock:
    """Get mock servers service from dependency override."""
    from llm_shell.api.servers import get_servers_service

    service = MagicMock(spec=ServersService)
    service.list_all = AsyncMock(return_value=[])
    service.create = AsyncMock()
    app.dependency_overrides[get_servers_service] = lambda: service
    yield service
    app.dependency_overrides.pop(get_servers_service, None)


@pytest.fixture
def mock_keypairs_service(client: TestClient) -> MagicMock:
    """Get mock keypairs service from dependency override."""
    from llm_shell.api.import_config import get_keypairs_service

    service = MagicMock(spec=KeyPairsService)
    service.list_all = AsyncMock(return_value=[])
    service.create = AsyncMock()
    app.dependency_overrides[get_keypairs_service] = lambda: service
    yield service
    app.dependency_overrides.pop(get_keypairs_service, None)


class TestSSHConfigPreview:
    """Test GET /api/import/ssh-config/preview endpoint."""

    def test_preview_returns_correct_list(
        self,
        client: TestClient,
        mock_parse_ssh_config: MagicMock,
        mock_servers_service: MagicMock,
    ) -> None:
        """Test preview returns list of SSHConfigEntry objects."""
        mock_parse_ssh_config.return_value = [
            SSHConfigEntry(
                label="prod-web-01",
                host="192.168.1.100",
                username="root",
                port=2222,
                identity_file="/home/user/.ssh/prod_key",
                proxy_jump="bastion",
            ),
            SSHConfigEntry(
                label="staging-app",
                host="10.0.0.5",
                username="deploy",
                port=22,
                identity_file="/home/user/.ssh/staging_key",
            ),
        ]
        mock_servers_service.list_all.return_value = []

        response = client.get("/api/import/ssh-config/preview")

        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert len(data["entries"]) == 2

        # Verify first entry
        entry1 = data["entries"][0]
        assert entry1["label"] == "prod-web-01"
        assert entry1["host"] == "192.168.1.100"
        assert entry1["username"] == "root"
        assert entry1["port"] == 2222
        assert entry1["identity_file"] == "/home/user/.ssh/prod_key"
        assert entry1["proxy_jump"] == "bastion"
        assert entry1["already_exists"] is False

        # Verify second entry
        entry2 = data["entries"][1]
        assert entry2["label"] == "staging-app"
        assert entry2["host"] == "10.0.0.5"
        assert entry2["username"] == "deploy"
        assert entry2["port"] == 22

    def test_preview_marks_already_exists_for_matching_servers(
        self,
        client: TestClient,
        mock_parse_ssh_config: MagicMock,
        mock_servers_service: MagicMock,
    ) -> None:
        """Test preview compares with existing servers by host+port+username."""
        from llm_shell.models.common import AuthType
        from llm_shell.models.servers import ServerOut

        # Create a mock existing server
        existing_server = ServerOut(
            id="existing-id",
            group_id=None,
            label="existing-label",
            host="192.168.1.100",
            port=2222,
            username="root",
            auth_type=AuthType.KEY,
            key_id="key-id",
            created_at="2024-01-01T00:00:00",
            updated_at="2024-01-01T00:00:00",
        )
        mock_servers_service.list_all.return_value = [existing_server]

        mock_parse_ssh_config.return_value = [
            SSHConfigEntry(
                label="prod-web-01",
                host="192.168.1.100",
                username="root",
                port=2222,
                identity_file="/home/user/.ssh/prod_key",
            ),
            SSHConfigEntry(
                label="different-server",
                host="10.0.0.5",
                username="deploy",
                port=22,
            ),
        ]

        response = client.get("/api/import/ssh-config/preview")

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 2

        # First entry should be marked as already existing
        assert data["entries"][0]["already_exists"] is True
        # Second entry should not be marked
        assert data["entries"][1]["already_exists"] is False


class TestSSHConfigImport:
    """Test POST /api/import/ssh-config endpoint."""

    def test_import_creates_server_and_keypair_records(
        self,
        client: TestClient,
        mock_parse_ssh_config: MagicMock,
        mock_servers_service: MagicMock,
        mock_keypairs_service: MagicMock,
    ) -> None:
        """Test import creates server and keypair records."""
        from llm_shell.models.common import AuthType
        from llm_shell.models.keypairs import KeyPairOut

        mock_parse_ssh_config.return_value = [
            SSHConfigEntry(
                label="prod-web-01",
                host="192.168.1.100",
                username="root",
                port=2222,
                identity_file="/home/user/.ssh/prod_key",
            ),
        ]
        mock_servers_service.list_all.return_value = []

        # Mock keypair creation
        mock_keypair = KeyPairOut(
            id="new-keypair-id",
            label="prod-web-01",
            private_key_path="/home/user/.ssh/prod_key",
            created_at="2024-01-01T00:00:00",
            updated_at="2024-01-01T00:00:00",
        )
        mock_keypairs_service.create.return_value = mock_keypair

        # Mock server creation
        mock_servers_service.create.return_value = MagicMock(
            id="new-server-id",
            label="prod-web-01",
            host="192.168.1.100",
            port=2222,
            username="root",
        )

        response = client.post(
            "/api/import/ssh-config",
            json={"labels": ["prod-web-01"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert "imported_count" in data
        assert data["imported_count"] == 1
        assert "servers" in data

        # Verify keypair was created
        mock_keypairs_service.create.assert_called_once()

        # Verify server was created
        mock_servers_service.create.assert_called_once()
        call_args = mock_servers_service.create.call_args
        assert call_args is not None

    def test_import_skips_already_existing_entries(
        self,
        client: TestClient,
        mock_parse_ssh_config: MagicMock,
        mock_servers_service: MagicMock,
        mock_keypairs_service: MagicMock,
    ) -> None:
        """Test entries with already_exists=true are skipped during import."""
        from llm_shell.models.common import AuthType
        from llm_shell.models.keypairs import KeyPairOut
        from llm_shell.models.servers import ServerOut

        # Create a mock existing server
        existing_server = ServerOut(
            id="existing-id",
            group_id=None,
            label="existing-label",
            host="192.168.1.100",
            port=2222,
            username="root",
            auth_type=AuthType.KEY,
            key_id="key-id",
            created_at="2024-01-01T00:00:00",
            updated_at="2024-01-01T00:00:00",
        )
        mock_servers_service.list_all.return_value = [existing_server]

        mock_parse_ssh_config.return_value = [
            SSHConfigEntry(
                label="prod-web-01",
                host="192.168.1.100",
                username="root",
                port=2222,
                identity_file="/home/user/.ssh/prod_key",
                already_exists=True,
            ),
            SSHConfigEntry(
                label="new-server",
                host="10.0.0.5",
                username="deploy",
                port=22,
                identity_file="/home/user/.ssh/new_key",
            ),
        ]

        # Mock keypair creation for new-server's identity file
        mock_keypairs_service.create.return_value = KeyPairOut(
            id="new-keypair-id",
            label="new-server",
            private_key_path="/home/user/.ssh/new_key",
            created_at="2024-01-01T00:00:00",
            updated_at="2024-01-01T00:00:00",
        )

        # Mock server creation
        mock_servers_service.create.return_value = MagicMock(
            id="new-server-id",
            label="new-server",
            host="10.0.0.5",
        )

        response = client.post(
            "/api/import/ssh-config",
            json={"labels": ["prod-web-01", "new-server"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["imported_count"] == 1  # Only new-server should be imported

        # Verify only one server was created (the non-existing one)
        mock_servers_service.create.assert_called_once()

    def test_import_deduplicates_identity_file_paths(
        self,
        client: TestClient,
        mock_parse_ssh_config: MagicMock,
        mock_servers_service: MagicMock,
        mock_keypairs_service: MagicMock,
    ) -> None:
        """Test duplicate identity_file paths are deduplicated when creating keypairs."""
        from llm_shell.models.keypairs import KeyPairOut

        # Two entries with same identity file
        mock_parse_ssh_config.return_value = [
            SSHConfigEntry(
                label="server-1",
                host="192.168.1.100",
                username="root",
                port=22,
                identity_file="/home/user/.ssh/shared_key",
            ),
            SSHConfigEntry(
                label="server-2",
                host="192.168.1.101",
                username="root",
                port=22,
                identity_file="/home/user/.ssh/shared_key",  # Same path
            ),
        ]
        mock_servers_service.list_all.return_value = []

        mock_keypair = KeyPairOut(
            id="shared-keypair-id",
            label="shared_key",
            private_key_path="/home/user/.ssh/shared_key",
            created_at="2024-01-01T00:00:00",
            updated_at="2024-01-01T00:00:00",
        )
        mock_keypairs_service.create.return_value = mock_keypair
        mock_keypairs_service.list_all.return_value = []

        call_count = [0]
        def make_server(*args, **kwargs):
            call_count[0] += 1
            return MagicMock(
                id=f"server-id-{call_count[0]}",
                label=f"server-{call_count[0]}",
                host=f"192.168.1.{99 + call_count[0]}",
            )
        mock_servers_service.create.side_effect = make_server

        response = client.post(
            "/api/import/ssh-config",
            json={"labels": ["server-1", "server-2"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["imported_count"] == 2

        # KeyPair should only be created once for duplicate paths
        assert mock_keypairs_service.create.call_count == 1

    def test_import_without_identity_file(
        self,
        client: TestClient,
        mock_parse_ssh_config: MagicMock,
        mock_servers_service: MagicMock,
        mock_keypairs_service: MagicMock,
    ) -> None:
        """Test import handles entries without identity file."""
        mock_parse_ssh_config.return_value = [
            SSHConfigEntry(
                label="password-server",
                host="192.168.1.100",
                username="root",
                port=22,
                identity_file=None,
            ),
        ]
        mock_servers_service.list_all.return_value = []
        mock_servers_service.create.return_value = MagicMock(
            id="server-id",
            label="password-server",
            host="192.168.1.100",
        )

        response = client.post(
            "/api/import/ssh-config",
            json={"labels": ["password-server"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["imported_count"] == 1

        # No keypair should be created when there's no identity file
        mock_keypairs_service.create.assert_not_called()
