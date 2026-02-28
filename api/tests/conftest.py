"""Shared pytest fixtures."""

import asyncio
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from llm_shell.config import Settings
from llm_shell.db.database import Database
from llm_shell.main import app
from llm_shell.services.groups import GroupsService
from llm_shell.services.keypairs import KeyPairsService
from llm_shell.services.servers import ServersService
from llm_shell.services.settings import SettingsService


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    """Create test settings with temporary database."""
    db_path = tmp_path / "test.db"
    return Settings(
        database_path=db_path,
        host="127.0.0.1",
        port=8765,
    )


@pytest.fixture
def test_db(test_settings: Settings) -> Generator[Database, None, None]:
    """Create test database."""
    db = Database(test_settings.database_path)
    asyncio.get_event_loop().run_until_complete(db.connect())
    yield db
    asyncio.get_event_loop().run_until_complete(db.close())


@pytest.fixture
def client(test_db: Database) -> Generator[TestClient, None, None]:
    """Create test HTTP client."""
    from llm_shell.api.groups import get_groups_service
    from llm_shell.api.keypairs import get_keypairs_service
    from llm_shell.api.servers import get_servers_service
    from llm_shell.api.settings import get_settings_service

    # Override service dependencies directly
    app.dependency_overrides[get_groups_service] = lambda: GroupsService(test_db)
    app.dependency_overrides[get_keypairs_service] = lambda: KeyPairsService(test_db)
    app.dependency_overrides[get_servers_service] = lambda: ServersService(test_db)
    app.dependency_overrides[get_settings_service] = lambda: SettingsService(test_db)

    with TestClient(app=app, raise_server_exceptions=False) as ac:
        yield ac

    app.dependency_overrides.clear()
