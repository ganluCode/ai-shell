"""Tests for AI API retry logic."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    InternalServerError,
    RateLimitError,
)

from llm_shell.exceptions import (
    AIAuthFailedError,
    AIRateLimitedError,
    AITimeoutError,
    AIUnavailableError,
)
from llm_shell.services.ai import call_claude_api


class TestClaudeAPIClientRetry:
    """Tests for Claude API client retry logic."""

    @pytest.fixture
    def mock_settings_service(self) -> MagicMock:
        """Create mock settings service."""
        service = MagicMock()
        service.get_all = AsyncMock()
        service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="",
        )
        return service

    @pytest.fixture
    def mock_session(self) -> dict:
        """Create mock session."""
        return {
            "server_info": {
                "uname": "Linux test 5.15.0",
                "shell": "/bin/bash",
                "username": "testuser",
            },
            "output_buffer": ["test output"],
        }

    @pytest.mark.asyncio
    async def test_rate_limit_error_retries_then_succeeds(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """RateLimitError should retry 2 times, then succeed on 3rd attempt."""
        messages = [{"role": "user", "content": "test"}]

        # Mock the Anthropic client
        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # First two calls raise RateLimitError, third succeeds
                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Success response")]
                mock_response.stop_reason = "end_turn"
                mock_response.tool_use = None

                mock_client.messages.create = AsyncMock(
                    side_effect=[
                        RateLimitError(
                            "Rate limited",
                            response=MagicMock(status_code=429),
                            body={"error": {"message": "Rate limited"}},
                        ),
                        RateLimitError(
                            "Rate limited",
                            response=MagicMock(status_code=429),
                            body={"error": {"message": "Rate limited"}},
                        ),
                        mock_response,
                    ]
                )

                # Should succeed after retries
                result = await call_claude_api(
                    messages=messages,
                    settings_service=mock_settings_service,
                )

                # Should have been called 3 times (2 retries + 1 success)
                assert mock_client.messages.create.call_count == 3
                assert result.content[0].text == "Success response"

    @pytest.mark.asyncio
    async def test_authentication_error_throws_immediately(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """AuthenticationError should throw immediately without retry."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_client.messages.create = AsyncMock(
                    side_effect=AuthenticationError(
                        "Invalid API key",
                        response=MagicMock(status_code=401),
                        body={"error": {"message": "Invalid API key"}},
                    )
                )

                # Should raise AIAuthFailedError immediately
                with pytest.raises(AIAuthFailedError):
                    await call_claude_api(
                        messages=messages,
                        settings_service=mock_settings_service,
                    )

                # Should only be called once (no retries)
                assert mock_client.messages.create.call_count == 1

    @pytest.mark.asyncio
    async def test_consecutive_timeouts_throws_after_exhaustion(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """Consecutive APITimeoutError should throw AITimeoutError after 3 attempts."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # All calls raise APITimeoutError
                mock_client.messages.create = AsyncMock(
                    side_effect=APITimeoutError("Request timed out")
                )

                # Should raise AITimeoutError after retries exhausted
                with pytest.raises(AITimeoutError):
                    await call_claude_api(
                        messages=messages,
                        settings_service=mock_settings_service,
                    )

                # Should have been called 3 times (initial + 2 retries)
                assert mock_client.messages.create.call_count == 3

    @pytest.mark.asyncio
    async def test_rate_limit_error_throws_after_exhaustion(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """RateLimitError should throw AIRateLimitedError after 3 attempts."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # All calls raise RateLimitError
                mock_client.messages.create = AsyncMock(
                    side_effect=RateLimitError(
                        "Rate limited",
                        response=MagicMock(status_code=429),
                        body={"error": {"message": "Rate limited"}},
                    )
                )

                # Should raise AIRateLimitedError after retries exhausted
                with pytest.raises(AIRateLimitedError):
                    await call_claude_api(
                        messages=messages,
                        settings_service=mock_settings_service,
                    )

                # Should have been called 3 times (initial + 2 retries)
                assert mock_client.messages.create.call_count == 3

    @pytest.mark.asyncio
    async def test_api_connection_error_retries_and_throws(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """APIConnectionError should retry, then throw AIUnavailableError."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # All calls raise APIConnectionError
                mock_request = MagicMock()
                mock_client.messages.create = AsyncMock(
                    side_effect=APIConnectionError(message="Connection failed", request=mock_request)
                )

                # Should raise AIUnavailableError after retries exhausted
                with pytest.raises(AIUnavailableError):
                    await call_claude_api(
                        messages=messages,
                        settings_service=mock_settings_service,
                    )

                # Should have been called 3 times
                assert mock_client.messages.create.call_count == 3

    @pytest.mark.asyncio
    async def test_internal_server_error_retries_and_throws(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """InternalServerError should retry, then throw AIUnavailableError."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                # All calls raise InternalServerError
                mock_client.messages.create = AsyncMock(
                    side_effect=InternalServerError(
                        "Internal error",
                        response=MagicMock(status_code=500),
                        body={"error": {"message": "Internal error"}},
                    )
                )

                # Should raise AIUnavailableError after retries exhausted
                with pytest.raises(AIUnavailableError):
                    await call_claude_api(
                        messages=messages,
                        settings_service=mock_settings_service,
                    )

                # Should have been called 3 times
                assert mock_client.messages.create.call_count == 3

    @pytest.mark.asyncio
    async def test_successful_call_no_retry(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """Successful API call should not trigger any retries."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Success")]
                mock_response.stop_reason = "end_turn"
                mock_response.tool_use = None

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                result = await call_claude_api(
                    messages=messages,
                    settings_service=mock_settings_service,
                )

                # Should only be called once
                assert mock_client.messages.create.call_count == 1
                assert result.content[0].text == "Success"

    @pytest.mark.asyncio
    async def test_client_uses_correct_settings(
        self, mock_session: dict, mock_settings_service: MagicMock
    ) -> None:
        """Client should use correct settings: max_tokens=1024, timeout=30."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Success")]
                mock_response.stop_reason = "end_turn"
                mock_response.tool_use = None

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                await call_claude_api(
                    messages=messages,
                    settings_service=mock_settings_service,
                )

                # Verify client was created with correct timeout
                mock_client_class.assert_called_once()
                call_kwargs = mock_client_class.call_args[1]
                assert call_kwargs.get("timeout") == 30

                # Verify create was called with correct max_tokens
                create_kwargs = mock_client.messages.create.call_args[1]
                assert create_kwargs.get("max_tokens") == 1024

    @pytest.mark.asyncio
    async def test_reads_model_from_settings(
        self, mock_session: dict
    ) -> None:
        """Client should read model from settings."""
        messages = [{"role": "user", "content": "test"}]

        mock_settings_service = MagicMock()
        mock_settings_service.get_all = AsyncMock()
        mock_settings_service.get_all.return_value = MagicMock(
            model="claude-3-opus-20240229",
            base_url="",
        )

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Success")]
                mock_response.stop_reason = "end_turn"
                mock_response.tool_use = None

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                await call_claude_api(
                    messages=messages,
                    settings_service=mock_settings_service,
                )

                # Verify model was read from settings
                create_kwargs = mock_client.messages.create.call_args[1]
                assert create_kwargs.get("model") == "claude-3-opus-20240229"

    @pytest.mark.asyncio
    async def test_reads_api_key_from_keyring(self, mock_settings_service: MagicMock) -> None:
        """Client should read API key from keyring."""
        messages = [{"role": "user", "content": "test"}]

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "sk-test-key-from-keyring"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Success")]
                mock_response.stop_reason = "end_turn"
                mock_response.tool_use = None

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                await call_claude_api(
                    messages=messages,
                    settings_service=mock_settings_service,
                )

                # Verify API key was read from keyring
                mock_get_secret.assert_called_once_with("api_key")

                # Verify client was created with the API key
                call_kwargs = mock_client_class.call_args[1]
                assert call_kwargs.get("api_key") == "sk-test-key-from-keyring"

    @pytest.mark.asyncio
    async def test_uses_base_url_from_settings(
        self, mock_session: dict
    ) -> None:
        """Client should use base_url from settings if provided."""
        messages = [{"role": "user", "content": "test"}]

        mock_settings_service = MagicMock()
        mock_settings_service.get_all = AsyncMock()
        mock_settings_service.get_all.return_value = MagicMock(
            model="claude-3-5-sonnet-20241022",
            base_url="https://custom-api.example.com",
        )

        with patch("llm_shell.services.ai.get_secret") as mock_get_secret:
            mock_get_secret.return_value = "test-api-key"

            with patch("llm_shell.services.ai.AsyncAnthropic") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                mock_response = MagicMock()
                mock_response.content = [MagicMock(text="Success")]
                mock_response.stop_reason = "end_turn"
                mock_response.tool_use = None

                mock_client.messages.create = AsyncMock(return_value=mock_response)

                await call_claude_api(
                    messages=messages,
                    settings_service=mock_settings_service,
                )

                # Verify base_url was used
                call_kwargs = mock_client_class.call_args[1]
                assert call_kwargs.get("base_url") == "https://custom-api.example.com"
