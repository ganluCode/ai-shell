"""Settings API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends

from llm_shell.db.database import Database, get_database
from llm_shell.models.settings import SettingsAllOut, SettingsUpdate
from llm_shell.services.settings import SettingsService

router = APIRouter()


def get_settings_service(db: Annotated[Database, Depends(get_database)]) -> SettingsService:
    """Get settings service instance."""
    return SettingsService(db)


@router.get("/settings", response_model=SettingsAllOut)
async def get_settings(
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> SettingsAllOut:
    """Get all settings."""
    return await service.get_all()


@router.patch("/settings", response_model=SettingsAllOut)
async def update_settings(
    data: SettingsUpdate,
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> SettingsAllOut:
    """Update settings (partial update)."""
    return await service.update(data)
