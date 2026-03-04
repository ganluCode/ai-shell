"""AI service for Claude API integration."""

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
