"""Tests for security service (keyring operations)."""

from unittest.mock import MagicMock, patch


class TestKeyringOperations:
    """Tests for keyring store/get/delete operations."""

    @patch("llm_shell.services.security.keyring.set_password")
    def test_store_secret_returns_true(self, mock_set_password: MagicMock) -> None:
        """store_secret('api_key', 'sk-xxx') returns True."""
        from llm_shell.services.security import store_secret

        result = store_secret("api_key", "sk-xxx")
        assert result is True
        mock_set_password.assert_called_once_with("llm-shell", "api_key", "sk-xxx")

    @patch("llm_shell.services.security.keyring.set_password")
    def test_store_secret_passphrase_pattern(
        self, mock_set_password: MagicMock
    ) -> None:
        """store_secret with passphrase:{keypair_id} pattern."""
        from llm_shell.services.security import store_secret

        result = store_secret("passphrase:uuid-1234", "my-passphrase")
        assert result is True
        mock_set_password.assert_called_once_with(
            "llm-shell", "passphrase:uuid-1234", "my-passphrase"
        )

    @patch("llm_shell.services.security.keyring.set_password")
    def test_store_secret_password_pattern(
        self, mock_set_password: MagicMock
    ) -> None:
        """store_secret with password:{server_id} pattern."""
        from llm_shell.services.security import store_secret

        result = store_secret("password:server-5678", "my-password")
        assert result is True
        mock_set_password.assert_called_once_with(
            "llm-shell", "password:server-5678", "my-password"
        )

    @patch("llm_shell.services.security.keyring.get_password")
    def test_get_secret_returns_value(self, mock_get_password: MagicMock) -> None:
        """get_secret('api_key') returns 'sk-xxx'."""
        from llm_shell.services.security import get_secret

        mock_get_password.return_value = "sk-xxx"
        result = get_secret("api_key")
        assert result == "sk-xxx"
        mock_get_password.assert_called_once_with("llm-shell", "api_key")

    @patch("llm_shell.services.security.keyring.get_password")
    def test_get_secret_nonexistent_returns_none(
        self, mock_get_password: MagicMock
    ) -> None:
        """get_secret('nonexistent') returns None."""
        from llm_shell.services.security import get_secret

        mock_get_password.return_value = None
        result = get_secret("nonexistent")
        assert result is None
        mock_get_password.assert_called_once_with("llm-shell", "nonexistent")

    @patch("llm_shell.services.security.keyring.delete_password")
    def test_delete_secret_returns_true(self, mock_delete_password: MagicMock) -> None:
        """delete_secret('api_key') returns True."""
        from llm_shell.services.security import delete_secret

        result = delete_secret("api_key")
        assert result is True
        mock_delete_password.assert_called_once_with("llm-shell", "api_key")

    @patch("llm_shell.services.security.keyring.delete_password")
    def test_delete_secret_nonexistent_returns_false(
        self, mock_delete_password: MagicMock
    ) -> None:
        """delete_secret for nonexistent key returns False."""
        import keyring.errors

        from llm_shell.services.security import delete_secret

        mock_delete_password.side_effect = keyring.errors.PasswordDeleteError()
        result = delete_secret("nonexistent")
        assert result is False

    @patch("llm_shell.services.security.keyring.delete_password")
    def test_delete_secret_passphrase_pattern(
        self, mock_delete_password: MagicMock
    ) -> None:
        """delete_secret with passphrase:{keypair_id} pattern."""
        from llm_shell.services.security import delete_secret

        result = delete_secret("passphrase:uuid-1234")
        assert result is True
        mock_delete_password.assert_called_once_with(
            "llm-shell", "passphrase:uuid-1234"
        )

    @patch("llm_shell.services.security.keyring.delete_password")
    def test_delete_secret_password_pattern(
        self, mock_delete_password: MagicMock
    ) -> None:
        """delete_secret with password:{server_id} pattern."""
        from llm_shell.services.security import delete_secret

        result = delete_secret("password:server-5678")
        assert result is True
        mock_delete_password.assert_called_once_with(
            "llm-shell", "password:server-5678"
        )
