"""Tests for server groups API."""

import pytest
from httpx import Client


class TestServerGroupsAPI:
    """Test server groups CRUD operations."""

    def test_list_groups_empty(self, client: Client) -> None:
        """Test listing groups when empty."""
        response = client.get("/api/groups")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_group(self, client: Client) -> None:
        """Test creating a group."""
        response = client.post(
            "/api/groups",
            json={
                "name": "Production",
                "color": "#FF6B6B",
                "sort_order": 0,
            },
        )
        if response.status_code != 201:
            print(f"Error response: {response.json()}")
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.json()}"
        data = response.json()
        assert data["name"] == "Production"
        assert data["color"] == "#FF6B6B"
        assert data["sort_order"] == 0
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_group_minimal(self, client: Client) -> None:
        """Test creating a group with minimal fields."""
        response = client.post(
            "/api/groups",
            json={"name": "Test Group"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Group"
        assert data["color"] is None
        assert data["sort_order"] == 0

    def test_create_group_invalid_color(self, client: Client) -> None:
        """Test creating a group with invalid color format."""
        response = client.post(
            "/api/groups",
            json={
                "name": "Test",
                "color": "invalid-color",
            },
        )
        assert response.status_code == 422

    def test_list_groups(self, client: Client) -> None:
        """Test listing groups after creation."""
        # Create two groups
        client.post("/api/groups", json={"name": "Group A", "sort_order": 1})
        client.post("/api/groups", json={"name": "Group B", "sort_order": 0})

        response = client.get("/api/groups")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Should be sorted by sort_order
        assert data[0]["name"] == "Group B"
        assert data[1]["name"] == "Group A"

    def test_get_group_not_found(self, client: Client) -> None:
        """Test getting a non-existent group."""
        response = client.get("/api/groups/non-existent-id")
        assert response.status_code == 404
        error = response.json()["detail"]["error"]
        assert error["code"] == "NOT_FOUND"

    def test_update_group(self, client: Client) -> None:
        """Test updating a group."""
        # Create a group
        create_response = client.post(
            "/api/groups",
            json={"name": "Original Name", "color": "#FF0000"},
        )
        group_id = create_response.json()["id"]

        # Update the group
        update_response = client.put(
            f"/api/groups/{group_id}",
            json={"name": "Updated Name", "color": "#00FF00", "sort_order": 5},
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["name"] == "Updated Name"
        assert data["color"] == "#00FF00"
        assert data["sort_order"] == 5

    def test_update_group_not_found(self, client: Client) -> None:
        """Test updating a non-existent group."""
        response = client.put(
            "/api/groups/non-existent-id",
            json={"name": "Updated", "sort_order": 0},
        )
        assert response.status_code == 404

    def test_delete_group(self, client: Client) -> None:
        """Test deleting a group."""
        # Create a group
        create_response = client.post(
            "/api/groups",
            json={"name": "To Delete"},
        )
        group_id = create_response.json()["id"]

        # Delete the group
        delete_response = client.delete(f"/api/groups/{group_id}")
        assert delete_response.status_code == 204

        # Verify it's deleted
        list_response = client.get("/api/groups")
        assert len(list_response.json()) == 0

    def test_delete_group_not_found(self, client: Client) -> None:
        """Test deleting a non-existent group."""
        response = client.delete("/api/groups/non-existent-id")
        assert response.status_code == 404
