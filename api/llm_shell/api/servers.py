"""Servers API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from llm_shell.db.database import Database, get_database
from llm_shell.exceptions import NotFoundError
from llm_shell.models.servers import ServerCreate, ServerOut, ServerUpdate
from llm_shell.services.servers import ServersService

router = APIRouter()


def get_servers_service(db: Annotated[Database, Depends(get_database)]) -> ServersService:
    """Get servers service instance."""
    return ServersService(db)


@router.get("/servers", response_model=list[ServerOut])
async def list_servers(
    service: Annotated[ServersService, Depends(get_servers_service)],
    group_id: Annotated[str | None, Query()] = None,
) -> list[ServerOut]:
    """List all servers, optionally filtered by group."""
    return await service.list_all(group_id=group_id)


@router.post(
    "/servers",
    response_model=ServerOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_server(
    data: ServerCreate,
    service: Annotated[ServersService, Depends(get_servers_service)],
) -> ServerOut:
    """Create a new server."""
    return await service.create(data)


@router.get("/servers/{server_id}", response_model=ServerOut)
async def get_server(
    server_id: str,
    service: Annotated[ServersService, Depends(get_servers_service)],
) -> ServerOut:
    """Get a server by ID."""
    try:
        return await service.get_by_id(server_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


@router.put("/servers/{server_id}", response_model=ServerOut)
async def update_server(
    server_id: str,
    data: ServerUpdate,
    service: Annotated[ServersService, Depends(get_servers_service)],
) -> ServerOut:
    """Update a server (full update)."""
    try:
        return await service.update(server_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: str,
    service: Annotated[ServersService, Depends(get_servers_service)],
) -> None:
    """Delete a server."""
    try:
        await service.delete(server_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())
