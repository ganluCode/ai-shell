"""Tests for servers API."""

from httpx import Client


class TestServersAPI:
    """Test servers CRUD operations."""

    def test_list_servers_empty(self, client: Client) -> None:
        """Test listing servers when empty."""
        response = client.get("/api/servers")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_server_with_password(self, client: Client) -> None:
        """Test creating a server with password auth."""
        response = client.post(
            "/api/servers",
            json={
                "label": "Test Server",
                "host": "example.com",
                "port": 22,
                "username": "testuser",
                "auth_type": "password",
                "password": "secret123",
                "sort_order": 0,
            },
        )
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.json()}"
        data = response.json()
        assert data["label"] == "Test Server"
        assert data["host"] == "example.com"
        assert data["port"] == 22
        assert data["username"] == "testuser"
        assert data["auth_type"] == "password"
        assert data["sort_order"] == 0
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        # password should NOT be in response
        assert "password" not in data

    def test_create_server_with_key(self, client: Client) -> None:
        """Test creating a server with key auth."""
        # First create a keypair
        keypair_response = client.post(
            "/api/keypairs",
            json={
                "label": "Test Key",
                "private_key_path": "/home/user/.ssh/id_rsa",
            },
        )
        keypair_id = keypair_response.json()["id"]

        # Create server with key auth
        response = client.post(
            "/api/servers",
            json={
                "label": "Key Server",
                "host": "keyserver.com",
                "username": "keyuser",
                "auth_type": "key",
                "key_id": keypair_id,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["auth_type"] == "key"
        assert data["key_id"] == keypair_id

    def test_create_server_with_group(self, client: Client) -> None:
        """Test creating a server in a group."""
        # Create a group first
        group_response = client.post(
            "/api/groups",
            json={"name": "Production"},
        )
        group_id = group_response.json()["id"]

        # Create server in group
        response = client.post(
            "/api/servers",
            json={
                "label": "Prod Server",
                "host": "prod.example.com",
                "username": "produser",
                "auth_type": "password",
                "password": "prodpass",
                "group_id": group_id,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["group_id"] == group_id

    def test_create_server_invalid_group(self, client: Client) -> None:
        """Test creating a server with non-existent group fails."""
        response = client.post(
            "/api/servers",
            json={
                "label": "Test Server",
                "host": "example.com",
                "username": "testuser",
                "auth_type": "password",
                "password": "secret",
                "group_id": "non-existent-group-id",
            },
        )
        assert response.status_code == 422

    def test_create_server_invalid_key(self, client: Client) -> None:
        """Test creating a server with non-existent key fails."""
        response = client.post(
            "/api/servers",
            json={
                "label": "Test Server",
                "host": "example.com",
                "username": "testuser",
                "auth_type": "key",
                "key_id": "non-existent-key-id",
            },
        )
        assert response.status_code == 422

    def test_create_server_invalid_port(self, client: Client) -> None:
        """Test creating a server with invalid port fails."""
        response = client.post(
            "/api/servers",
            json={
                "label": "Test Server",
                "host": "example.com",
                "port": 99999,  # Invalid port
                "username": "testuser",
                "auth_type": "password",
                "password": "secret",
            },
        )
        assert response.status_code == 422

    def test_list_servers_sorted_by_sort_order(self, client: Client) -> None:
        """Test listing servers sorted by sort_order."""
        # Create servers with different sort_order
        client.post(
            "/api/servers",
            json={
                "label": "Server A",
                "host": "server-a.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
                "sort_order": 2,
            },
        )
        client.post(
            "/api/servers",
            json={
                "label": "Server B",
                "host": "server-b.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
                "sort_order": 0,
            },
        )
        client.post(
            "/api/servers",
            json={
                "label": "Server C",
                "host": "server-c.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
                "sort_order": 1,
            },
        )

        response = client.get("/api/servers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Should be sorted by sort_order
        assert data[0]["label"] == "Server B"  # sort_order 0
        assert data[1]["label"] == "Server C"  # sort_order 1
        assert data[2]["label"] == "Server A"  # sort_order 2

    def test_list_servers_filter_by_group(self, client: Client) -> None:
        """Test listing servers filtered by group_id."""
        # Create groups
        group_a = client.post("/api/groups", json={"name": "Group A"}).json()["id"]
        group_b = client.post("/api/groups", json={"name": "Group B"}).json()["id"]

        # Create servers in different groups
        client.post(
            "/api/servers",
            json={
                "label": "Server in A",
                "host": "server-a.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
                "group_id": group_a,
            },
        )
        client.post(
            "/api/servers",
            json={
                "label": "Server in B",
                "host": "server-b.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
                "group_id": group_b,
            },
        )
        client.post(
            "/api/servers",
            json={
                "label": "Server no group",
                "host": "server-none.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
                "group_id": None,
            },
        )

        # Filter by group_a
        response = client.get(f"/api/servers?group_id={group_a}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["label"] == "Server in A"

        # Filter by group_b
        response = client.get(f"/api/servers?group_id={group_b}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["label"] == "Server in B"

    def test_get_server(self, client: Client) -> None:
        """Test getting a specific server."""
        # Create a server
        create_response = client.post(
            "/api/servers",
            json={
                "label": "My Server",
                "host": "myserver.com",
                "username": "myuser",
                "auth_type": "password",
                "password": "mypass",
            },
        )
        server_id = create_response.json()["id"]

        # Get the server
        response = client.get(f"/api/servers/{server_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == server_id
        assert data["label"] == "My Server"
        assert data["host"] == "myserver.com"

    def test_get_server_not_found(self, client: Client) -> None:
        """Test getting a non-existent server."""
        response = client.get("/api/servers/non-existent-id")
        assert response.status_code == 404
        error = response.json()["detail"]["error"]
        assert error["code"] == "NOT_FOUND"

    def test_update_server(self, client: Client) -> None:
        """Test updating a server."""
        # Create a server
        create_response = client.post(
            "/api/servers",
            json={
                "label": "Original Server",
                "host": "original.com",
                "username": "origuser",
                "auth_type": "password",
                "password": "origpass",
            },
        )
        server_id = create_response.json()["id"]
        original_created_at = create_response.json()["created_at"]

        # Update the server
        update_response = client.put(
            f"/api/servers/{server_id}",
            json={
                "label": "Updated Server",
                "host": "updated.com",
                "port": 2222,
                "username": "newuser",
                "auth_type": "password",
                "password": "newpass",
                "sort_order": 10,
            },
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["label"] == "Updated Server"
        assert data["host"] == "updated.com"
        assert data["port"] == 2222
        assert data["username"] == "newuser"
        assert data["sort_order"] == 10
        # created_at should remain the same
        assert data["created_at"] == original_created_at
        # updated_at should be present
        assert "updated_at" in data

    def test_update_server_not_found(self, client: Client) -> None:
        """Test updating a non-existent server."""
        response = client.put(
            "/api/servers/non-existent-id",
            json={
                "label": "Updated",
                "host": "updated.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
            },
        )
        assert response.status_code == 404

    def test_delete_server(self, client: Client) -> None:
        """Test deleting a server."""
        # Create a server
        create_response = client.post(
            "/api/servers",
            json={
                "label": "To Delete",
                "host": "delete.com",
                "username": "user",
                "auth_type": "password",
                "password": "pass",
            },
        )
        server_id = create_response.json()["id"]

        # Delete the server
        delete_response = client.delete(f"/api/servers/{server_id}")
        assert delete_response.status_code == 204

        # Verify it's deleted
        list_response = client.get("/api/servers")
        assert len(list_response.json()) == 0

        # Verify get returns 404
        get_response = client.get(f"/api/servers/{server_id}")
        assert get_response.status_code == 404

    def test_delete_server_not_found(self, client: Client) -> None:
        """Test deleting a non-existent server."""
        response = client.delete("/api/servers/non-existent-id")
        assert response.status_code == 404
