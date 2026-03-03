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


class TestCommandSafetyPatterns:
    """Tests for command safety pattern checking."""

    def test_blocked_patterns_count(self) -> None:
        """BLOCKED_PATTERNS should have 7 patterns."""
        from llm_shell.services.security import BLOCKED_PATTERNS

        assert len(BLOCKED_PATTERNS) == 7

    def test_high_risk_patterns_count(self) -> None:
        """HIGH_RISK_PATTERNS should have 4 patterns."""
        from llm_shell.services.security import HIGH_RISK_PATTERNS

        assert len(HIGH_RISK_PATTERNS) == 4

    def test_check_command_safety_rm_rf_root_returns_blocked(self) -> None:
        """check_command_safety('rm -rf /') returns 'blocked'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("rm -rf /")
        assert result["status"] == "blocked"
        assert "reason" in result

    def test_check_command_safety_mkfs_returns_blocked(self) -> None:
        """check_command_safety with mkfs returns 'blocked'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("mkfs.ext4 /dev/sda1")
        assert result["status"] == "blocked"
        assert "reason" in result

    def test_check_command_safety_dd_of_dev_returns_blocked(self) -> None:
        """check_command_safety with dd of=/dev returns 'blocked'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("dd if=/dev/zero of=/dev/sda")
        assert result["status"] == "blocked"
        assert "reason" in result

    def test_check_command_safety_fork_bomb_returns_blocked(self) -> None:
        """check_command_safety with fork bomb returns 'blocked'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety(":(){ :|:& };:")
        assert result["status"] == "blocked"
        assert "reason" in result

    def test_check_command_safety_chmod_777_root_returns_blocked(self) -> None:
        """check_command_safety with chmod -R 777 / returns 'blocked'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("chmod -R 777 /")
        assert result["status"] == "blocked"
        assert "reason" in result

    def test_check_command_safety_shutdown_returns_high(self) -> None:
        """check_command_safety('systemctl restart nginx') returns 'high'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("systemctl restart nginx")
        assert result["status"] == "high"
        assert "reason" in result

    def test_check_command_safety_reboot_returns_high(self) -> None:
        """check_command_safety with reboot returns 'high'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("reboot")
        assert result["status"] == "high"

    def test_check_command_safety_rm_rf_directory_returns_high(self) -> None:
        """check_command_safety with rm -rf (not root) returns 'high'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("rm -rf /home/user/data")
        assert result["status"] == "high"

    def test_check_command_safety_drop_table_returns_high(self) -> None:
        """check_command_safety with DROP TABLE returns 'high'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("DROP TABLE users;")
        assert result["status"] == "high"

    def test_check_command_safety_truncate_returns_high(self) -> None:
        """check_command_safety with truncate returns 'high'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("truncate table users;")
        assert result["status"] == "high"

    def test_check_command_safety_ls_returns_pass(self) -> None:
        """check_command_safety('ls -la') returns 'pass'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("ls -la")
        assert result["status"] == "pass"

    def test_check_command_safety_df_h_returns_pass(self) -> None:
        """check_command_safety('df -h') returns 'pass'."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("df -h")
        assert result["status"] == "pass"

    def test_blocked_result_includes_reason_message(self) -> None:
        """Blocked result includes reason message."""
        from llm_shell.services.security import check_command_safety

        result = check_command_safety("rm -rf /")
        assert result["status"] == "blocked"
        assert "reason" in result
        assert len(result["reason"]) > 0
