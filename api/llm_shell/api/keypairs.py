"""SSH keypairs API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from llm_shell.db.database import Database, get_database
from llm_shell.exceptions import NotFoundError
from llm_shell.models.keypairs import KeyPairCreate, KeyPairOut, KeyPairUpdate
from llm_shell.services.keypairs import KeyPairsService

router = APIRouter()


def get_keypairs_service(db: Annotated[Database, Depends(get_database)]) -> KeyPairsService:
    """Get keypairs service instance."""
    return KeyPairsService(db)


@router.get("/keypairs", response_model=list[KeyPairOut])
async def list_keypairs(
    service: Annotated[KeyPairsService, Depends(get_keypairs_service)],
) -> list[KeyPairOut]:
    """List all SSH keypairs."""
    return await service.list_all()


@router.post(
    "/keypairs",
    response_model=KeyPairOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_keypair(
    data: KeyPairCreate,
    service: Annotated[KeyPairsService, Depends(get_keypairs_service)],
) -> KeyPairOut:
    """Create a new SSH keypair."""
    return await service.create(data)


@router.get("/keypairs/{keypair_id}", response_model=KeyPairOut)
async def get_keypair(
    keypair_id: str,
    service: Annotated[KeyPairsService, Depends(get_keypairs_service)],
) -> KeyPairOut:
    """Get an SSH keypair by ID."""
    try:
        return await service.get_by_id(keypair_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


@router.put("/keypairs/{keypair_id}", response_model=KeyPairOut)
async def update_keypair(
    keypair_id: str,
    data: KeyPairUpdate,
    service: Annotated[KeyPairsService, Depends(get_keypairs_service)],
) -> KeyPairOut:
    """Update an SSH keypair (full update)."""
    try:
        return await service.update(keypair_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())


@router.delete("/keypairs/{keypair_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keypair(
    keypair_id: str,
    service: Annotated[KeyPairsService, Depends(get_keypairs_service)],
) -> None:
    """Delete an SSH keypair."""
    try:
        await service.delete(keypair_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.to_dict())
