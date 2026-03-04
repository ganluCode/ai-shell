"""AI service for Claude API integration."""

import asyncio
import logging
from collections import deque
from typing import TYPE_CHECKING, Any, AsyncGenerator

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
from llm_shell.services.output_buffer import search_output_buffer
from llm_shell.services.security import check_command_safety, get_secret

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


async def chat(
    session: dict,
    history: deque,
    user_message: str,
    settings_service: "SettingsService",
) -> AsyncGenerator[dict[str, Any], None]:
    """Chat with Claude AI assistant.

    An async generator that handles the conversation with Claude API,
    including tool use for command suggestions and terminal output search.

    Args:
        session: Session dict containing server_info and output_buffer.
        history: Conversation history as a deque (maxlen=20 recommended).
        user_message: The user's message.
        settings_service: Settings service to get configuration.

    Yields:
        Event dicts with types:
        - {"type": "text", "content": "..."} for text responses
        - {"type": "command", "command": "...", "explanation": "...", "risk_level": "..."}
        - {"type": "commands", "commands": [...]} for multiple command options
    """
    # Get settings
    settings = await settings_service.get_all()
    settings_dict = {
        "context_lines": int(settings.context_lines) if settings.context_lines else 50,
    }

    # Build context from session
    context = build_context(session, settings_dict)

    # Build initial messages
    messages: list[dict[str, Any]] = []

    # Add conversation history
    for msg in history:
        messages.append(dict(msg))

    # Add current user message with context
    messages.append({
        "role": "user",
        "content": f"{context}\n\n用户请求: {user_message}",
    })

    # Add user message to history
    history.append({"role": "user", "content": user_message})

    # Tool use loop
    while True:
        response = await call_claude_api(messages, settings_service)

        # Check for tool use
        tool_use_blocks = [
            block for block in response.content if getattr(block, "type", None) == "tool_use"
        ]

        if not tool_use_blocks:
            # No tool use - yield text response
            text_content = ""
            for block in response.content:
                if hasattr(block, "text"):
                    text_content += block.text

            if text_content:
                yield {"type": "text", "content": text_content}
                # Add assistant response to history
                history.append({"role": "assistant", "content": text_content})

            break

        # Process tool uses
        assistant_content: list[dict[str, Any]] = []
        tool_results: list[dict[str, Any]] = []

        for tool_use in tool_use_blocks:
            tool_name = tool_use.name
            tool_input = tool_use.input
            tool_id = tool_use.id

            # Record assistant's tool use
            assistant_content.append({
                "type": "tool_use",
                "id": tool_id,
                "name": tool_name,
                "input": tool_input,
            })

            if tool_name == "search_terminal_output":
                # Execute terminal output search
                pattern = tool_input.get("pattern", "")
                context_lines = tool_input.get("context_lines", 3)
                output_buffer = session.get("output_buffer", [])

                matches = search_output_buffer(output_buffer, pattern, context_lines)

                # Format search results
                if matches:
                    result_text = "搜索结果:\n"
                    for match in matches:
                        result_text += f"\n行 {match['line_number']}: {match['matched_line']}\n"
                        result_text += "上下文:\n" + "\n".join(match["context"]) + "\n"
                else:
                    result_text = f"未找到匹配 '{pattern}' 的结果"

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": result_text,
                })

            elif tool_name == "suggest_command":
                # Apply safety check
                command = tool_input.get("command", "")
                explanation = tool_input.get("explanation", "")
                risk_level = tool_input.get("risk_level", "low")

                safety_result = check_command_safety(command)

                if safety_result["status"] == "blocked":
                    # Blocked command - yield text event explaining block
                    yield {
                        "type": "text",
                        "content": f"命令 '{command}' 被安全策略阻止: {safety_result['reason']}",
                    }
                    history.append({
                        "role": "assistant",
                        "content": f"Blocked command: {command}",
                    })
                    return

                # Override risk level if high risk detected
                if safety_result["status"] == "high":
                    risk_level = "high"

                # Yield command event
                yield {
                    "type": "command",
                    "command": command,
                    "explanation": explanation,
                    "risk_level": risk_level,
                }
                history.append({
                    "role": "assistant",
                    "content": f"Suggested command: {command}",
                })
                return

            elif tool_name == "suggest_commands":
                # Apply safety check to each command
                commands = tool_input.get("commands", [])
                processed_commands = []

                for cmd in commands:
                    command = cmd.get("command", "")
                    explanation = cmd.get("explanation", "")
                    risk_level = cmd.get("risk_level", "low")

                    safety_result = check_command_safety(command)

                    if safety_result["status"] == "blocked":
                        # Skip blocked commands but note them
                        continue

                    # Override risk level if high risk detected
                    if safety_result["status"] == "high":
                        risk_level = "high"

                    processed_commands.append({
                        "command": command,
                        "explanation": explanation,
                        "risk_level": risk_level,
                    })

                if processed_commands:
                    yield {
                        "type": "commands",
                        "commands": processed_commands,
                    }
                    history.append({
                        "role": "assistant",
                        "content": f"Suggested {len(processed_commands)} commands",
                    })
                return

            else:
                # Unknown tool - return error
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": f"Unknown tool: {tool_name}",
                    "is_error": True,
                })

        # Add assistant message with tool use to conversation
        messages.append({"role": "assistant", "content": assistant_content})

        # Add tool results as user message
        if tool_results:
            messages.append({"role": "user", "content": tool_results})
