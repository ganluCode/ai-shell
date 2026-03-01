"""Security service for keyring operations."""

import keyring
import keyring.errors

SERVICE_NAME = "llm-shell"


def store_secret(key: str, value: str) -> bool:
    """Store a secret in the system keyring.

    Args:
        key: The key identifier (e.g., 'api_key', 'passphrase:{keypair_id}',
             'password:{server_id}')
        value: The secret value to store

    Returns:
        True if successful
    """
    keyring.set_password(SERVICE_NAME, key, value)
    return True


def get_secret(key: str) -> str | None:
    """Retrieve a secret from the system keyring.

    Args:
        key: The key identifier

    Returns:
        The secret value if found, None otherwise
    """
    return keyring.get_password(SERVICE_NAME, key)


def delete_secret(key: str) -> bool:
    """Delete a secret from the system keyring.

    Args:
        key: The key identifier

    Returns:
        True if successful, False if the key doesn't exist
    """
    try:
        keyring.delete_password(SERVICE_NAME, key)
        return True
    except keyring.errors.PasswordDeleteError:
        return False
