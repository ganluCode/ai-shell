# LLM Shell — AI 辅助 SSH 运维工具

## 产品定位

类 Termius 的独立 SSH 客户端，内置 AI 助手。用户通过自然语言描述意图，AI 生成命令，用户审批后执行，AI 可读取终端输出继续推理。

## 界面形态

```
┌─────────────────────────────────────────────────────────┐
│ 🖥️ LLM Shell                                ─ □ ✕     │
├──────────┬──────────────────────────────────────────────┤
│ 服务器列表 │  Terminal                    │ AI 助手      │
│          │                              │              │
│ ▸ prod   │  $ ssh root@prod             │ 🤖 有什么可以 │
│   web-01 │  root@prod:~# ▊             │    帮你的？   │
│   web-02 │                              │              │
│   db-01  │                              │ 你: 查看负载  │
│          │                              │              │
│ ▸ staging│                              │ AI: 建议执行  │
│   app-01 │                              │ uptime && top │
│          │                              │  -bn1 | head │
│──────────│                              │              │
│ + 新服务器│                              │ [执行] [编辑] │
│ ⚙ 设置   │                              │              │
└──────────┴──────────────────────────────┴──────────────┘
```

## 技术路线

先做 Web 版快速验证，后期套 Tauri 壳做桌面应用。前端代码几乎不用改。

```
Phase 1 (Web)                     Phase 2 (桌面)
┌──────────────┐                 ┌─────────────────┐
│   Browser    │                 │   Tauri 壳       │
│ ┌──────────┐ │    套壳         │ ┌─────────────┐ │
│ │ React +  │ │  ──────→       │ │ 同一套前端   │ │
│ │ xterm.js │ │                 │ │ React+xterm │ │
│ └────┬─────┘ │                 │ └──────┬──────┘ │
│      │WS     │                 │        │IPC     │
│ ┌────▼─────┐ │                 │ ┌──────▼──────┐ │
│ │ Python   │ │                 │ │  Python     │ │
│ │ Backend  │ │                 │ │  Sidecar    │ │
│ └──────────┘ │                 │ └─────────────┘ │
└──────────────┘                 └─────────────────┘
```

## 技术栈

| 层 | 选型 | 说明 |
|---|------|------|
| 前端 | Vite + React | 纯 SPA，不用 Next.js（无需 SSR/SEO） |
| 终端 | xterm.js + xterm-addon-attach | 业界标准终端模拟器 |
| 后端 | Python FastAPI | 处理 SSH、LLM、数据持久化 |
| SSH | asyncssh | 原生 async SSH 库，与 FastAPI 天然契合 |
| LLM | anthropic SDK | Claude API 官方 Python SDK |
| 存储 | SQLite | 服务器列表、密钥路径、会话历史 |
| 通信 | WebSocket + REST | WS 用于终端流，REST 用于 CRUD 和 AI 对话 |

## 整体模块划分

### 原则

**前端只管"显示"和"交互"，后端管"连接"和"智能"。**

```
┌─ Frontend (Vite + React) ─────────────────────────────────────┐
│                                                                │
│  展示层，不持有任何业务状态                                       │
│                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐ │
│  │ 服务器管理    │  │ 终端渲染     │  │ AI 对话面板            │ │
│  │             │  │             │  │                        │ │
│  │ 列表/表单    │  │ xterm.js    │  │ 消息列表               │ │
│  │ 增删改查 UI  │  │ 纯渲染+输入  │  │ 命令预览 + 确认/编辑按钮 │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬────────────┘ │
│         │ REST           │ WebSocket            │ REST/SSE     │
└─────────┼────────────────┼──────────────────────┼──────────────┘
          │                │                      │
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
          │                │                      │
┌─────────▼────────────────▼──────────────────────▼──────────────┐
│                                                                │
│  Backend (Python FastAPI)                                      │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ 服务器管理    │  │ SSH 会话管理  │  │ AI 服务            │    │
│  │              │  │              │  │                   │    │
│  │ CRUD API     │  │ 连接池       │  │ Claude API 调用    │    │
│  │ 密钥管理     │  │ PTY 管理     │  │ 上下文组装         │    │
│  │ SQLite       │  │ 输出缓冲     │  │ 命令提取           │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 前端模块

| 模块 | 职责 | 不做什么 |
|------|------|----------|
| **服务器管理** | 服务器列表展示、新增/编辑表单、连接/断开按钮 | 不存数据，不验证连接 |
| **终端** | xterm.js 渲染、接收用户键盘输入、发给后端 | 不处理 SSH 协议，不解析输出 |
| **AI 对话** | 聊天消息展示、命令预览卡片、执行/编辑/取消按钮 | 不调 LLM，不拼 prompt |

前端是纯"瘦客户端"，将来套 Tauri 壳零改动。

### 后端模块

#### 1. 服务器管理 (`servers`)

标准 REST CRUD：

```
POST   /api/servers          # 新增
GET    /api/servers          # 列表
PUT    /api/servers/{id}     # 修改
DELETE /api/servers/{id}     # 删除
```

存储字段: host, port, username, auth_type, key_path, label, group 等。

#### 2. SSH 会话管理 (`sessions`)

核心模块，通过 WebSocket 双向通信：

```
WS  /api/sessions/{server_id}/terminal
```

职责：
- 建立 SSH 连接 (asyncssh)
- 分配 PTY (伪终端)
- 双向转发: xterm.js ←→ WS ←→ PTY ←→ 远程 Shell
- 输出缓冲: 旁路拷贝最近 N 行，供 AI 读取
- 会话生命周期: 心跳、断线重连、超时清理

#### 3. AI 服务 (`assistant`)

```
POST  /api/assistant/chat  (或 SSE 流式)
```

职责：
- 从 SSH 模块获取终端上下文（最近输出、OS 信息、当前目录）
- 组装 prompt: system prompt + 终端上下文 + 对话历史 + 用户意图
- 调用 Claude API
- 从响应中提取命令（结构化输出）
- 返回给前端: `{ message, command?, risk_level? }`

### 模块间交互流程

用户在 AI 面板输入"查看磁盘"的完整流程：

```
 前端                      后端
  │                         │
  │  POST /assistant/chat   │
  │  { "message": "查看磁盘" } ──→ AI 服务
  │                         │      │
  │                         │      │ 读取终端上下文
  │                         │      ▼
  │                         │   SSH 会话管理
  │                         │      │ 返回: OS=Ubuntu, cwd=/root
  │                         │      │       最近输出...
  │                         │      ▼
  │                         │   AI 服务 → Claude API
  │                         │      │
  │  ◀── SSE stream ───────│──────┘
  │  { message: "建议执行 df -h",  │
  │    command: "df -h",           │
  │    risk: "low" }               │
  │                                │
  │  用户点击 [执行]                │
  │                                │
  │  WS: send("df -h\n")  ──────→ SSH 会话
  │                                │  PTY 执行
  │  ◀── WS: 输出流 ──────────────│
  │  xterm.js 渲染                 │
```

### 关键设计决策

**AI 执行命令走前端终端 WebSocket 发送（而非后端直接注入 SSH）：**

- 用户在终端里能看到完整的命令和输出
- 体验一致，跟自己敲的没区别
- 前端逻辑简单，点执行 = 往 WS 发一条消息

---

## SSH 连接管理

### SSH 库选型：asyncssh（而非 paramiko）

paramiko 是同步阻塞的，在 FastAPI (asyncio) 里需要 `run_in_executor` 桥接，每个 session 占一个线程。asyncssh 原生 async/await，单进程单线程即可处理所有会话。

| | paramiko + 线程池 | asyncssh |
|---|---|---|
| 每个 session 开销 | 1 个线程 (~8MB 栈) | 1 个协程 (~KB 级) |
| 10 个会话 | 10 线程，没问题 | 10 协程，更轻 |
| 100 个会话 | 100 线程，开始吃力 | 100 协程，轻松 |
| 与 FastAPI 配合 | 需要 run_in_executor 桥接 | 原生 async/await，天然契合 |
| 库成熟度 | 非常成熟，文档多 | 成熟，社区稍小 |
| 代码复杂度 | 稍高，需处理线程同步 | 低，async 一把梭 |

### 进程/线程模型

**单进程，多协程，不为每个 session 开进程。**

```
Python 进程 (1个)
│
├── asyncio 事件循环 (主线程)
│   ├── FastAPI (HTTP + WebSocket)
│   ├── SSHSession 1 (协程) → server-A
│   ├── SSHSession 2 (协程) → server-A (复用连接)
│   └── SSHSession 3 (协程) → server-B
```

### 核心概念模型

```
SessionManager (单例)
│
├── connections: { server_id: SSHClientConnection }  ← 复用
│
├── sessions: { session_id: SSHSession }
│   │
│   ├── SSHSession (每个终端 Tab 一个)
│   │   ├── connection  — asyncssh 连接，持有 TCP
│   │   ├── process     — SSH 进程 (PTY + Shell)
│   │   ├── output_buf  — 环形缓冲，供 AI 读取
│   │   └── websockets  — 前端连接 (通常1个)
│   │
│   ├── SSHSession
│   └── SSHSession
```

### 多会话管理

一个服务器可以开多个终端 Tab，一条 SSH 连接复用多个 Channel：

```
用户操作:
  prod-server [Tab 1] [Tab 2] [+]

后端对应:
  SSHClientConnection (一条 TCP 连接)
     ├── SSHProcess 1 + PTY  →  Tab 1
     └── SSHProcess 2 + PTY  →  Tab 2
```

```python
async def open_session(self, server_id: str) -> SSHSession:
    conn = self.connections.get(server_id)
    if not conn or conn.is_closed():
        server = await self.get_server(server_id)
        conn = await asyncssh.connect(
            server.host, port=server.port,
            username=server.username,
            client_keys=[server.key_path]
        )
        self.connections[server_id] = conn

    process = await conn.create_process(
        term_type='xterm-256color',
        term_size=(80, 24)
    )
    session = SSHSession(conn, process)
    self.sessions[session.id] = session
    return session
```

### 会话生命周期

```
  connect()
     │
     ▼
  创建 Connection ──→ 认证 ──→ create_process(PTY) ──→ 双向转发中
     │                 │                                    │
     │ 失败             │ 失败                          keepalive 心跳
     ▼                 ▼                                    │
  返回错误          返回错误                             心跳超时？
  (连不上)         (认证失败)                          ┌────┴────┐
                                                      │ 是      │ 否
                                                      ▼         │
                                                  标记断开      继续
                                                  通知前端
                                                  尝试重连
```

### PTY 处理

**a) 终端尺寸同步**

```
xterm.js resize 事件
       │
       │ WS: {"type": "resize", "cols": 120, "rows": 40}
       ▼
    后端收到
       │
       │ process.change_terminal_size(120, 40)
       ▼
    远程 Shell 感知到窗口变化
    (vim、top 等程序自动适配)
```

**b) PTY 参数**

```python
process = await conn.create_process(
    term_type='xterm-256color',  # 匹配 xterm.js
    term_size=(80, 24),          # 初始尺寸
)
```

**c) 数据流与 AI 旁路**

```
远程 Shell 输出 (bytes)
       │
       ├──→ 原样转发给 xterm.js (保留 ANSI 转义码、颜色)
       │
       └──→ 旁路拷贝到 OutputBuffer
            strip ANSI → 纯文本
            供 AI 读取
```

### 输出缓冲（供 AI 读取）

```
OutputBuffer (环形缓冲，默认保留最近 1000 行)
┌──────────────────────────────────────┐
│ root@prod:~# df -h                   │
│ Filesystem  Size  Used  Avail  Use%  │
│ /dev/sda1    50G   32G    18G   64%  │
│ /dev/sdb1   200G  180G    20G   90%  │
│ root@prod:~# ▊                       │
└──────────────────────────────────────┘

AI 服务调用: session.output_buffer.get_recent(lines=settings.context_lines)
→ 返回最近 N 行纯文本，已 strip ANSI
→ context_lines 用户可在设置中调整（默认 50）
```

### 断线重连

```
检测断开:
  ├── asyncssh 内置 keepalive (keepalive_interval=15)
  ├── WebSocket 心跳 (ping/pong)
  └── process.stdout.at_eof()

断开后:
  后端:
    1. 标记 session 状态为 disconnected
    2. 通知前端: WS send status
    3. 启动重连: 间隔 1s → 2s → 4s → 8s，最多 5 次
    4. 重连成功 → 新建连接 + PTY，通知前端 reconnected
    5. 重连失败 → 通知前端 connection_lost，用户手动重连

  前端:
    disconnected    → 终端覆盖层: "连接已断开，正在重连... (2/5)"
    reconnected     → 移除覆盖层
    connection_lost → 显示 [重新连接] 按钮
```

注意：重连后 Shell 环境会丢失（当前目录、环境变量、运行中的进程），这是 SSH 的本质限制。进阶方案是远程用 tmux/screen 持久化会话。

### WebSocket 协议

```
前端 → 后端:
  { "type": "input",  "data": "ls -la\r" }       # 键盘输入
  { "type": "resize", "cols": 120, "rows": 40 }   # 尺寸变化

后端 → 前端:
  { "type": "output", "data": "..." }              # 终端输出 (含 ANSI)
  { "type": "status", "status": "connected" }
  { "type": "status", "status": "disconnected",
    "retry": 2, "max_retry": 5 }
  { "type": "status", "status": "reconnected" }
  { "type": "status", "status": "connection_lost" }
```

---

## AI 与终端联动机制

### LLM 选型：直接用 anthropic SDK（而非 LangChain）

AI 逻辑本质是：组装 prompt → 调 Claude API (带 tool use) → 流式返回 → 提取命令。LangChain 的抽象（Chain、Agent、Memory）在这里全用不上，反而增加依赖和调试复杂度。

| | anthropic SDK | LangChain |
|---|---|---|
| 核心代码量 | ~50 行 | ~50 行（但藏在抽象后面） |
| 依赖 | 1 个包 | langchain + langchain-anthropic + 大量子依赖 |
| 调试 | 直接看 request/response | 需穿透多层抽象 |
| 流式输出 | SDK 原生支持 | 需要 streaming callback |
| Tool Use | SDK 原生支持 | 包了一层，写法不同，调同一个 API |
| 升级风险 | SDK 稳定 | LangChain Breaking change 频繁 |

将来如果需要 RAG（如搜索历史命令），再引入也不迟。

### 上下文采集

AI 需要的信息分三层：

**a) 静态信息（连接时采集一次）**

```
OS:        Ubuntu 22.04 LTS
Hostname:  prod-web-01
User:      root
Shell:     /bin/bash
```

连接成功后，后端通过单独的 `exec_command`（非 PTY channel）静默执行探测命令：

```python
PROBE_COMMANDS = [
    "uname -a",
    "echo $SHELL",
    "cat /etc/os-release | head -5",
    "whoami",
]

async def probe_server(conn):
    info = {}
    for cmd in PROBE_COMMANDS:
        result = await conn.run(cmd)
        info[cmd] = result.stdout.strip()
    return ServerInfo(info)
```

**b) 动态信息（每次对话实时获取）**

```
CWD: /var/log/nginx
```

采集方式：解析 shell prompt（如 `root@prod:/var/log#`），或后台静默执行 `pwd`。

**c) 终端输出（OutputBuffer）**

最近 N 行纯文本（已 strip ANSI），包含用户执行过的命令和对应输出。

### Prompt 组装

每次用户在 AI 面板发消息，后端组装完整 prompt：

```
┌─ System Prompt ──────────────────────────────────────┐
│ 你是一个 Linux 运维助手。                              │
│ - 根据用户意图生成 shell 命令                          │
│ - 必须用 tool use 返回命令                             │
│ - 评估命令的风险等级                                   │
│ - 危险操作（rm -rf, DROP, mkfs 等）必须标记 high       │
│ - 不要编造不确定的命令                                 │
└──────────────────────────────────────────────────────┘

┌─ 机器上下文 ─────────────────────────────────────────┐
│ 当前连接: root@prod-web-01                            │
│ OS: Ubuntu 22.04 LTS (x86_64)                        │
│ Shell: /bin/bash                                     │
│ 当前目录: /var/log/nginx                              │
└──────────────────────────────────────────────────────┘

┌─ 终端上下文（最近输出）──────────────────────────────┐
│ <terminal_output>                                    │
│ root@prod:~# cd /var/log/nginx                       │
│ root@prod:/var/log/nginx# ls -la                     │
│ total 1240                                           │
│ -rw-r----- 1 root adm  523K Feb 26 access.log       │
│ -rw-r----- 1 root adm  180K Feb 26 error.log        │
│ root@prod:/var/log/nginx#                            │
│ </terminal_output>                                   │
└──────────────────────────────────────────────────────┘

┌─ 对话历史 ───────────────────────────────────────────┐
│ User: 这台机器跑的什么服务                             │
│ AI: 从 nginx 日志目录判断，跑了 Nginx。建议执行...     │
│ User: 看看 error log 最后几行                         │
└──────────────────────────────────────────────────────┘
```

### Token 预算管理

```
总 Token 预算（单次请求）
├── System Prompt:      ~300 tokens   (固定)
├── 机器上下文:          ~100 tokens   (固定)
├── 终端输出:           ~2000 tokens   (可变，核心)
├── 对话历史:           ~1500 tokens   (可变，滚动)
├── 用户当前消息:        ~100 tokens   (可变)
└── 总计控制在 ~4000 tokens 输入
```

**终端输出截取策略：**

| 场景 | 策略 |
|------|------|
| 输出很短（< context_lines） | 全部送入 |
| 输出很长（> context_lines） | 保留最近 N 行，开头加 `[... 省略了前 X 行 ...]` |
| 用户说"分析完整输出" | 扩大到最近 200 行 |
| 需要搜索更早的输出 | AI 调用 `search_terminal_output` 工具搜索 1000 行缓冲区 |

```python
def get_terminal_context(session, max_lines=None, expanded=False):
    if max_lines is None:
        max_lines = settings.get("context_lines", 50)  # 用户可配置
    if expanded:
        max_lines = min(max_lines * 4, 1000)  # 扩展模式：4 倍，上限 1000
    buffer = session.output_buffer
    total = buffer.total_lines
    lines = buffer.get_recent(max_lines)
    if total > max_lines:
        header = f"[... 省略了前 {total - max_lines} 行 ...]\n"
        return header + "\n".join(lines)
    return "\n".join(lines)
```

**对话历史滚动策略：**

```python
conversations = deque(maxlen=20)  # 20 条消息 = 10 轮对话
# 超过后最早的对话自动丢弃
```

### AI 响应格式（Tool Use）

用 Claude 的 tool use 获取结构化输出：

```python
tools = [{
    "name": "suggest_command",
    "description": "向用户建议一个 shell 命令",
    "input_schema": {
        "type": "object",
        "properties": {
            "thinking": {
                "type": "string",
                "description": "分析思路"
            },
            "command": {
                "type": "string",
                "description": "建议执行的命令"
            },
            "explanation": {
                "type": "string",
                "description": "命令的简要说明"
            },
            "risk_level": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "low=只读, medium=有修改, high=危险/不可逆"
            }
        },
        "required": ["command", "explanation", "risk_level"]
    }
}]
```

**Tool 2: search_terminal_output — 搜索历史终端输出**

AI 在需要时自主调用，在 OutputBuffer（最近 1000 行）中搜索关键字或正则：

```python
{
    "name": "search_terminal_output",
    "description": "在终端历史输出中搜索关键字，用于查找之前命令的输出内容",
    "input_schema": {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "搜索关键字或正则表达式"
            },
            "context_lines": {
                "type": "integer",
                "description": "匹配行前后各显示几行上下文",
                "default": 3
            }
        },
        "required": ["pattern"]
    }
}
```

后端实现：

```python
import re

def search_output_buffer(buffer: OutputBuffer, pattern: str, context_lines: int = 3):
    """在 OutputBuffer 中搜索，返回匹配行及上下文"""
    lines = buffer.get_all()  # 最近 1000 行
    results = []
    try:
        regex = re.compile(pattern, re.IGNORECASE)
    except re.error:
        regex = re.compile(re.escape(pattern), re.IGNORECASE)

    for i, line in enumerate(lines):
        if regex.search(line):
            start = max(0, i - context_lines)
            end = min(len(lines), i + context_lines + 1)
            results.append({
                "line_number": i,
                "match": line,
                "context": lines[start:end]
            })

    # 限制返回量，防止 token 爆炸
    if len(results) > 10:
        results = results[:10]
        results.append({"note": f"... 共 {len(results)} 处匹配，仅显示前 10 处"})

    return results
```

AI 交互示例：

```
用户: "刚才 apt install 那个报错是什么来着"

AI 的思考过程:
  1. 用户问的是之前的输出，不在默认 50 行上下文里
  2. 需要搜索更早的输出
  → 调用 search_terminal_output(pattern="apt.*error|E:")
  → 拿到匹配结果
  → 根据搜索结果回答用户
```

```
前端                        后端                           Claude API
 │                           │                               │
 │ "刚才那个报错是什么" ──→  │                               │
 │                           │ 组装 prompt ─────────────→   │
 │                           │                               │
 │                           │  ◀── tool_use ──────────────  │
 │                           │  search_terminal_output       │
 │                           │  { pattern: "error|fail" }    │
 │                           │                               │
 │                           │  执行 buffer 搜索              │
 │                           │  返回搜索结果给 Claude ──────→ │
 │                           │                               │
 │                           │  ◀── 最终文本回复 ───────────  │
 │  ◀── SSE: 回答 ────────  │                               │
```

注意：`search_terminal_output` 是 AI 自主使用的内部工具，用户不会直接看到调用过程。前端只需渲染 AI 的最终文本回复。

AI 返回 `suggest_command` 示例：

```json
{
  "thinking": "用户想查看 error log，当前在 /var/log/nginx 目录下",
  "command": "tail -50 error.log",
  "explanation": "查看 nginx error log 最后 50 行",
  "risk_level": "low"
}
```

### 前端命令卡片渲染

根据 risk_level 显示不同样式：

```
low    →  🟢 绿色边框，直接显示 [执行] 按钮
medium →  🟡 黄色边框，显示 [确认执行] 按钮
high   →  🔴 红色边框 + 警告图标，显示 ⚠️ 危险操作 [我确定要执行]
```

### 不返回命令的情况

不是每次 AI 都返回命令，有时只是回答问题：

```
用户: "nginx 配置文件一般在哪"
AI:   纯文本回答，无 tool_use → 前端只显示聊天消息

用户: "帮我重启 nginx"
AI:   tool_use suggest_command → 前端显示命令卡片
```

后端通过是否返回 tool_use 自动区分，前端不需要额外判断逻辑。

### 核心调用代码

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic()

# TOOLS = [suggest_command, search_terminal_output]
# suggest_command   → 返回给前端渲染命令卡片
# search_terminal_output → 后端本地执行，结果回传给 Claude 继续推理

async def chat(session: SSHSession, history: list, user_message: str):
    messages = [
        *history,
        {"role": "user", "content": user_message}
    ]

    while True:  # 循环处理 tool use（AI 可能连续调用多个工具）
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            system=f"{SYSTEM_PROMPT}\n\n{session.get_context()}",
            messages=messages,
            tools=TOOLS,
            max_tokens=1024,
        )

        # 检查是否有 tool use 需要处理
        tool_uses = [b for b in response.content if b.type == "tool_use"]

        if not tool_uses:
            # 没有 tool use，纯文本回复 → 流式返回给前端
            break

        for tool_use in tool_uses:
            if tool_use.name == "search_terminal_output":
                # 后端本地执行搜索，不发给前端
                result = search_output_buffer(
                    session.output_buffer,
                    tool_use.input["pattern"],
                    tool_use.input.get("context_lines", 3)
                )
                # 把搜索结果返回给 Claude 继续推理
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": json.dumps(result, ensure_ascii=False)
                    }]
                })
            elif tool_use.name == "suggest_command":
                # 命令建议 → 流式发给前端渲染
                yield tool_use  # 前端渲染命令卡片
                break
```

### 完整交互流程

```
前端                           后端                         Claude API
 │                              │                              │
 │ POST /assistant/chat         │                              │
 │ { session_id, message }  ──→ │                              │
 │                              │ 1. 获取 session 上下文        │
 │                              │    - server_info (静态)       │
 │                              │    - output_buffer (动态)     │
 │                              │    - conversation history     │
 │                              │                              │
 │                              │ 2. 组装 messages ────────→   │
 │                              │                              │
 │                              │    ◀── stream response ──── │
 │  ◀── SSE: text chunk ───── │                              │
 │  ◀── SSE: text chunk ───── │                              │
 │  ◀── SSE: tool_use ─────── │                              │
 │                              │                              │
 │  前端收到 tool_use:          │                              │
 │  渲染命令卡片                │                              │
 │  ┌─────────────────────┐    │                              │
 │  │ tail -50 error.log  │    │                              │
 │  │ 查看 error log 50行  │    │                              │
 │  │ 🟢 低风险            │    │                              │
 │  │ [执行] [编辑] [跳过]  │    │                              │
 │  └─────────────────────┘    │                              │
 │                              │                              │
 │  用户点击 [执行]             │                              │
 │  WS→ {"type":"input",       │                              │
 │   "data":"tail -50 error.log\r"} ─→ SSH PTY 执行           │
 │                              │                              │
 │  ◀── WS: output ─────────  │                              │
 │  xterm.js 渲染输出           │                              │
```

---

## 数据模型

### 存储选型：SQLite

单用户本地工具，SQLite 零配置、单文件、Python 内置。将来如果做多用户 SaaS 版本，迁移到 PostgreSQL 只需改连接串（SQL 语法 95% 兼容）。

### 实体关系

```
┌──────────────┐
│ ServerGroup  │
│ (服务器分组)  │
└──────┬───────┘
       │ 1:N
┌──────▼───────┐       ┌──────────────┐
│   Server     │ N:1   │   KeyPair    │
│ (服务器)      │──────→│  (SSH 密钥)   │
└──────┬───────┘       └──────────────┘
       │ 1:N
┌──────▼───────┐
│ CommandLog   │
│ (命令记录)    │
└──────────────┘

┌──────────────┐
│  Settings    │
│ (应用设置)    │
└──────────────┘
```

### 表结构

**1. server_groups — 服务器分组**

```sql
CREATE TABLE server_groups (
    id          TEXT PRIMARY KEY,  -- UUID
    name        TEXT NOT NULL,     -- "生产环境" / "测试环境"
    color       TEXT,              -- "#FF6B6B" 用于 UI 标识
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,     -- ISO 8601
    updated_at  TEXT NOT NULL
);
```

**2. keypairs — SSH 密钥**

```sql
CREATE TABLE keypairs (
    id               TEXT PRIMARY KEY,
    label            TEXT NOT NULL,      -- "我的工作密钥"
    private_key_path TEXT NOT NULL,      -- "/Users/glen/.ssh/id_rsa"
    public_key_path  TEXT,               -- 可选
    passphrase       TEXT,               -- 加密存储，见安全章节
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
```

注意：只存密钥**路径**，不存密钥内容。passphrase 如果用户选择保存，需加密存储。

**3. servers — 服务器**

```sql
CREATE TABLE servers (
    id            TEXT PRIMARY KEY,
    group_id      TEXT REFERENCES server_groups(id) ON DELETE SET NULL,
    label         TEXT NOT NULL,          -- "prod-web-01"
    host          TEXT NOT NULL,          -- "192.168.1.100" 或域名
    port          INTEGER DEFAULT 22,
    username      TEXT NOT NULL,          -- "root"
    auth_type     TEXT NOT NULL,          -- "key" | "password"
    key_id        TEXT REFERENCES keypairs(id) ON DELETE SET NULL,
    -- password 不存数据库，每次连接时输入（或用系统凭证存储）

    -- 可选配置
    proxy_jump    TEXT,                   -- 跳板机，如 "user@bastion:22"
    startup_cmd   TEXT,                   -- 连接后自动执行的命令
    notes         TEXT,                   -- 备注
    color         TEXT,                   -- 标签颜色

    sort_order        INTEGER DEFAULT 0,
    last_connected_at TEXT,               -- 最近连接时间，用于排序
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);
```

**4. command_logs — 命令执行记录**

```sql
CREATE TABLE command_logs (
    id             TEXT PRIMARY KEY,
    server_id      TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    session_id     TEXT NOT NULL,          -- 运行时 session ID，非持久化
    command        TEXT NOT NULL,          -- "tail -50 error.log"
    output_summary TEXT,                   -- AI 生成的输出摘要（可选）
    risk_level     TEXT,                   -- "low" | "medium" | "high"
    source         TEXT NOT NULL,          -- "manual" | "ai"
    executed_at    TEXT NOT NULL
);

CREATE INDEX idx_command_logs_server ON command_logs(server_id, executed_at);
```

**5. settings — 应用设置（KV 存储）**

```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 预置项:
-- api_key          → Claude API Key (加密存储)
-- model            → "claude-sonnet-4-20250514"
-- terminal_font    → "Monaco"
-- terminal_size    → "14"
-- theme            → "dark"
-- output_buffer    → "1000"  (OutputBuffer 环形缓冲总行数)
-- context_lines    → "50"   (每次送入 AI 的终端输出行数，用户可调)
-- max_chat_rounds  → "10"   (对话历史保留轮数)
```

### AI 对话历史：不持久化

AI 对话历史只在内存中保留，不写入 SQLite：

```
理由:
├── 强绑定当前 SSH session（session 断了，上下文就没意义了）
├── 量大但价值衰减快（10 分钟前的对话可能已经不相关）
└── 不需要跨会话搜索

实现:
├── 运行时: deque(maxlen=20) 在 SSHSession 对象里
├── session 关闭: 对话自动丢弃
└── 真正有价值的是 command_logs（持久化命令记录）
```

command_logs 才是值得保留的——将来可以做「这台机器上执行过什么」的查询，甚至作为 RAG 数据源。

### Python 模型（Pydantic）

```python
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class AuthType(str, Enum):
    KEY = "key"
    PASSWORD = "password"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class CommandSource(str, Enum):
    MANUAL = "manual"
    AI = "ai"

class ServerGroup(BaseModel):
    id: str
    name: str
    color: str | None = None
    sort_order: int = 0

class KeyPair(BaseModel):
    id: str
    label: str
    private_key_path: str
    public_key_path: str | None = None
    # passphrase 不出现在模型里，单独处理

class Server(BaseModel):
    id: str
    group_id: str | None = None
    label: str
    host: str
    port: int = 22
    username: str
    auth_type: AuthType
    key_id: str | None = None
    proxy_jump: str | None = None
    startup_cmd: str | None = None
    notes: str | None = None
    color: str | None = None
    last_connected_at: datetime | None = None

class CommandLog(BaseModel):
    id: str
    server_id: str
    session_id: str
    command: str
    output_summary: str | None = None
    risk_level: RiskLevel | None = None
    source: CommandSource
    executed_at: datetime
```

### API 与数据模型的对应

```
GET    /api/groups                → list[ServerGroup]
POST   /api/groups                → ServerGroup
PUT    /api/groups/{id}           → ServerGroup
DELETE /api/groups/{id}

GET    /api/servers               → list[Server]  (支持 ?group_id= 筛选)
POST   /api/servers               → Server
PUT    /api/servers/{id}          → Server
DELETE /api/servers/{id}

GET    /api/keypairs              → list[KeyPair]
POST   /api/keypairs              → KeyPair
PUT    /api/keypairs/{id}         → KeyPair
DELETE /api/keypairs/{id}

GET    /api/servers/{id}/commands → list[CommandLog]  (支持分页)
```

---

## 安全

### 敏感信息存储

三类敏感数据通过系统级安全存储，不存 SQLite：

| 敏感数据 | 存储方案 |
|----------|----------|
| SSH 私钥 | 只存路径，不存内容（私钥留在文件系统） |
| SSH passphrase | 系统凭证存储 |
| 服务器 password | 系统凭证存储（不存 SQLite） |
| Claude API Key | 系统凭证存储 |

使用 `keyring` 库，自动适配各平台后端：

| 平台 | keyring 后端 | 自动选择 |
|------|-------------|---------|
| macOS | Keychain | 自动 |
| Windows | Windows Credential Locker | 自动 |
| Linux | Secret Service (GNOME Keyring / KDE Wallet) | 自动 |

```python
import keyring

SERVICE_NAME = "llm-shell"

# 同一套代码，三个平台都能跑
keyring.set_password(SERVICE_NAME, "api_key", "sk-ant-xxx")
keyring.set_password(SERVICE_NAME, f"passphrase:{keypair_id}", "my-pass")
keyring.set_password(SERVICE_NAME, f"password:{server_id}", "root-pass")

api_key = keyring.get_password(SERVICE_NAME, "api_key")
keyring.delete_password(SERVICE_NAME, "api_key")
```

将来做 Tauri 桌面版时同样可用（Tauri 也支持系统 Keychain/Credential Store）。

### 本地网络安全

```python
# FastAPI 只监听本机
uvicorn.run(app, host="127.0.0.1", port=8765)

# CORS 只允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite 默认端口
    allow_methods=["*"],
    allow_headers=["*"],
)
```

关键原则：
- 绑定 `127.0.0.1`，绝不用 `0.0.0.0`
- CORS 白名单只放 localhost
- WebSocket 同样校验 Origin header
- SQLite 文件权限设为 `600`（仅 owner 可读写）

```python
import os
from platformdirs import user_data_dir

# 跨平台数据目录:
#   macOS:   ~/Library/Application Support/llm-shell/
#   Windows: C:\Users\x\AppData\Local\llm-shell\
#   Linux:   ~/.local/share/llm-shell/
DATA_DIR = user_data_dir("llm-shell")
DB_PATH = os.path.join(DATA_DIR, "data.db")
os.makedirs(DATA_DIR, exist_ok=True)
if os.name != "nt":  # Windows 用 ACL，不需要 chmod
    os.chmod(DB_PATH, 0o600)
```

### AI 安全护栏

**a) 危险命令黑名单**

```python
BLOCKED_PATTERNS = [
    r"rm\s+-rf\s+/\s*$",           # rm -rf /
    r"rm\s+-rf\s+/\w+\s*$",        # rm -rf /usr 等顶级目录
    r"mkfs\.",                       # 格式化磁盘
    r"dd\s+if=.*of=/dev/",          # dd 写磁盘
    r":\(\)\{.*\|.*&\s*\};:",       # fork bomb
    r">\s*/dev/sd[a-z]",            # 直接写磁盘设备
    r"chmod\s+-R\s+777\s+/",        # 全局权限修改
]

HIGH_RISK_PATTERNS = [
    r"shutdown|reboot|poweroff",    # 关机重启
    r"rm\s+-rf",                     # 递归删除（非根目录）
    r"DROP\s+TABLE|DROP\s+DATABASE", # 数据库删除
    r"truncate",                     # 清空文件/表
]
```

**b) 三级防护**

```
AI 返回命令
     │
     ▼
  后端安全检查 (check_command_safety)
     │
     ├── blocked → 直接拒绝，不显示执行按钮
     │              "该命令可能造成不可逆损害，已被拦截"
     │
     ├── high   → 红色警告卡片 + 需要用户输入确认文字
     │              "请输入服务器名称 prod-web-01 以确认执行"
     │
     └── pass   → 正常显示（low/medium 按 AI 标记处理）
```

**c) 执行频率限制**

```python
# 防止短时间内连续执行大量命令（误操作或前端 bug）
RATE_LIMIT = 10  # 每分钟最多执行 10 条 AI 建议的命令
```

### 数据安全

```
{platformdirs.user_data_dir}/llm-shell/
├── data.db          (chmod 600, Windows 用 ACL) — 服务器配置、命令记录
├── logs/            (chmod 700) — 应用日志
└── 密钥/密码        → 系统凭证存储（不在文件系统）

不存的东西:
├── SSH 私钥内容      → 只存路径引用
├── 终端输出完整记录  → 只在内存，不落盘（可能含敏感信息）
└── AI 对话历史      → 只在内存
```

---

## 项目目录结构

Monorepo，前后端放一个仓库。单一产品、本地工具、前后端紧耦合，无需分仓。

```
llm-shell/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口, uvicorn 启动
│   │   ├── config.py            # 配置管理 (Settings, platformdirs)
│   │   ├── database.py          # SQLite 连接, 建表
│   │   ├── routers/
│   │   │   ├── servers.py       # /api/servers, /api/groups, /api/keypairs
│   │   │   ├── sessions.py      # /api/sessions WebSocket
│   │   │   └── assistant.py     # /api/assistant/chat SSE
│   │   ├── services/
│   │   │   ├── ssh.py           # SessionManager, SSHSession, OutputBuffer
│   │   │   ├── ai.py            # Claude API 调用, prompt 组装, tool use 循环
│   │   │   └── security.py      # keyring 封装, 命令安全检查
│   │   └── models/
│   │       ├── schemas.py       # Pydantic 模型 (请求/响应)
│   │       └── database.py      # 数据库模型 / CRUD
│   ├── pyproject.toml           # Python 依赖
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ServerList/      # 左侧服务器列表
│   │   │   ├── Terminal/        # 中间终端 (xterm.js)
│   │   │   └── AiChat/         # 右侧 AI 对话面板
│   │   ├── hooks/               # useWebSocket, useSSE 等
│   │   ├── services/            # API 调用封装
│   │   └── types/               # TypeScript 类型
│   ├── package.json
│   └── vite.config.ts
│
├── README.md
└── Makefile                     # make dev, make build 等快捷命令
```

- **backend/app/** 按 routers / services / models 三层分，FastAPI 常见套路
- **frontend/src/components/** 按 UI 三栏布局划分
- **Makefile** 统一入口，`make dev` 同时启动前后端开发服务器

---

## 启动与部署

### 核心思路：前端构建成静态文件，FastAPI 统一 serve

单用户本地工具，不需要 Docker。构建后只有一个 Python 进程，用户一条命令启动。

```
make build 做的事:
  1. cd frontend && npm run build    → frontend/dist/
  2. 拷贝 dist/ → backend/app/static/

make run 做的事:
  1. cd backend && python -m app     → localhost:8765
     FastAPI 同时 serve:
       /api/*      → 业务接口
       /*          → 静态文件 (React SPA)
```

```python
# main.py
from fastapi.staticfiles import StaticFiles

# API 路由先注册，静态文件兜底
app.include_router(servers_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")

# React SPA: 所有非 /api 请求返回 index.html
app.mount("/", StaticFiles(directory="static", html=True))
```

### 三种使用场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 开发 | `make dev` | Vite 热更新 (5173) + uvicorn --reload (8765)，并行启动 |
| 生产 | `make build && make run` | 构建前端 → FastAPI 单进程 serve 全部 |
| Docker（后期） | `docker-compose up` | 面向企业用户，后期再加 |

---

## 错误处理

### 核心原则

1. **后端统一格式** — 所有错误都是 `{ error: { code, message } }`，前端不需要猜
2. **code 给机器，message 给人** — 前端根据 code 决定展示方式，message 直接给用户看
3. **可重试的自动重试** — Claude API 限流/超时自动重试 2 次，SSH 断线自动重连
4. **不可重试的给用户明确指引** — "请检查密钥"、"请在设置中更新 API Key"

### 统一错误响应格式

```json
{
    "error": {
        "code": "SSH_AUTH_FAILED",
        "message": "认证失败，请检查密钥或密码",
        "detail": "..."
    }
}
```

### 后端异常体系

```python
# app/exceptions.py

class AppError(Exception):
    """业务异常基类"""
    def __init__(self, code: str, message: str, status_code: int = 400, detail: str = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.detail = detail

class SSHError(AppError):
    """SSH 相关异常"""
    pass

class AIError(AppError):
    """AI 服务异常"""
    pass

# FastAPI 全局异常处理
@app.exception_handler(AppError)
async def app_error_handler(request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {
            "code": exc.code,
            "message": exc.message,
            "detail": exc.detail,
        }}
    )

# 兜底：未预期的异常
@app.exception_handler(Exception)
async def unexpected_error_handler(request, exc: Exception):
    logger.exception("Unexpected error")  # 记日志，含 traceback
    return JSONResponse(
        status_code=500,
        content={"error": {
            "code": "INTERNAL_ERROR",
            "message": "服务内部错误，请查看日志",
        }}
    )
```

### SSH 错误分类映射

```python
# services/ssh.py

SSH_ERROR_MAP = {
    # asyncssh 异常             →  code                     message
    "ConnectionRefused":        ("SSH_CONN_REFUSED",        "无法连接，请检查地址和端口"),
    "HostKeyNotVerifiable":     ("SSH_HOST_KEY_INVALID",    "主机密钥验证失败"),
    "PermissionDenied":         ("SSH_AUTH_FAILED",         "认证失败，请检查用户名/密钥/密码"),
    "ConnectionLost":           ("SSH_CONN_LOST",           "连接已断开"),
    "ChannelOpenError":         ("SSH_CHANNEL_FAILED",      "无法打开终端通道"),
}

async def open_session(self, server_id: str) -> SSHSession:
    try:
        conn = await asyncssh.connect(...)
    except asyncssh.DisconnectError as e:
        mapped = SSH_ERROR_MAP.get(type(e).__name__)
        if mapped:
            raise SSHError(mapped[0], mapped[1], status_code=502, detail=str(e))
        raise SSHError("SSH_UNKNOWN", f"SSH 错误: {e}", status_code=502)
```

### Claude API 错误处理（含重试）

```python
# services/ai.py

MAX_RETRIES = 2
RETRY_DELAYS = [1, 3]  # 秒

async def call_claude(messages, tools):
    for attempt in range(MAX_RETRIES + 1):
        try:
            return await client.messages.create(
                model="claude-sonnet-4-20250514",
                messages=messages, tools=tools,
                max_tokens=1024, timeout=30,
            )

        # 不可重试 → 立即抛出
        except AuthenticationError:
            raise AIError("AI_AUTH_FAILED", "API Key 无效，请在设置中更新",
                         status_code=401)

        # 可重试 → 重试后降级
        except RateLimitError:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAYS[attempt])
                continue
            raise AIError("AI_RATE_LIMITED", "AI 服务繁忙，请稍后重试",
                         status_code=429)

        except APITimeoutError:
            if attempt < MAX_RETRIES:
                continue
            raise AIError("AI_TIMEOUT", "AI 响应超时，请重试", status_code=504)

        except (APIConnectionError, InternalServerError):
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAYS[attempt])
                continue
            raise AIError("AI_UNAVAILABLE", "AI 服务暂时不可用", status_code=502)
```

### WebSocket 错误处理

WebSocket 不走 HTTP 状态码，用消息协议内的 error 类型：

```python
# routers/sessions.py

@router.websocket("/sessions/{server_id}/terminal")
async def terminal_ws(ws: WebSocket, server_id: str):
    await ws.accept()
    try:
        session = await session_manager.open_session(server_id)
        # ... 双向转发 ...
    except SSHError as e:
        await ws.send_json({"type": "error", "code": e.code, "message": e.message})
        await ws.close()
    except Exception as e:
        logger.exception(f"WebSocket error: {server_id}")
        await ws.send_json({"type": "error", "code": "INTERNAL_ERROR",
                           "message": "内部错误"})
        await ws.close()
```

### 前端展示策略

| 错误类型 | 展示方式 |
|----------|----------|
| SSH 连接错误 | 终端覆盖层，显示错误消息 + 重连按钮 |
| AI 服务错误 | AI 聊天面板内显示错误气泡 |
| 表单校验错误 | 表单字段下方红字 |
| CRUD 操作失败 | Toast 提示（右上角，3 秒自动消失） |
| 网络断开（后端挂了） | 全局 Banner: "与服务端的连接已断开" |

```typescript
// services/api.ts — 前端统一请求封装

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json();
    throw new ApiError(body.error.code, body.error.message);
  }
  return res.json();
}
```

### 错误码一览

| Code | 来源 | 含义 | 可重试 |
|------|------|------|--------|
| `SSH_CONN_REFUSED` | SSH | 连接被拒绝 | 手动 |
| `SSH_AUTH_FAILED` | SSH | 认证失败 | 改凭证后重试 |
| `SSH_HOST_KEY_INVALID` | SSH | 主机密钥不匹配 | 用户确认后重试 |
| `SSH_CONN_LOST` | SSH | 连接断开 | 自动重连 |
| `SSH_CHANNEL_FAILED` | SSH | 通道打开失败 | 手动 |
| `AI_AUTH_FAILED` | Claude | API Key 无效 | 更新 Key |
| `AI_RATE_LIMITED` | Claude | 请求过多 | 自动重试 2 次 |
| `AI_TIMEOUT` | Claude | 响应超时 | 自动重试 2 次 |
| `AI_UNAVAILABLE` | Claude | 服务不可用 | 自动重试 2 次 |
| `VALIDATION_ERROR` | 应用 | 参数校验失败 | 修改后重试 |
| `NOT_FOUND` | 应用 | 资源不存在 | 否 |
| `INTERNAL_ERROR` | 应用 | 未预期异常 | 否，查日志 |

---

## 前端状态管理

### 方案：Zustand + TanStack Query

| 职责 | 方案 | 理由 |
|------|------|------|
| 服务端状态（servers, groups, keypairs） | TanStack Query | 自动管理缓存、loading/error、mutation 后刷新 |
| 客户端状态（sessions, UI） | Zustand | 轻量 <1KB，无 Provider 嵌套，API 简洁 |

不选 Redux（样板代码太多），不选纯 Context（多 Context 嵌套 + re-render 性能问题）。

### 状态归属总览

```
┌─────────────────────────────────────────────────────────┐
│  TanStack Query (服务端状态)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ servers  │  │  groups  │  │ keypairs │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  自动缓存 · loading/error · mutation 后刷新              │
├─────────────────────────────────────────────────────────┤
│  Zustand sessionStore (客户端运行时状态)                  │
│  ┌──────────────────────────────────────────┐           │
│  │ sessions: { id → Session }              │           │
│  │ activeSessionId                          │           │
│  │ Session: { status, ws, chatMessages }   │           │
│  └──────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────┤
│  Zustand uiStore (UI 状态)                               │
│  ┌──────────────────────────────────────────┐           │
│  │ settingsOpen, serverFormOpen, ...        │           │
│  └──────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────┤
│  组件本地状态 (useState)                                  │
│  表单输入值、hover 状态、临时 UI 状态                      │
└─────────────────────────────────────────────────────────┘

不需要 React 管理的:
  xterm.js 实例 → useRef，xterm 自己管渲染
  WebSocket 连接 → useRef + useEffect 生命周期
```

### 服务端状态（TanStack Query）

```typescript
// hooks/useServers.ts

// 查询
export function useServers(groupId?: string) {
  return useQuery({
    queryKey: ['servers', { groupId }],
    queryFn: () => api.getServers(groupId),
  });
}

// 新增 — mutation 成功后自动刷新列表
export function useCreateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createServer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  });
}

// 组件中使用
function ServerList() {
  const { data: servers, isLoading, error } = useServers();
  if (isLoading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  return servers.map(s => <ServerItem key={s.id} server={s} />);
}
```

### 客户端状态 — sessionStore（Zustand）

```typescript
// stores/sessionStore.ts

interface Session {
  id: string;
  serverId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  ws: WebSocket | null;
  chatMessages: ChatMessage[];
}

interface SessionState {
  sessions: Record<string, Session>;
  activeSessionId: string | null;

  openSession: (serverId: string) => void;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  updateStatus: (sessionId: string, status: Session['status']) => void;
  addChatMessage: (sessionId: string, message: ChatMessage) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  openSession: (serverId) => {
    const id = crypto.randomUUID();
    set(state => ({
      sessions: {
        ...state.sessions,
        [id]: { id, serverId, status: 'connecting', ws: null, chatMessages: [] }
      },
      activeSessionId: id,
    }));
  },

  closeSession: (sessionId) => {
    const session = get().sessions[sessionId];
    session?.ws?.close();
    set(state => {
      const { [sessionId]: _, ...rest } = state.sessions;
      const ids = Object.keys(rest);
      return {
        sessions: rest,
        activeSessionId: ids.length > 0 ? ids[ids.length - 1] : null,
      };
    });
  },

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  updateStatus: (sessionId, status) =>
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { ...state.sessions[sessionId], status }
      }
    })),

  addChatMessage: (sessionId, message) =>
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId],
          chatMessages: [...state.sessions[sessionId].chatMessages, message]
        }
      }
    })),
}));
```

### 客户端状态 — uiStore（Zustand）

```typescript
// stores/uiStore.ts

interface UIState {
  settingsOpen: boolean;
  serverFormOpen: boolean;
  editingServerId: string | null;

  openSettings: () => void;
  closeSettings: () => void;
  openServerForm: (serverId?: string) => void;
  closeServerForm: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  serverFormOpen: false,
  editingServerId: null,

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openServerForm: (id) => set({ serverFormOpen: true, editingServerId: id ?? null }),
  closeServerForm: () => set({ serverFormOpen: false, editingServerId: null }),
}));
```

---

## SSH Config 导入

### 用户流程

```
设置页 → [导入 SSH Config] 按钮
    │
    ▼
后端解析 ~/.ssh/config
    │
    ▼
返回预览列表（前端展示勾选框）
    │
    ▼
用户勾选要导入的 → 确认导入
    │
    ▼
写入 servers + keypairs 表
```

### 字段映射

```
Host prod-web-01              →  label: "prod-web-01"
    HostName 192.168.1.100    →  host: "192.168.1.100"
    User root                 →  username: "root"
    Port 2222                 →  port: 2222
    IdentityFile ~/.ssh/id_rsa → keypair (自动创建记录)
    ProxyJump bastion         →  proxy_jump: "bastion"
```

### API

```
GET  /api/import/ssh-config/preview    → 解析并返回预览列表
POST /api/import/ssh-config            → { selected: [...] } 确认导入选中的
```

### 后端解析实现

```python
# services/ssh_config.py

import os
from pathlib import Path

def parse_ssh_config(config_path: str = None) -> list[dict]:
    """解析 SSH config，返回服务器列表"""
    if config_path is None:
        config_path = Path.home() / ".ssh" / "config"

    if not Path(config_path).exists():
        return []

    hosts = []
    current = None

    with open(config_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            if line.lower().startswith('host '):
                if current:
                    hosts.append(current)
                host_pattern = line.split(None, 1)[1]
                # 跳过通配符
                if '*' in host_pattern or '?' in host_pattern:
                    current = None
                    continue
                current = {'label': host_pattern}
            elif current is not None:
                key, _, value = line.partition(' ')
                key = key.strip().lower()
                value = value.strip()
                field_map = {
                    'hostname':     'host',
                    'user':         'username',
                    'port':         'port',
                    'identityfile': 'identity_file',
                    'proxyjump':    'proxy_jump',
                }
                if key in field_map:
                    current[field_map[key]] = value

    if current:
        hosts.append(current)

    # 展开 ~ 路径
    for h in hosts:
        if 'identity_file' in h:
            h['identity_file'] = os.path.expanduser(h['identity_file'])

    return hosts
```

### 边界情况处理

| 情况 | 处理 |
|------|------|
| `Host *` / `Host staging-*` 通配符 | 跳过，不导入 |
| 没有 HostName 的 Host | label 当 host 用（SSH 也是这么做的） |
| IdentityFile 引用的密钥 | 自动创建 keypair 记录（去重，同路径不重复创建） |
| 已存在相同 host+port+username | 标记"已存在"，默认不勾选，可选覆盖 |
| `Include` 指令 | 递归解析被 include 的文件 |
| Windows 用户 | 路径改为 `%USERPROFILE%\.ssh\config` |

---

## 文件传输（SFTP）

### MVP 方案：AI 驱动的上传/下载（不做文件浏览器）

asyncssh 原生支持 SFTP，复用现有 SSH 连接，后端零额外成本。MVP 不做完整文件浏览器 UI（那是后期功能），而是通过 AI tool 集成到对话流程中。

### AI Tools

```python
{
    "name": "download_file",
    "description": "从远程服务器下载文件到用户本地",
    "input_schema": {
        "properties": {
            "remote_path": { "type": "string", "description": "远程文件路径" }
        },
        "required": ["remote_path"]
    }
},
{
    "name": "upload_file",
    "description": "上传本地文件到远程服务器",
    "input_schema": {
        "properties": {
            "remote_path": { "type": "string", "description": "远程目标路径" }
        },
        "required": ["remote_path"]
    }
}
```

### 交互流程

```
下载:
  用户: "把 nginx 配置下载下来"
  AI → download_file { remote_path: "/etc/nginx/nginx.conf" }
  后端: SFTP 下载到临时目录 → 返回下载 URL
  前端: 触发浏览器下载

上传:
  用户: "把这个配置文件传到 /etc/app/"
  AI → upload_file { remote_path: "/etc/app/config.yaml" }
  前端: 弹出文件选择框 → 用户选文件 → POST 到后端
  后端: 接收文件 → SFTP 上传到远程服务器 → 返回结果
```

### 后端实现

```python
# services/sftp.py

async def download_file(conn, remote_path: str) -> str:
    """SFTP 下载，返回本地临时文件路径"""
    async with conn.start_sftp_client() as sftp:
        local_path = tempfile.mktemp(suffix=Path(remote_path).name)
        await sftp.get(remote_path, local_path)
        return local_path

async def upload_file(conn, local_path: str, remote_path: str):
    """SFTP 上传"""
    async with conn.start_sftp_client() as sftp:
        await sftp.put(local_path, remote_path)
```

### API

```
GET  /api/sessions/{session_id}/download?path=/etc/nginx/nginx.conf  → 文件流
POST /api/sessions/{session_id}/upload?path=/etc/app/config.yaml     → multipart 上传
```

### 版本规划

| 版本 | 功能 |
|------|------|
| MVP | AI 驱动上传/下载，输入路径即可 |
| 后期 | 完整文件浏览器 UI（目录树、拖拽、权限显示） |

---

## 多命令执行

### AI Tool：suggest_commands（复数）

现有 `suggest_command` 保留（单条场景），新增 `suggest_commands` 用于多步操作：

```python
{
    "name": "suggest_commands",
    "description": "向用户建议一组按顺序执行的命令",
    "input_schema": {
        "type": "object",
        "properties": {
            "thinking": {
                "type": "string",
                "description": "整体分析思路"
            },
            "commands": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" },
                        "explanation": { "type": "string" },
                        "risk_level": { "type": "string", "enum": ["low", "medium", "high"] }
                    },
                    "required": ["command", "explanation", "risk_level"]
                }
            }
        },
        "required": ["commands"]
    }
}
```

AI 返回示例：

```json
{
  "thinking": "用户要部署新版本，需要拉代码、装依赖、重启服务",
  "commands": [
    { "command": "cd /opt/app && git pull origin main", "explanation": "拉取最新代码", "risk_level": "low" },
    { "command": "pip install -r requirements.txt", "explanation": "安装依赖", "risk_level": "low" },
    { "command": "python manage.py migrate", "explanation": "执行数据库迁移", "risk_level": "medium" },
    { "command": "systemctl restart app", "explanation": "重启应用服务", "risk_level": "high" }
  ]
}
```

### 前端命令列表卡片

```
┌─ AI 建议执行以下命令 ──────────────────────────────┐
│                                                      │
│  ┌─ 1 ─────────────────────────────── 🟢 low ───┐  │
│  │ cd /opt/app && git pull origin main            │  │
│  │ 拉取最新代码                                    │  │
│  │                     [执行] [编辑] [✕ 移除]      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 2 ─────────────────────────────── 🟢 low ───┐  │
│  │ pip install -r requirements.txt                │  │
│  │ 安装依赖                                       │  │
│  │                     [执行] [编辑] [✕ 移除]      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 3 ────────────────────────────── 🟡 medium ─┐  │
│  │ python manage.py migrate                       │  │
│  │ 执行数据库迁移                                  │  │
│  │                     [执行] [编辑] [✕ 移除]      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 4 ──────────────────────────────── 🔴 high ─┐  │
│  │ systemctl restart app                          │  │
│  │ ⚠️ 重启应用服务                                 │  │
│  │              [确认执行] [编辑] [✕ 移除]         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│           [▶ 全部执行] [▶ 逐条确认执行]              │
└──────────────────────────────────────────────────────┘
```

### 用户操作

| 操作 | 行为 |
|------|------|
| 单条 **[执行]** | 发送到终端 WS，执行完成后该条标记 ✅ |
| 单条 **[编辑]** | 命令变为可编辑输入框，用户修改后回车执行 |
| 单条 **[✕ 移除]** | 从列表中删除该条 |
| **[▶ 全部执行]** | 按顺序自动执行，遇到 high 级别暂停等确认 |
| **[▶ 逐条确认执行]** | 执行第 1 条 → 等用户点下一条 → 执行第 2 条 → ... |

### 全部执行流程

```
[▶ 全部执行]
    │
    ▼
  命令 1 (low) → 自动执行 → ✅ 完成
    │
    ▼
  命令 2 (low) → 自动执行 → ✅ 完成
    │
    ▼
  命令 3 (medium) → 自动执行 → ✅ 完成
    │
    ▼
  命令 4 (high) → ⏸ 暂停，弹出确认
                     ├── [确认] → 执行 → ✅ 完成
                     └── [跳过] → ⏭ 跳过

  任一命令执行出错 (exit code ≠ 0):
    → ⏸ 暂停，显示错误输出
    → [继续执行剩余] [停止]
```

### 前端状态

```typescript
interface CommandItem {
  id: string;
  command: string;
  explanation: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  edited: boolean;
}

// sessionStore 中扩展
interface Session {
  // ...现有字段
  commandQueue: CommandItem[] | null;  // 当前命令队列
}
```

### 命令完成检测

命令通过终端 WS 发送，需要知道"这条执行完了"才能执行下一条：

```
发送命令后，监听 OutputBuffer:
  1. 发送: "git pull origin main\r"
  2. 等待 shell prompt 重新出现 (如 root@prod:~# )
  3. prompt 出现 → 该命令执行完成 → 执行下一条

检测方式: 正则匹配连接时探测到的 prompt 模式
```

---

## 日志策略

### 基础框架

Python 标准 `logging` + `structlog` 结构化日志。开发环境彩色 console，生产环境 JSON 格式。

```
开发环境:  structlog ConsoleRenderer → 彩色终端输出
生产环境:  structlog JSONRenderer → RotatingFileHandler → 日志文件
```

依赖：

```
structlog
```

### 日志模块划分

| Logger 名称 | 覆盖范围 | 典型日志 |
|---|---|---|
| `llmshell.ssh` | SSH 连接生命周期 | 连接建立/断开/重连/认证失败 |
| `llmshell.ai` | Claude API 调用 | 请求发送/响应接收/token 用量/retry/错误 |
| `llmshell.ws` | WebSocket 会话 | 连接/断开/消息收发统计 |
| `llmshell.api` | REST API 请求 | FastAPI 中间件自动记录 |
| `llmshell.sftp` | 文件传输 | 上传/下载/进度/完成 |

### 日志级别

| 级别 | 用途 | 示例 |
|---|---|---|
| `ERROR` | 需要关注的错误 | SSH 认证失败、Claude API 500、WebSocket 异常断开 |
| `WARNING` | 可恢复的异常 | SSH 重连、API retry、命令执行超时 |
| `INFO` | 关键业务事件 | 连接建立、命令执行、AI 请求完成、文件传输完成 |
| `DEBUG` | 开发调试 | 完整请求/响应体、SSH 数据帧、WebSocket 原始消息 |

### 初始化配置

```python
import structlog
import logging
from logging.handlers import RotatingFileHandler
from platformdirs import user_log_dir

def setup_logging(debug: bool = False):
    log_level = logging.DEBUG if debug else logging.INFO

    # structlog 配置
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            SensitiveDataFilter(),  # 自定义：过滤敏感信息
            structlog.dev.ConsoleRenderer() if debug
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory() if debug
        else structlog.WriteLoggerFactory(
            file=open(_get_log_path(), "a")
        ),
    )

def _get_log_path():
    log_dir = user_log_dir("llmshell")
    os.makedirs(log_dir, exist_ok=True)
    return os.path.join(log_dir, "llmshell.log")
```

### 日志文件轮转

```python
# RotatingFileHandler 配置
max_bytes = 10 * 1024 * 1024  # 单文件 10MB
backup_count = 5               # 保留 5 个备份
# 日志目录: platformdirs.user_log_dir("llmshell")
# macOS:  ~/Library/Logs/llmshell/
# Linux:  ~/.local/state/llmshell/log/
```

### 敏感信息过滤

```python
class SensitiveDataFilter:
    """structlog processor: 过滤日志中的敏感信息"""

    SENSITIVE_KEYS = {"password", "private_key", "passphrase", "api_key", "token"}

    def __call__(self, logger, method_name, event_dict):
        for key in list(event_dict.keys()):
            if key in self.SENSITIVE_KEYS:
                value = str(event_dict[key])
                event_dict[key] = f"***{value[-4:]}" if len(value) > 4 else "***"
        return event_dict
```

过滤规则：

| 数据类型 | 处理方式 |
|---|---|
| 密码 / 私钥内容 | 完全脱敏，只显示 `***` |
| API Key | 只保留后 4 位：`***abcd` |
| 终端输出 | INFO 级别只记录行数，DEBUG 级别记录内容 |
| 用户输入（chat） | INFO 级别记录长度，DEBUG 级别记录内容 |

### AI Token 用量日志

每次 Claude API 调用自动记录 token 消耗，方便追踪成本：

```python
logger = structlog.get_logger("llmshell.ai")

# 每次 API 调用后
logger.info(
    "claude_api_complete",
    model=response.model,
    input_tokens=response.usage.input_tokens,
    output_tokens=response.usage.output_tokens,
    stop_reason=response.stop_reason,
    duration_ms=elapsed_ms,
)

# JSON 输出示例:
# {
#   "event": "claude_api_complete",
#   "model": "claude-sonnet-4-20250514",
#   "input_tokens": 1520,
#   "output_tokens": 234,
#   "stop_reason": "tool_use",
#   "duration_ms": 1830,
#   "timestamp": "2025-01-15T10:23:45Z",
#   "level": "info"
# }
```

### 各模块日志示例

```python
# SSH 模块
ssh_log = structlog.get_logger("llmshell.ssh")
ssh_log.info("ssh_connected", server_id="abc123", host="prod-web-01", port=22)
ssh_log.warning("ssh_reconnecting", server_id="abc123", attempt=2, reason="connection lost")
ssh_log.error("ssh_auth_failed", server_id="abc123", auth_method="publickey")

# WebSocket 模块
ws_log = structlog.get_logger("llmshell.ws")
ws_log.info("ws_session_start", session_id="s1", server_id="abc123")
ws_log.info("ws_session_end", session_id="s1", duration_sec=3600, messages_sent=42)

# API 模块 (FastAPI 中间件)
api_log = structlog.get_logger("llmshell.api")
api_log.info("http_request", method="POST", path="/api/servers", status=201, duration_ms=15)
```

---

## 架构设计完成

- [x] 整体模块划分 — 前后端职责分离
- [x] SSH 连接管理 — asyncssh、多会话、断线重连、PTY 处理
- [x] AI 与终端联动机制 — 上下文采集、prompt 组装、tool use、流式响应
- [x] 数据模型 — SQLite、5 张表、Pydantic 模型、REST API
- [x] 安全 — 系统凭证存储、本地网络限制、AI 命令护栏
- [x] 项目目录结构 — monorepo 单仓库
- [x] 启动与部署 — FastAPI 托管前端静态文件、Makefile
- [x] 错误处理 — AppError 体系、SSH 错误映射、API 重试、WebSocket 错误协议
- [x] 前端状态管理 — Zustand + TanStack Query
- [x] SSH Config 导入 — ~/.ssh/config 解析与选择性导入
- [x] 文件传输（SFTP） — AI 驱动的上传/下载
- [x] 多命令执行 — suggest_commands、命令列表卡片、批量执行模式
- [x] 日志策略 — structlog 结构化日志、敏感信息过滤、token 用量追踪
