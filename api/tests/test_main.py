"""Tests for main.py router registration."""

import pytest
from fastapi.testclient import TestClient

from llm_shell.main import app


class TestRouterRegistration:
    """Test that all routers are registered correctly."""

    def test_groups_routes_under_api_prefix(self, client: TestClient) -> None:
        """Test that group routes are accessible under /api prefix."""
        # GET /api/groups should work
        response = client.get("/api/groups")
        assert response.status_code == 200

        # POST /api/groups should work
        response = client.post("/api/groups", json={"name": "Test"})
        assert response.status_code == 201

    def test_keypairs_routes_under_api_prefix(self, client: TestClient) -> None:
        """Test that keypair routes are accessible under /api prefix."""
        # GET /api/keypairs should work
        response = client.get("/api/keypairs")
        assert response.status_code == 200

        # POST /api/keypairs should work
        response = client.post(
            "/api/keypairs",
            json={
                "label": "Test Key",
                "private_key_path": "/home/user/.ssh/test_key",
            },
        )
        assert response.status_code == 201

    def test_servers_routes_under_api_prefix(self, client: TestClient) -> None:
        """Test that server routes are accessible under /api prefix."""
        # GET /api/servers should work
        response = client.get("/api/servers")
        assert response.status_code == 200

        # POST /api/servers should work
        response = client.post(
            "/api/servers",
            json={
                "label": "Test Server",
                "host": "192.168.1.1",
                "port": 22,
                "username": "root",
                "auth_type": "password",
                "password": "test",
            },
        )
        assert response.status_code == 201

    def test_command_log_routes_under_api_prefix(self, client: TestClient) -> None:
        """Test that command log routes are accessible under /api prefix."""
        # Create a server first
        server_response = client.post(
            "/api/servers",
            json={
                "label": "Test Server",
                "host": "192.168.1.1",
                "port": 22,
                "username": "root",
                "auth_type": "password",
                "password": "test",
            },
        )
        server_id = server_response.json()["id"]

        # GET /api/servers/{server_id}/commands should work
        response = client.get(f"/api/servers/{server_id}/commands")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_health_check_no_prefix(self, client: TestClient) -> None:
        """Test that health check is accessible without /api prefix."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_routes_without_api_prefix_return_404(self, client: TestClient) -> None:
        """Test that routes without /api prefix return 404."""
        # /groups without /api prefix should return 404
        response = client.get("/groups")
        assert response.status_code == 404

        # /servers without /api prefix should return 404
        response = client.get("/servers")
        assert response.status_code == 404
