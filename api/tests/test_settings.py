"""Tests for settings API."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


class TestSettingsAPI:
    """Tests for settings API endpoints."""

    def test_get_settings_returns_200_with_default_values(
        self, client: TestClient
    ) -> None:
        """GET /api/settings returns 200 with default values."""
        response = client.get("/api/settings")

        assert response.status_code == 200
        data = response.json()

        # Verify all expected fields are present
        assert "model" in data
        assert "terminal_font" in data
        assert "terminal_size" in data
        assert "theme" in data
        assert "output_buffer" in data
        assert "context_lines" in data
        assert "max_chat_rounds" in data
        assert "api_key" in data

    def test_get_settings_returns_correct_defaults(
        self, client: TestClient
    ) -> None:
        """GET /api/settings returns correct default values."""
        response = client.get("/api/settings")

        assert response.status_code == 200
        data = response.json()

        # Verify default values
        assert data["model"] == "claude-sonnet-4-20250514"
        assert data["terminal_font"] == "Monaco"
        assert data["terminal_size"] == "14"
        assert data["theme"] == "dark"
        assert data["output_buffer"] == "1000"
        assert data["context_lines"] == "50"
        assert data["max_chat_rounds"] == "10"

    @patch("llm_shell.services.settings.get_secret")
    def test_api_key_masked_returns_sk_xxx_format(
        self, mock_get_secret: MagicMock, client: TestClient
    ) -> None:
        """api_key field returns 'sk-***abcd' format when keyring has value."""
        # Set up mock to return a long API key
        mock_get_secret.return_value = "sk-ant-api03-xxxxxxxxxxxxabcd"

        response = client.get("/api/settings")

        assert response.status_code == 200
        data = response.json()

        # Should return masked format: first 3 chars + *** + last 4 chars
        assert data["api_key"] == "sk-***abcd"
        mock_get_secret.assert_called_once_with("api_key")

    @patch("llm_shell.services.settings.get_secret")
    def test_api_key_returns_empty_string_when_keyring_empty(
        self, mock_get_secret: MagicMock, client: TestClient
    ) -> None:
        """api_key field returns '' when keyring is empty."""
        # Set up mock to return None (no API key stored)
        mock_get_secret.return_value = None

        response = client.get("/api/settings")

        assert response.status_code == 200
        data = response.json()

        assert data["api_key"] == ""
        mock_get_secret.assert_called_once_with("api_key")

    @patch("llm_shell.services.settings.get_secret")
    def test_api_key_masks_short_key(
        self, mock_get_secret: MagicMock, client: TestClient
    ) -> None:
        """api_key field handles short keys gracefully."""
        # Set up mock to return a short API key (less than 7 chars)
        mock_get_secret.return_value = "sk-abc"

        response = client.get("/api/settings")

        assert response.status_code == 200
        data = response.json()

        # Short key should still be masked but with limited chars shown
        # For keys <= 7 chars: show first 3 + *** + last 4 (or just ***)
        assert "***" in data["api_key"]
