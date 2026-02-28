"""SSH keypair models."""

from pydantic import BaseModel, Field


class KeyPairBase(BaseModel):
    """Base keypair fields."""

    label: str = Field(..., min_length=1, max_length=100)
    private_key_path: str = Field(..., min_length=1)
    public_key_path: str | None = None


class KeyPairCreate(KeyPairBase):
    """Keypair creation request."""

    passphrase: str | None = None  # Stored in keyring, not database


class KeyPairUpdate(KeyPairBase):
    """Keypair update request (full update)."""

    passphrase: str | None = None  # Stored in keyring, not database


class KeyPairOut(BaseModel):
    """Keypair response."""

    id: str
    label: str
    private_key_path: str
    public_key_path: str | None = None
    created_at: str
    updated_at: str
