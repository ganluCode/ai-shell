"""Tests for CommandLog database functions."""

import pytest

from llm_shell.db.database import Database
from llm_shell.models.common import CommandSource, RiskLevel
from llm_shell.services.command_logs import CommandLogsService
from llm_shell.services.servers import ServersService


@pytest.fixture
def command_logs_service(test_db: Database) -> CommandLogsService:
    """Create CommandLogsService with test database."""
    return CommandLogsService(test_db)


@pytest.fixture
def servers_service(test_db: Database) -> ServersService:
    """Create ServersService with test database."""
    return ServersService(test_db)


@pytest.fixture
async def test_server(servers_service: ServersService) -> str:
    """Create a test server and return its ID."""
    from llm_shell.models.servers import ServerCreate
    from llm_shell.models.common import AuthType

    server = await servers_service.create(
        ServerCreate(
            label="Test Server",
            host="test.example.com",
            port=22,
            username="testuser",
            auth_type=AuthType.PASSWORD,
            password="testpass",
        )
    )
    return server.id


class TestCommandLogsCreate:
    """Tests for CommandLog create function."""

    @pytest.mark.asyncio
    async def test_create_returns_command_log_with_uuid(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that create returns new CommandLog with UUID."""
        result = await command_logs_service.create(
            server_id=test_server,
            session_id="session-123",
            command="ls -la",
            source=CommandSource.MANUAL,
        )

        assert result.id is not None
        assert len(result.id) == 36  # UUID format
        assert result.server_id == test_server
        assert result.session_id == "session-123"
        assert result.command == "ls -la"
        assert result.source == CommandSource.MANUAL

    @pytest.mark.asyncio
    async def test_create_returns_command_log_with_timestamp(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that create returns new CommandLog with executed_at timestamp."""
        result = await command_logs_service.create(
            server_id=test_server,
            session_id="session-456",
            command="pwd",
            source=CommandSource.AI,
        )

        assert result.executed_at is not None
        # ISO format timestamp
        assert "T" in result.executed_at

    @pytest.mark.asyncio
    async def test_create_with_optional_fields(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test create with optional fields like output_summary and risk_level."""
        result = await command_logs_service.create(
            server_id=test_server,
            session_id="session-789",
            command="rm -rf /",
            source=CommandSource.AI,
            output_summary="Command blocked by security policy",
            risk_level=RiskLevel.HIGH,
        )

        assert result.output_summary == "Command blocked by security policy"
        assert result.risk_level == RiskLevel.HIGH


class TestCommandLogsGetByServer:
    """Tests for CommandLog get_by_server function."""

    @pytest.mark.asyncio
    async def test_get_by_server_returns_list(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that get_by_server returns a list."""
        # Create some logs
        await command_logs_service.create(
            server_id=test_server,
            session_id="session-1",
            command="ls",
            source=CommandSource.MANUAL,
        )
        await command_logs_service.create(
            server_id=test_server,
            session_id="session-1",
            command="cd /home",
            source=CommandSource.MANUAL,
        )

        result = await command_logs_service.get_by_server(
            server_id=test_server,
            offset=0,
            limit=10,
        )

        assert isinstance(result, list)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_by_server_accepts_offset_and_limit(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that get_by_server accepts offset and limit parameters."""
        # Create 5 logs
        for i in range(5):
            await command_logs_service.create(
                server_id=test_server,
                session_id="session-1",
                command=f"command-{i}",
                source=CommandSource.MANUAL,
            )

        # Get first 2
        page1 = await command_logs_service.get_by_server(
            server_id=test_server,
            offset=0,
            limit=2,
        )
        assert len(page1) == 2

        # Get next 2
        page2 = await command_logs_service.get_by_server(
            server_id=test_server,
            offset=2,
            limit=2,
        )
        assert len(page2) == 2

        # Get last 1
        page3 = await command_logs_service.get_by_server(
            server_id=test_server,
            offset=4,
            limit=2,
        )
        assert len(page3) == 1

    @pytest.mark.asyncio
    async def test_get_by_server_returns_empty_for_no_logs(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that get_by_server returns empty list when no logs exist."""
        result = await command_logs_service.get_by_server(
            server_id=test_server,
            offset=0,
            limit=10,
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_get_by_server_filters_by_server_id(
        self,
        command_logs_service: CommandLogsService,
        servers_service: ServersService,
    ) -> None:
        """Test that get_by_server only returns logs for the specified server."""
        from llm_shell.models.servers import ServerCreate
        from llm_shell.models.common import AuthType

        # Create two servers
        server1 = await servers_service.create(
            ServerCreate(
                label="Server 1",
                host="server1.example.com",
                port=22,
                username="user",
                auth_type=AuthType.PASSWORD,
                password="pass",
            )
        )
        server2 = await servers_service.create(
            ServerCreate(
                label="Server 2",
                host="server2.example.com",
                port=22,
                username="user",
                auth_type=AuthType.PASSWORD,
                password="pass",
            )
        )

        # Create logs for each server
        await command_logs_service.create(
            server_id=server1.id,
            session_id="session-1",
            command="server1-cmd",
            source=CommandSource.MANUAL,
        )
        await command_logs_service.create(
            server_id=server2.id,
            session_id="session-2",
            command="server2-cmd",
            source=CommandSource.MANUAL,
        )

        # Get logs for server1
        result1 = await command_logs_service.get_by_server(
            server_id=server1.id,
            offset=0,
            limit=10,
        )
        assert len(result1) == 1
        assert result1[0].command == "server1-cmd"

        # Get logs for server2
        result2 = await command_logs_service.get_by_server(
            server_id=server2.id,
            offset=0,
            limit=10,
        )
        assert len(result2) == 1
        assert result2[0].command == "server2-cmd"


class TestCommandLogsCountByServer:
    """Tests for CommandLog count_by_server function."""

    @pytest.mark.asyncio
    async def test_count_by_server_returns_total_count(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that count_by_server returns total count of logs for a server."""
        # Create 3 logs
        for i in range(3):
            await command_logs_service.create(
                server_id=test_server,
                session_id=f"session-{i}",
                command=f"cmd-{i}",
                source=CommandSource.MANUAL,
            )

        count = await command_logs_service.count_by_server(server_id=test_server)
        assert count == 3

    @pytest.mark.asyncio
    async def test_count_by_server_returns_zero_for_no_logs(
        self,
        command_logs_service: CommandLogsService,
        test_server: str,
    ) -> None:
        """Test that count_by_server returns 0 when no logs exist."""
        count = await command_logs_service.count_by_server(server_id=test_server)
        assert count == 0

    @pytest.mark.asyncio
    async def test_count_by_server_counts_only_for_specified_server(
        self,
        command_logs_service: CommandLogsService,
        servers_service: ServersService,
    ) -> None:
        """Test that count_by_server only counts logs for the specified server."""
        from llm_shell.models.servers import ServerCreate
        from llm_shell.models.common import AuthType

        # Create two servers
        server1 = await servers_service.create(
            ServerCreate(
                label="Server 1",
                host="server1.example.com",
                port=22,
                username="user",
                auth_type=AuthType.PASSWORD,
                password="pass",
            )
        )
        server2 = await servers_service.create(
            ServerCreate(
                label="Server 2",
                host="server2.example.com",
                port=22,
                username="user",
                auth_type=AuthType.PASSWORD,
                password="pass",
            )
        )

        # Create logs for each server
        for i in range(3):
            await command_logs_service.create(
                server_id=server1.id,
                session_id=f"session-{i}",
                command=f"cmd-{i}",
                source=CommandSource.MANUAL,
            )
        for i in range(5):
            await command_logs_service.create(
                server_id=server2.id,
                session_id=f"session-{i}",
                command=f"cmd-{i}",
                source=CommandSource.MANUAL,
            )

        count1 = await command_logs_service.count_by_server(server_id=server1.id)
        count2 = await command_logs_service.count_by_server(server_id=server2.id)

        assert count1 == 3
        assert count2 == 5
