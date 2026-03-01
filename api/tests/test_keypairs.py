"""Tests for SSH keypairs API."""

from httpx import Client


class TestKeyPairsAPI:
    """Test SSH keypairs CRUD operations."""

    def test_list_keypairs_empty(self, client: Client) -> None:
        """Test listing keypairs when empty."""
        response = client.get("/api/keypairs")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_keypair(self, client: Client) -> None:
        """Test creating a keypair."""
        response = client.post(
            "/api/keypairs",
            json={
                "label": "Production Key",
                "private_key_path": "/home/user/.ssh/id_rsa",
                "public_key_path": "/home/user/.ssh/id_rsa.pub",
            },
        )
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.json()}"
        data = response.json()
        assert data["label"] == "Production Key"
        assert data["private_key_path"] == "/home/user/.ssh/id_rsa"
        assert data["public_key_path"] == "/home/user/.ssh/id_rsa.pub"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        # passphrase should NOT be in response
        assert "passphrase" not in data

    def test_create_keypair_minimal(self, client: Client) -> None:
        """Test creating a keypair with minimal fields."""
        response = client.post(
            "/api/keypairs",
            json={
                "label": "Test Key",
                "private_key_path": "/home/user/.ssh/test_key",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["label"] == "Test Key"
        assert data["private_key_path"] == "/home/user/.ssh/test_key"
        assert data["public_key_path"] is None

    def test_create_keypair_with_passphrase(self, client: Client) -> None:
        """Test creating a keypair with passphrase (stored in keyring)."""
        response = client.post(
            "/api/keypairs",
            json={
                "label": "Secure Key",
                "private_key_path": "/home/user/.ssh/secure_key",
                "passphrase": "secret123",
            },
        )
        assert response.status_code == 201
        data = response.json()
        # passphrase should NOT be returned in response
        assert "passphrase" not in data

    def test_create_keypair_invalid_label(self, client: Client) -> None:
        """Test creating a keypair with empty label."""
        response = client.post(
            "/api/keypairs",
            json={
                "label": "",
                "private_key_path": "/home/user/.ssh/key",
            },
        )
        assert response.status_code == 422

    def test_list_keypairs(self, client: Client) -> None:
        """Test listing keypairs after creation."""
        # Create two keypairs
        client.post(
            "/api/keypairs",
            json={"label": "Key A", "private_key_path": "/path/a"},
        )
        client.post(
            "/api/keypairs",
            json={"label": "Key B", "private_key_path": "/path/b"},
        )

        response = client.get("/api/keypairs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        labels = [kp["label"] for kp in data]
        assert "Key A" in labels
        assert "Key B" in labels

    def test_get_keypair(self, client: Client) -> None:
        """Test getting a specific keypair."""
        # Create a keypair
        create_response = client.post(
            "/api/keypairs",
            json={
                "label": "My Key",
                "private_key_path": "/home/user/.ssh/my_key",
            },
        )
        keypair_id = create_response.json()["id"]

        # Get the keypair
        response = client.get(f"/api/keypairs/{keypair_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == keypair_id
        assert data["label"] == "My Key"

    def test_get_keypair_not_found(self, client: Client) -> None:
        """Test getting a non-existent keypair."""
        response = client.get("/api/keypairs/non-existent-id")
        assert response.status_code == 404
        error = response.json()["detail"]["error"]
        assert error["code"] == "NOT_FOUND"

    def test_update_keypair(self, client: Client) -> None:
        """Test updating a keypair."""
        # Create a keypair
        create_response = client.post(
            "/api/keypairs",
            json={
                "label": "Original Key",
                "private_key_path": "/original/path",
            },
        )
        keypair_id = create_response.json()["id"]
        original_created_at = create_response.json()["created_at"]

        # Update the keypair
        update_response = client.put(
            f"/api/keypairs/{keypair_id}",
            json={
                "label": "Updated Key",
                "private_key_path": "/updated/path",
                "public_key_path": "/updated/path.pub",
            },
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["label"] == "Updated Key"
        assert data["private_key_path"] == "/updated/path"
        assert data["public_key_path"] == "/updated/path.pub"
        # created_at should remain the same
        assert data["created_at"] == original_created_at
        # updated_at should be different (or at least present)
        assert "updated_at" in data

    def test_update_keypair_not_found(self, client: Client) -> None:
        """Test updating a non-existent keypair."""
        response = client.put(
            "/api/keypairs/non-existent-id",
            json={
                "label": "Updated",
                "private_key_path": "/path",
            },
        )
        assert response.status_code == 404

    def test_delete_keypair(self, client: Client) -> None:
        """Test deleting a keypair."""
        # Create a keypair
        create_response = client.post(
            "/api/keypairs",
            json={"label": "To Delete", "private_key_path": "/path"},
        )
        keypair_id = create_response.json()["id"]

        # Delete the keypair
        delete_response = client.delete(f"/api/keypairs/{keypair_id}")
        assert delete_response.status_code == 204

        # Verify it's deleted
        list_response = client.get("/api/keypairs")
        assert len(list_response.json()) == 0

        # Verify get returns 404
        get_response = client.get(f"/api/keypairs/{keypair_id}")
        assert get_response.status_code == 404

    def test_delete_keypair_not_found(self, client: Client) -> None:
        """Test deleting a non-existent keypair."""
        response = client.delete("/api/keypairs/non-existent-id")
        assert response.status_code == 404
