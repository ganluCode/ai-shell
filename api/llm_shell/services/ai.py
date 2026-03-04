"""AI service for Claude API integration."""

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from anthropic import (
    APIConnectionError,
    APITimeoutError,
    AsyncAnthropic,
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
from llm_shell.services.security import get_secret

if TYPE_CHECKING:
    from llm_shell.services.settings import SettingsService

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 2
RETRY_DELAYS = [1, 3]  # seconds

TOOLS = [
    {
        "name": "suggest_command",
        "description": "建议单个 shell 命令供用户执行",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "要执行的 shell 命令",
                },
                "explanation": {
                    "type": "string",
                    "description": "命令的作用说明",
                },
                "risk_level": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "命令的风险等级：low(只读)、medium(修改)、high(危险)",
                },
                "thinking": {
                    "type": "string",
                    "description": "AI 的思考过程（可选）",
                },
            },
            "required": ["command", "explanation", "risk_level"],
        },
    },
    {
        "name": "suggest_commands",
        "description": "建议多个 shell 命令选项供用户选择",
        "input_schema": {
            "type": "object",
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "command": {
                                "type": "string",
                                "description": "要执行的 shell 命令",
                            },
                            "explanation": {
                                "type": "string",
                                "description": "命令的作用说明",
                            },
                            "risk_level": {
                                "type": "string",
                                "enum": ["low", "medium", "high"],
                                "description": "命令的风险等级",
                            },
                        },
                        "required": ["command", "explanation", "risk_level"],
                    },
                    "description": "命令选项列表",
                },
                "thinking": {
                    "type": "string",
                    "description": "AI 的思考过程（可选）",
                },
            },
            "required": ["commands"],
        },
    },
    {
        "name": "search_terminal_output",
        "description": "搜索终端历史输出内容",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "搜索模式（支持正则表达式）",
                },
                "context_lines": {
                    "type": "integer",
                    "default": 3,
                    "description": "匹配结果上下文行数",
                },
            },
            "required": ["pattern"],
        },
    },
]

SYSTEM_PROMPT = """你是一个专业的 Linux/Unix 系统运维助手，帮助用户生成和执行 shell 命令。

## 你的职责

1. **生成命令**: 根据用户需求生成准确的 shell 命令
2. **使用工具**: 始终使用工具 (suggest_command 或 suggest_commands) 来返回命令
3. **评估风险**: 对每个命令进行风险评估 (low/medium/high)
4. **保持真实**: 绝不编造不存在的命令或参数，如果不确定请明确说明

## 风险等级

- **low**: 只读操作，如查看文件、检查状态
- **medium**: 修改操作，如创建文件、修改配置
- **high**: 危险操作，如删除文件、修改系统配置、重启服务

## 工具使用

当你需要建议命令时，必须使用以下工具之一：
- `suggest_command`: 建议单个命令
- `suggest_commands`: 建议多个命令选项
- `search_terminal_output`: 搜索终端历史输出

不要在文本回复中直接给出命令，始终使用工具。
"""


def build_context(session: dict, settings: dict) -> str:
    """Build context string for AI from session and settings.

    Args:
        session: Session dict containing server_info and output_buffer.
        settings: Settings dict containing context_lines.

    Returns:
        Formatted context string with server info and terminal output.
    """
    server_info = session.get("server_info", {})
    output_buffer = session.get("output_buffer", [])
    context_lines = settings.get("context_lines", 50)

    parts = []

    # Server information section
    parts.append("## 服务器信息")

    # OS info
    os_release = server_info.get("os_release", "")
    uname = server_info.get("uname", "")
    if os_release:
        parts.append(f"操作系统: {os_release}")
    elif uname:
        parts.append(f"系统信息: {uname}")

    # Hostname (extracted from uname)
    if uname:
        hostname = uname.split()[1] if len(uname.split()) > 1 else ""
        if hostname:
            parts.append(f"主机名: {hostname}")

    # User
    username = server_info.get("username", "")
    if username:
        parts.append(f"当前用户: {username}")

    # Shell
    shell = server_info.get("shell", "")
    if shell:
        parts.append(f"Shell: {shell}")

    # Current working directory
    cwd = server_info.get("cwd", "")
    if cwd:
        parts.append(f"当前目录: {cwd}")

    # Terminal output section
    parts.append("\n## 终端输出")

    if output_buffer:
        total_lines = len(output_buffer)
        if total_lines > context_lines:
            # Show omission message for truncated output
            omitted = total_lines - context_lines
            parts.append(f"[... 省略了前 {omitted} 行 ...]")
            # Show only the last context_lines
            display_lines = output_buffer[-context_lines:]
        else:
            display_lines = output_buffer

        parts.append("```")
        parts.extend(display_lines)
        parts.append("```")
    else:
        parts.append("(无输出)")

    return "\n".join(parts)


async def call_claude_api(
    messages: list[dict[str, Any]],
    settings_service: "SettingsService",
) -> Any:
    """Call Claude API with retry logic.

    Args:
        messages: List of message dicts for the conversation.
        settings_service: Settings service to get model and base_url.

    Returns:
        Claude API response object.

    Raises:
        AIAuthFailedError: If API key is invalid (no retry).
        AIRateLimitedError: If rate limited after all retries.
        AITimeoutError: If request times out after all retries.
        AIUnavailableError: If service is unavailable after all retries.
    """
    # Get settings
    settings = await settings_service.get_all()
    model = settings.model
    base_url = settings.base_url if settings.base_url else None

    # Get API key from keyring
    api_key = get_secret("api_key")
    if not api_key:
        raise AIAuthFailedError()

    # Create client with settings
    client_kwargs: dict[str, Any] = {
        "api_key": api_key,
        "timeout": 30,
    }
    if base_url:
        client_kwargs["base_url"] = base_url

    client = AsyncAnthropic(**client_kwargs)

    # Retry loop
    attempt = 0
    while True:
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=1024,
                messages=messages,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
            )
            return response

        except AuthenticationError as e:
            # Authentication errors should not be retried
            logger.error(f"Claude API authentication failed: {e}")
            raise AIAuthFailedError() from e

        except RateLimitError as e:
            attempt += 1
            if attempt > MAX_RETRIES:
                logger.error(f"Claude API rate limited after {attempt} attempts")
                raise AIRateLimitedError() from e
            delay = RETRY_DELAYS[attempt - 1]
            logger.warning(f"Claude API rate limited, retrying in {delay}s (attempt {attempt})")
            await asyncio.sleep(delay)

        except APITimeoutError as e:
            attempt += 1
            if attempt > MAX_RETRIES:
                logger.error(f"Claude API timeout after {attempt} attempts")
                raise AITimeoutError() from e
            delay = RETRY_DELAYS[attempt - 1]
            logger.warning(f"Claude API timeout, retrying in {delay}s (attempt {attempt})")
            await asyncio.sleep(delay)

        except (APIConnectionError, InternalServerError) as e:
            attempt += 1
            if attempt > MAX_RETRIES:
                logger.error(f"Claude API unavailable after {attempt} attempts: {e}")
                raise AIUnavailableError() from e
            delay = RETRY_DELAYS[attempt - 1]
            logger.warning(f"Claude API error, retrying in {delay}s (attempt {attempt}): {e}")
            await asyncio.sleep(delay)
