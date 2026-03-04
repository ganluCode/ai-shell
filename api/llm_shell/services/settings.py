"""Settings service."""

from llm_shell.config import get_settings
from llm_shell.db.database import Database
from llm_shell.models.settings import SettingsAllOut, SettingsUpdate
from llm_shell.services.security import delete_secret, get_secret, store_secret


class SettingsService:
    """Service for settings management."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _get_defaults() -> dict[str, str]:
        cfg = get_settings()
        return {
            "model": cfg.default_model,
            "base_url": cfg.anthropic_base_url or "",
            "terminal_font": cfg.default_terminal_font,
            "terminal_size": cfg.default_terminal_size,
            "theme": "dark",
            "output_buffer": str(cfg.max_context_lines),
            "context_lines": str(cfg.default_context_lines),
            "max_chat_rounds": str(cfg.max_chat_rounds),
        }

    async def get_all(self) -> SettingsAllOut:
        """Get all settings."""
        rows = await self._db.fetchall("SELECT key, value FROM settings")

        # Build settings dict with defaults for missing keys
        settings_dict = self._get_defaults()
        for row in rows:
            settings_dict[row["key"]] = row["value"]

        # Get masked API key: keyring first, then env var fallback
        api_key_masked = await self._get_masked_api_key()

        return SettingsAllOut(
            model=settings_dict["model"],
            base_url=settings_dict["base_url"],
            terminal_font=settings_dict["terminal_font"],
            terminal_size=settings_dict["terminal_size"],
            theme=settings_dict["theme"],
            output_buffer=settings_dict["output_buffer"],
            context_lines=settings_dict["context_lines"],
            max_chat_rounds=settings_dict["max_chat_rounds"],
            api_key=api_key_masked,
        )

    async def update(self, data: SettingsUpdate) -> SettingsAllOut:
        """Update settings (partial update)."""
        updates = data.model_dump(exclude_unset=True)

        # Handle API key separately (stored in keyring)
        if "api_key" in updates:
            api_key = updates.pop("api_key")
            if api_key:
                self._store_api_key(api_key)
            else:
                self._delete_api_key()

        # Update database settings
        for key, value in updates.items():
            await self._db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )
        await self._db.commit()

        return await self.get_all()

    def _store_api_key(self, api_key: str) -> None:
        """Store API key in keyring."""
        store_secret("api_key", api_key)

    def _delete_api_key(self) -> None:
        """Delete API key from keyring."""
        delete_secret("api_key")

    async def _get_masked_api_key(self) -> str:
        """Get masked API key from keyring, fallback to env var."""
        api_key = get_secret("api_key")
        if not api_key:
            # Fallback to ANTHROPIC_API_KEY env var
            app_settings = get_settings()
            api_key = app_settings.anthropic_api_key
        if not api_key:
            return ""

        # Mask the API key: show first 3 and last 4 characters
        if len(api_key) > 7:
            return f"{api_key[:3]}***{api_key[-4:]}"
        return "***"
