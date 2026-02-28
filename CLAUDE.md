# LLM Shell

AI 辅助 SSH 运维工具 — 内置 AI 助手的 SSH 客户端。

## 目录结构

```
ai-shell/
├── api/          # 后端 — Python FastAPI
├── web/          # 前端 — Vite + React + TypeScript
└── docs/         # 文档 — 架构设计与 API 契约
```

## 开发须知

- 开发任务前**必须**先阅读 `docs/data-api-design.md`（数据模型、API 契约、WebSocket/SSE 协议）
- 如有不明确的地方参考架构文档 `docs/llm-shell.md`

## TDD — 强制要求

**所有功能必须遵循 TDD 流程，没有例外。**

1. **先写测试** — 根据需求编写失败的测试用例
2. **再写实现** — 编写刚好让测试通过的最少代码
3. **最后重构** — 测试全绿后再优化代码结构

禁止：
- 禁止跳过测试直接写实现代码
- 禁止写完实现再补测试
- 禁止提交测试未通过的代码

## 技术栈

- **后端 (`api/`)**: Python, FastAPI, asyncssh, anthropic SDK, SQLite, keyring
- **前端 (`web/`)**: TypeScript, React, Vite, xterm.js, Zustand, TanStack Query
- **通信**: REST + WebSocket（终端）+ SSE（AI 对话）

## 约定

- 后端只绑定 `127.0.0.1`，CORS 仅允许 localhost
- 敏感信息（API Key、密码、passphrase）存 keyring，不进数据库
- 统一错误格式 `{ error: { code, message, detail } }`
- 前端是瘦客户端，不持有业务状态
