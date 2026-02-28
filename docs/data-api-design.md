# LLM Shell — 数据 & API 设计文档

> Track A 交付物。前后端开发的共享契约，所有端点、数据结构、协议定义以本文为准。

---

## A1. 数据库 Schema

存储引擎：SQLite。数据文件位于 `platformdirs.user_data_dir("llm-shell")/data.db`，权限 `0o600`。

### 1.1 server_groups — 服务器分组

```sql
CREATE TABLE server_groups (
    id          TEXT PRIMARY KEY,          -- UUID v4
    name        TEXT NOT NULL,             -- "生产环境" / "测试环境"
    color       TEXT,                      -- "#FF6B6B" UI 标识色
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,             -- ISO 8601  "2025-01-15T10:23:45Z"
    updated_at  TEXT NOT NULL
);
```

### 1.2 keypairs — SSH 密钥

```sql
CREATE TABLE keypairs (
    id               TEXT PRIMARY KEY,
    label            TEXT NOT NULL,         -- "我的工作密钥"
    private_key_path TEXT NOT NULL,         -- 绝对路径 "/Users/x/.ssh/id_rsa"
    public_key_path  TEXT,                  -- 可选
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
-- passphrase 存 keyring，不进数据库
```

### 1.3 servers — 服务器

```sql
CREATE TABLE servers (
    id                TEXT PRIMARY KEY,
    group_id          TEXT REFERENCES server_groups(id) ON DELETE SET NULL,
    label             TEXT NOT NULL,         -- "prod-web-01"
    host              TEXT NOT NULL,         -- IP 或域名
    port              INTEGER NOT NULL DEFAULT 22,
    username          TEXT NOT NULL,         -- "root"
    auth_type         TEXT NOT NULL CHECK(auth_type IN ('key','password')),
    key_id            TEXT REFERENCES keypairs(id) ON DELETE SET NULL,
    proxy_jump        TEXT,                  -- "user@bastion:22"
    startup_cmd       TEXT,                  -- 连接后自动执行
    notes             TEXT,
    color             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    last_connected_at TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE INDEX idx_servers_group ON servers(group_id);
```

### 1.4 command_logs — 命令执行记录

```sql
CREATE TABLE command_logs (
    id             TEXT PRIMARY KEY,
    server_id      TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    session_id     TEXT NOT NULL,           -- 运行时 session ID
    command        TEXT NOT NULL,
    output_summary TEXT,                    -- AI 生成的输出摘要（可选）
    risk_level     TEXT CHECK(risk_level IN ('low','medium','high')),
    source         TEXT NOT NULL CHECK(source IN ('manual','ai')),
    executed_at    TEXT NOT NULL
);

CREATE INDEX idx_command_logs_server ON command_logs(server_id, executed_at DESC);
```

### 1.5 settings — 应用设置 (KV)

```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 预置项（首次建表时 INSERT）
-- key              | default value
-- -----------------+-----------------------------
-- model            | "claude-sonnet-4-20250514"
-- terminal_font    | "Monaco"
-- terminal_size    | "14"
-- theme            | "dark"
-- output_buffer    | "1000"
-- context_lines    | "50"
-- max_chat_rounds  | "10"
-- (api_key 存 keyring，不在此表)
```

---

## A2. 数据模型

### 2.1 枚举

```python
# Python
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
```

```typescript
// TypeScript
type AuthType = "key" | "password";
type RiskLevel = "low" | "medium" | "high";
type CommandSource = "manual" | "ai";
```

### 2.2 核心实体

#### ServerGroup

```python
# Python — 响应模型
class ServerGroupOut(BaseModel):
    id: str
    name: str
    color: str | None = None
    sort_order: int = 0
    created_at: str
    updated_at: str

# Python — 创建/更新请求
class ServerGroupIn(BaseModel):
    name: str
    color: str | None = None
    sort_order: int = 0
```

```typescript
// TypeScript
interface ServerGroup {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ServerGroupInput {
  name: string;
  color?: string | null;
  sort_order?: number;
}
```

#### KeyPair

```python
class KeyPairOut(BaseModel):
    id: str
    label: str
    private_key_path: str
    public_key_path: str | None = None
    created_at: str
    updated_at: str

class KeyPairIn(BaseModel):
    label: str
    private_key_path: str
    public_key_path: str | None = None
    passphrase: str | None = None  # 仅创建/更新时传入，存 keyring
```

```typescript
interface KeyPair {
  id: string;
  label: string;
  private_key_path: string;
  public_key_path: string | null;
  created_at: string;
  updated_at: string;
}

interface KeyPairInput {
  label: string;
  private_key_path: string;
  public_key_path?: string | null;
  passphrase?: string | null;
}
```

#### Server

```python
class ServerOut(BaseModel):
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
    sort_order: int = 0
    last_connected_at: str | None = None
    created_at: str
    updated_at: str

class ServerIn(BaseModel):
    group_id: str | None = None
    label: str
    host: str
    port: int = 22
    username: str
    auth_type: AuthType
    key_id: str | None = None
    password: str | None = None  # auth_type=password 时传入，存 keyring
    proxy_jump: str | None = None
    startup_cmd: str | None = None
    notes: str | None = None
    color: str | None = None
    sort_order: int = 0
```

```typescript
interface Server {
  id: string;
  group_id: string | null;
  label: string;
  host: string;
  port: number;
  username: string;
  auth_type: AuthType;
  key_id: string | null;
  proxy_jump: string | null;
  startup_cmd: string | null;
  notes: string | null;
  color: string | null;
  sort_order: number;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ServerInput {
  group_id?: string | null;
  label: string;
  host: string;
  port?: number;
  username: string;
  auth_type: AuthType;
  key_id?: string | null;
  password?: string | null;
  proxy_jump?: string | null;
  startup_cmd?: string | null;
  notes?: string | null;
  color?: string | null;
  sort_order?: number;
}
```

#### CommandLog

```python
class CommandLogOut(BaseModel):
    id: str
    server_id: str
    session_id: str
    command: str
    output_summary: str | None = None
    risk_level: RiskLevel | None = None
    source: CommandSource
    executed_at: str
```

```typescript
interface CommandLog {
  id: string;
  server_id: string;
  session_id: string;
  command: string;
  output_summary: string | null;
  risk_level: RiskLevel | null;
  source: CommandSource;
  executed_at: string;
}
```

#### Settings

```python
class SettingOut(BaseModel):
    key: str
    value: str

class SettingsAllOut(BaseModel):
    model: str
    terminal_font: str
    terminal_size: str
    theme: str
    output_buffer: str
    context_lines: str
    max_chat_rounds: str

class SettingsUpdateIn(BaseModel):
    """部分更新，只传需要改的字段"""
    model: str | None = None
    terminal_font: str | None = None
    terminal_size: str | None = None
    theme: str | None = None
    output_buffer: str | None = None
    context_lines: str | None = None
    max_chat_rounds: str | None = None
    api_key: str | None = None  # 存 keyring
```

```typescript
interface Settings {
  model: string;
  terminal_font: string;
  terminal_size: string;
  theme: string;
  output_buffer: string;
  context_lines: string;
  max_chat_rounds: string;
}

interface SettingsUpdate {
  model?: string;
  terminal_font?: string;
  terminal_size?: string;
  theme?: string;
  output_buffer?: string;
  context_lines?: string;
  max_chat_rounds?: string;
  api_key?: string;
}
```

### 2.3 AI 对话模型

```python
class ChatRequest(BaseModel):
    session_id: str
    message: str

class CommandSuggestion(BaseModel):
    command: str
    explanation: str
    risk_level: RiskLevel

class ChatResponse(BaseModel):
    """SSE 事件流中的单个事件 data 载荷"""
    type: Literal["text", "command", "commands", "error", "done"]
    # type=text 时
    content: str | None = None
    # type=command 时
    suggestion: CommandSuggestion | None = None
    # type=commands 时
    suggestions: list[CommandSuggestion] | None = None
    thinking: str | None = None
    # type=error 时
    error: ErrorDetail | None = None
```

```typescript
interface ChatRequest {
  session_id: string;
  message: string;
}

interface CommandSuggestion {
  command: string;
  explanation: string;
  risk_level: RiskLevel;
}

// SSE event.data 解析后的结构
type ChatEvent =
  | { type: "text"; content: string }
  | { type: "command"; suggestion: CommandSuggestion; thinking?: string }
  | { type: "commands"; suggestions: CommandSuggestion[]; thinking?: string }
  | { type: "error"; error: { code: string; message: string } }
  | { type: "done" };
```

### 2.4 SSH Config 导入模型

```python
class SSHConfigEntry(BaseModel):
    label: str                          # Host 别名
    host: str | None = None             # HostName（无则 label 当 host）
    username: str | None = None
    port: int = 22
    identity_file: str | None = None    # 展开后的绝对路径
    proxy_jump: str | None = None
    already_exists: bool = False        # 是否已有相同 host+port+username

class SSHConfigPreviewOut(BaseModel):
    entries: list[SSHConfigEntry]

class SSHConfigImportIn(BaseModel):
    selected: list[str]                 # 选中的 label 列表

class SSHConfigImportOut(BaseModel):
    imported: int                       # 成功导入数量
    servers: list[ServerOut]            # 新创建的服务器列表
```

```typescript
interface SSHConfigEntry {
  label: string;
  host: string | null;
  username: string | null;
  port: number;
  identity_file: string | null;
  proxy_jump: string | null;
  already_exists: boolean;
}

interface SSHConfigImportInput {
  selected: string[];
}

interface SSHConfigImportResult {
  imported: number;
  servers: Server[];
}
```

---

## A3. REST API 契约

基础路径：`/api`
Content-Type：`application/json`（SFTP 上传为 `multipart/form-data`）

### 3.0 通用

#### 分页参数（适用于列表接口）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `offset` | int | 0 | 跳过条数 |
| `limit` | int | 50 | 返回条数，最大 100 |

#### 统一错误响应

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "用户可读的错误描述",
    "detail": "可选的技术细节"
  }
}
```

#### 错误码总表

| Code | HTTP Status | 含义 | 可重试 |
|------|-------------|------|--------|
| `VALIDATION_ERROR` | 422 | 请求参数校验失败 | 修改后重试 |
| `NOT_FOUND` | 404 | 资源不存在 | 否 |
| `CONFLICT` | 409 | 资源冲突（如重复导入） | 否 |
| `SSH_CONN_REFUSED` | 502 | SSH 连接被拒绝 | 手动 |
| `SSH_AUTH_FAILED` | 502 | SSH 认证失败 | 改凭证后 |
| `SSH_HOST_KEY_INVALID` | 502 | 主机密钥不匹配 | 用户确认后 |
| `SSH_CONN_LOST` | 502 | SSH 连接断开 | 自动重连 |
| `SSH_CHANNEL_FAILED` | 502 | SSH 通道打开失败 | 手动 |
| `AI_AUTH_FAILED` | 401 | Claude API Key 无效 | 更新 Key |
| `AI_RATE_LIMITED` | 429 | Claude API 请求过多 | 自动重试 |
| `AI_TIMEOUT` | 504 | Claude API 响应超时 | 自动重试 |
| `AI_UNAVAILABLE` | 502 | Claude API 不可用 | 自动重试 |
| `COMMAND_BLOCKED` | 403 | 命令被安全策略拦截 | 否 |
| `INTERNAL_ERROR` | 500 | 未预期服务端异常 | 否 |

---

### 3.1 服务器分组

#### `GET /api/groups`

返回所有分组，按 sort_order 排序。

**Response** `200`
```json
[
  {
    "id": "g-uuid-1",
    "name": "生产环境",
    "color": "#FF6B6B",
    "sort_order": 0,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
]
```

#### `POST /api/groups`

**Request**
```json
{
  "name": "生产环境",
  "color": "#FF6B6B",
  "sort_order": 0
}
```

**Response** `201`
```json
{ "id": "g-uuid-1", "name": "生产环境", "..." : "..." }
```

#### `PUT /api/groups/{id}`

**Request** — 同 POST body（全量更新）

**Response** `200` — 更新后的 ServerGroup

**Error** `404` — `NOT_FOUND`

#### `DELETE /api/groups/{id}`

**Response** `204` — 无 body。关联 servers 的 group_id 置 NULL。

---

### 3.2 SSH 密钥

#### `GET /api/keypairs`

**Response** `200` — `KeyPairOut[]`（不含 passphrase）

#### `POST /api/keypairs`

**Request** — `KeyPairIn`（含可选 passphrase，存入 keyring）

**Response** `201` — `KeyPairOut`

#### `PUT /api/keypairs/{id}`

**Request** — `KeyPairIn`

**Response** `200` — `KeyPairOut`

#### `DELETE /api/keypairs/{id}`

**Response** `204`。同时从 keyring 删除对应 passphrase。关联 servers 的 key_id 置 NULL。

---

### 3.3 服务器

#### `GET /api/servers`

**Query 参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `group_id` | string? | 按分组筛选 |

**Response** `200` — `ServerOut[]`，按 sort_order 排序

#### `POST /api/servers`

**Request** — `ServerIn`（auth_type=password 时含 password 字段，存 keyring）

**Response** `201` — `ServerOut`

#### `PUT /api/servers/{id}`

**Request** — `ServerIn`

**Response** `200` — `ServerOut`

#### `DELETE /api/servers/{id}`

**Response** `204`。级联删除 command_logs，从 keyring 删除 password。

---

### 3.4 命令记录

#### `GET /api/servers/{server_id}/commands`

**Query 参数**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `offset` | int | 0 | |
| `limit` | int | 50 | 最大 100 |
| `source` | string? | | 筛选 "manual" 或 "ai" |

**Response** `200`
```json
{
  "items": [ CommandLogOut, ... ],
  "total": 128
}
```

---

### 3.5 应用设置

#### `GET /api/settings`

返回所有设置项（api_key 返回脱敏值 `"sk-***abcd"` 或空字符串）。

**Response** `200` — `SettingsAllOut`

#### `PATCH /api/settings`

部分更新。只传需要修改的字段。

**Request** — `SettingsUpdateIn`
```json
{
  "theme": "light",
  "api_key": "sk-ant-xxx..."
}
```

**Response** `200` — 更新后的 `SettingsAllOut`

---

### 3.6 SSH Config 导入

#### `GET /api/import/ssh-config/preview`

解析 `~/.ssh/config`，返回可导入的服务器列表。

**Response** `200` — `SSHConfigPreviewOut`
```json
{
  "entries": [
    {
      "label": "prod-web-01",
      "host": "192.168.1.100",
      "username": "root",
      "port": 2222,
      "identity_file": "/Users/x/.ssh/id_rsa",
      "proxy_jump": null,
      "already_exists": false
    },
    {
      "label": "staging-app",
      "host": "10.0.0.5",
      "username": "deploy",
      "port": 22,
      "identity_file": null,
      "proxy_jump": "bastion",
      "already_exists": true
    }
  ]
}
```

#### `POST /api/import/ssh-config`

确认导入用户勾选的条目。

**Request** — `SSHConfigImportIn`
```json
{
  "selected": ["prod-web-01", "staging-app"]
}
```

**Response** `200` — `SSHConfigImportOut`

行为：
- 为有 identity_file 的条目自动创建 keypair（路径去重）
- already_exists=true 的条目跳过（不覆盖）
- 返回实际导入数量和新创建的 Server 列表

---

### 3.7 SFTP 文件传输

#### `GET /api/sessions/{session_id}/download`

**Query 参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | string | 远程文件绝对路径 |

**Response** `200` — 文件流（`application/octet-stream`）
- Header `Content-Disposition: attachment; filename="nginx.conf"`

**Error** `404` — 远程文件不存在

#### `POST /api/sessions/{session_id}/upload`

**Query 参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | string | 远程目标绝对路径 |

**Request** — `multipart/form-data`，字段名 `file`

**Response** `200`
```json
{
  "remote_path": "/etc/app/config.yaml",
  "size": 2048
}
```

---

### 3.8 AI 对话

#### `POST /api/assistant/chat`

**Request** — `ChatRequest`
```json
{
  "session_id": "s-uuid-1",
  "message": "查看磁盘使用情况"
}
```

**Response** — `text/event-stream` (SSE)

SSE 事件流格式，每个事件为一行 `data: <json>`：

```
data: {"type":"text","content":"好的，我来帮你查看"}

data: {"type":"text","content":"磁盘使用情况。"}

data: {"type":"command","suggestion":{"command":"df -h","explanation":"以可读格式显示磁盘使用情况","risk_level":"low"},"thinking":"用户要查看磁盘，df -h 是标准做法"}

data: {"type":"done"}
```

多命令场景：

```
data: {"type":"text","content":"需要执行以下步骤来部署："}

data: {"type":"commands","suggestions":[{"command":"cd /opt/app && git pull origin main","explanation":"拉取最新代码","risk_level":"low"},{"command":"pip install -r requirements.txt","explanation":"安装依赖","risk_level":"low"},{"command":"systemctl restart app","explanation":"重启应用服务","risk_level":"high"}],"thinking":"用户要部署，需要拉代码、装依赖、重启"}

data: {"type":"done"}
```

错误场景：

```
data: {"type":"error","error":{"code":"AI_RATE_LIMITED","message":"AI 服务繁忙，请稍后重试"}}
```

**命令安全检查**：后端在返回 command/commands 事件前进行安全检查：
- 命中 BLOCKED_PATTERNS → 不返回该命令，替换为 text 事件告知用户被拦截
- 命中 HIGH_RISK_PATTERNS → risk_level 强制标记为 "high"（覆盖 AI 判断）

---

## A4. WebSocket 协议

### 4.1 终端会话

**连接地址**：`ws://localhost:8765/api/sessions/{server_id}/terminal`

连接成功后自动建立 SSH 连接并分配 PTY。

#### 客户端 → 服务端

**键盘输入**
```json
{ "type": "input", "data": "ls -la\r" }
```
- `data` 为原始字符（含 `\r` 回车、`\x03` Ctrl-C 等控制字符）

**终端尺寸变化**
```json
{ "type": "resize", "cols": 120, "rows": 40 }
```
- xterm.js fit addon 触发 → 前端发送 → 后端调用 `process.change_terminal_size()`

#### 服务端 → 客户端

**终端输出**
```json
{ "type": "output", "data": "\u001b[32mroot@prod\u001b[0m:~# " }
```
- `data` 含 ANSI 转义码，xterm.js 直接渲染

**连接状态**
```json
{ "type": "status", "status": "connected" }
```
```json
{ "type": "status", "status": "disconnected", "retry": 2, "max_retry": 5 }
```
```json
{ "type": "status", "status": "reconnected" }
```
```json
{ "type": "status", "status": "connection_lost" }
```

**错误**
```json
{ "type": "error", "code": "SSH_AUTH_FAILED", "message": "认证失败，请检查密钥或密码" }
```
- 发送 error 后服务端关闭 WebSocket 连接

### 4.2 前端状态机

```
         connect()
            │
            ▼
     ┌─ connecting ─┐
     │              │ WS open + status:connected
     │ WS error     ▼
     │        ┌─ connected ──────────────────────┐
     │        │                                    │
     │        │  正常交互: input ↔ output          │
     │        │                                    │
     │        │  status:disconnected               │
     │        └──────────┬─────────────────────────┘
     │                   ▼
     │          ┌─ disconnected ─┐
     │          │ 显示重连进度     │
     │          │ retry N/5       │
     │          │                 │
     │          │ status:         │ status:
     │          │ reconnected     │ connection_lost
     │          │     │           │     │
     │          │     ▼           │     ▼
     │          │  connected      │  connection_lost
     │          └─────────────────┘  显示 [重连] 按钮
     │                                   │
     └───────────────────────────────────┘
                  用户点击重连
```

### 4.3 命令执行检测

前端通过 WS 发送 AI 建议的命令后，需要知道"执行完了"才能更新状态或执行下一条。

检测方式：监听 output 事件，正则匹配 shell prompt 重新出现。

```typescript
// 连接时从 server info 获取 prompt 模式，或用通用匹配
const PROMPT_REGEX = /[$#>]\s*$/;

// 发送命令后开始监听
function waitForCompletion(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "output" && PROMPT_REGEX.test(msg.data)) {
        ws.removeEventListener("message", handler);
        resolve();
      }
    };
    ws.addEventListener("message", handler);
  });
}
```

---

## 附录：前端 API 调用封装参考

```typescript
// services/api.ts

const BASE = "/api";

class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json();
    throw new ApiError(body.error.code, body.error.message);
  }
  return res.json();
}

// --- Groups ---
export const getGroups = () => request<ServerGroup[]>("/groups");
export const createGroup = (data: ServerGroupInput) =>
  request<ServerGroup>("/groups", { method: "POST", body: JSON.stringify(data) });
export const updateGroup = (id: string, data: ServerGroupInput) =>
  request<ServerGroup>(`/groups/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteGroup = (id: string) =>
  request<void>(`/groups/${id}`, { method: "DELETE" });

// --- Servers ---
export const getServers = (groupId?: string) =>
  request<Server[]>(`/servers${groupId ? `?group_id=${groupId}` : ""}`);
export const createServer = (data: ServerInput) =>
  request<Server>("/servers", { method: "POST", body: JSON.stringify(data) });
export const updateServer = (id: string, data: ServerInput) =>
  request<Server>(`/servers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteServer = (id: string) =>
  request<void>(`/servers/${id}`, { method: "DELETE" });

// --- KeyPairs ---
export const getKeypairs = () => request<KeyPair[]>("/keypairs");
export const createKeypair = (data: KeyPairInput) =>
  request<KeyPair>("/keypairs", { method: "POST", body: JSON.stringify(data) });
export const deleteKeypair = (id: string) =>
  request<void>(`/keypairs/${id}`, { method: "DELETE" });

// --- Settings ---
export const getSettings = () => request<Settings>("/settings");
export const updateSettings = (data: SettingsUpdate) =>
  request<Settings>("/settings", { method: "PATCH", body: JSON.stringify(data) });

// --- SSH Config Import ---
export const previewSSHConfig = () => request<{ entries: SSHConfigEntry[] }>("/import/ssh-config/preview");
export const importSSHConfig = (selected: string[]) =>
  request<SSHConfigImportResult>("/import/ssh-config", {
    method: "POST", body: JSON.stringify({ selected }),
  });

// --- Command Logs ---
export const getCommandLogs = (serverId: string, offset = 0, limit = 50) =>
  request<{ items: CommandLog[]; total: number }>(
    `/servers/${serverId}/commands?offset=${offset}&limit=${limit}`
  );

// --- AI Chat (SSE) ---
export function chatStream(sessionId: string, message: string): EventSource {
  // 使用 fetch + ReadableStream 处理 POST SSE
  // （EventSource 原生只支持 GET，需用 fetch 封装）
  return fetchSSE(`${BASE}/assistant/chat`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}
```
