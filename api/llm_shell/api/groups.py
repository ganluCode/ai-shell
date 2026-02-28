"""Server groups API routes."""

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status

from llm_shell.db.database import Database, get_database
from llm_shell.exceptions import NotFoundError
from llm_shell.models.groups import ServerGroupCreate, ServerGroupOut, ServerGroupUpdate
from llm_shell.services.groups import GroupsService

router = APIRouter()


def get_groups_service(db: Annotated[Database, Depends(get_database)]) -> GroupsService:
    """Get groups service instance."""
    return GroupsService(db)


@router.get("/groups", response_model=list[ServerGroupOut])
async def list_groups(
    service: Annotated[GroupsService, Depends(get_groups_service)],
) -> list[ServerGroupOut]:
    """List all server groups."""
    return await service.list_all()


@router.post(
    "/groups",
    response_model=ServerGroupOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_group(
    group_in: Annotated[ServerGroupCreate, Body(embed=False)],
    service: Annotated[GroupsService, Depends(get_groups_service)],
) -> ServerGroupOut:
    """Create a new server group."""
    return await service.create(group_in)


@router.get("/groups/{group_id}", response_model=ServerGroupOut)
async def get_group(
    group_id: str,
    service: Annotated[GroupsService, Depends(get_groups_service)],
) -> ServerGroupOut:
    """Get a server group by ID."""
    try:
        return await service.get_by_id(group_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


@router.put("/groups/{group_id}", response_model=ServerGroupOut)
async def update_group(
    group_id: str,
    data: ServerGroupUpdate,
    service: Annotated[GroupsService, Depends(get_groups_service)],
) -> ServerGroupOut:
    """Update a server group (full update)."""
    try:
        return await service.update(group_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    service: Annotated[GroupsService, Depends(get_groups_service)],
) -> None:
    """Delete a server group."""
    try:
        await service.delete(group_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


