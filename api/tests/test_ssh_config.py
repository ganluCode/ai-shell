"""Tests for SSH Config parsing."""

import tempfile
from pathlib import Path

import pytest

from llm_shell.services.ssh_config import SSHConfigEntry, parse_ssh_config


class TestSSHConfigParsing:
    """Tests for parse_ssh_config function."""

    def test_standard_config_with_multiple_host_entries(self, tmp_path: Path) -> None:
        """Test parsing standard config with multiple Host entries and all field mappings."""
        config_content = """
Host prod-web-01
    HostName 192.168.1.100
    User root
    Port 2222
    IdentityFile ~/.ssh/id_rsa_prod
    ProxyJump bastion

Host staging-app
    HostName 10.0.0.5
    User deploy
    Port 22
    IdentityFile ~/.ssh/id_rsa
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert len(entries) == 2

        # First entry
        assert entries[0].label == "prod-web-01"
        assert entries[0].host == "192.168.1.100"
        assert entries[0].username == "root"
        assert entries[0].port == 2222
        assert entries[0].identity_file is not None
        assert entries[0].identity_file.endswith("/.ssh/id_rsa_prod")
        assert entries[0].proxy_jump == "bastion"

        # Second entry
        assert entries[1].label == "staging-app"
        assert entries[1].host == "10.0.0.5"
        assert entries[1].username == "deploy"
        assert entries[1].port == 22
        assert entries[1].identity_file is not None
        assert entries[1].identity_file.endswith("/.ssh/id_rsa")
        assert entries[1].proxy_jump is None

    def test_wildcard_hosts_are_skipped(self, tmp_path: Path) -> None:
        """Test that wildcard hosts (*) are skipped."""
        config_content = """
Host *
    User defaultuser
    ForwardAgent yes

Host specific-server
    HostName 10.0.0.1
    User admin
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert len(entries) == 1
        assert entries[0].label == "specific-server"
        assert entries[0].username == "admin"

    def test_tilde_path_expansion(self, tmp_path: Path) -> None:
        """Test that tilde (~) paths are expanded to full paths."""
        config_content = """
Host myserver
    HostName 192.168.1.1
    User testuser
    IdentityFile ~/.ssh/custom_key
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert len(entries) == 1
        assert entries[0].identity_file is not None
        # Should be expanded to full home path
        assert entries[0].identity_file.startswith("/")
        assert "/.ssh/custom_key" in entries[0].identity_file

    def test_include_directive_recursion(self, tmp_path: Path) -> None:
        """Test that Include directives are recursively parsed."""
        # Create included config
        included_config = tmp_path / "included_config"
        included_config.write_text("""
Host included-host
    HostName 10.1.1.1
    User included_user
""")

        # Create main config with Include directive
        main_config = tmp_path / "config"
        main_config.write_text(f"""
Host main-host
    HostName 10.0.0.1
    User main_user

Include {included_config}
""")

        entries = parse_ssh_config(str(main_config))

        assert len(entries) == 2
        labels = [e.label for e in entries]
        assert "main-host" in labels
        assert "included-host" in labels

        # Verify included host data
        included_entry = next(e for e in entries if e.label == "included-host")
        assert included_entry.host == "10.1.1.1"
        assert included_entry.username == "included_user"

    def test_missing_hostname_uses_label_as_host(self, tmp_path: Path) -> None:
        """Test that entries without HostName use label as host."""
        config_content = """
Host myserver.example.com
    User admin
    Port 2222
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert len(entries) == 1
        assert entries[0].label == "myserver.example.com"
        assert entries[0].host == "myserver.example.com"
        assert entries[0].username == "admin"
        assert entries[0].port == 2222

    def test_default_port_value(self, tmp_path: Path) -> None:
        """Test that port defaults to 22 when not specified."""
        config_content = """
Host nospec
    HostName 10.0.0.1
    User test
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert len(entries) == 1
        assert entries[0].port == 22

    def test_empty_config_returns_empty_list(self, tmp_path: Path) -> None:
        """Test that empty config file returns empty list."""
        config_file = tmp_path / "config"
        config_file.write_text("")

        entries = parse_ssh_config(str(config_file))

        assert entries == []

    def test_config_with_only_comments_returns_empty_list(self, tmp_path: Path) -> None:
        """Test that config with only comments returns empty list."""
        config_content = """
# This is a comment
# Another comment
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert entries == []

    def test_nonexistent_config_file_raises_error(self) -> None:
        """Test that nonexistent config file raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            parse_ssh_config("/nonexistent/path/config")

    def test_multiple_identity_files_takes_first(self, tmp_path: Path) -> None:
        """Test that when multiple IdentityFile entries exist, first is used."""
        config_content = """
Host multi-key
    HostName 10.0.0.1
    User test
    IdentityFile ~/.ssh/key1
    IdentityFile ~/.ssh/key2
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        assert len(entries) == 1
        assert entries[0].identity_file is not None
        assert entries[0].identity_file.endswith("/.ssh/key1")

    def test_host_with_multiple_patterns(self, tmp_path: Path) -> None:
        """Test that Host with multiple patterns (space-separated) creates entries for each."""
        config_content = """
Host server1 server2 server3
    HostName 10.0.0.1
    User shared
"""
        config_file = tmp_path / "config"
        config_file.write_text(config_content)

        entries = parse_ssh_config(str(config_file))

        # Each pattern should create a separate entry
        labels = [e.label for e in entries]
        assert "server1" in labels
        assert "server2" in labels
        assert "server3" in labels
        for entry in entries:
            assert entry.host == "10.0.0.1"
            assert entry.username == "shared"
