# Frontend Progress

## Project: web (ai-shell-web)

**Date**: 2026-03-05
**Status**: F-001 SSE Chat Hook Completed

---

## Session 2026-03-05

### F-001: Create SSE hook (useChat.ts) ✅
- Created `hooks/useChat.ts` with SSE streaming support
- `sendMessage(sessionId, message)` sends POST to `/api/assistant/chat`
- Uses `fetch` + `ReadableStream` (not native EventSource) for POST requests
- Parses SSE events: `text`, `command`, `commands`, `error`, `done`
- `text` events accumulate to AI message content in real-time
- `command` event creates single `CommandSuggestion`
- `commands` event creates `CommandSuggestion[]` array
- `error` event triggers error callback
- `done` event marks message as complete
- `chatMessages` state updated in real-time during streaming
- Added 13 comprehensive tests in `hooks/useChat.test.ts`
- Cleaned up unused placeholder `chat()` function in `api.ts`
- All 216 tests pass

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Vite + React 18 |
| Language | TypeScript 5.6 |
| State Management | Zustand 5 |
| Data Fetching | TanStack Query 5 |
| Test Runner | Vitest 2.1 |
| Testing Library | @testing-library/react 16 |
| Linter | ESLint 9 (flat config) |
| Formatter | Prettier |
| Terminal | @xterm/xterm 6.0 |

---

## Directory Structure

```
src/
├── assets/         # Static resources (images, fonts)
├── components/     # Reusable UI components
│   ├── AiChat/
│   ├── ServerList/
│   ├── Settings/
│   ├── Terminal/   # NEW: Terminal components
│   │   ├── TabBar.tsx
│   │   ├── TerminalPanel.tsx
│   │   ├── TerminalView.tsx
│   │   └── StatusOverlay.tsx
│   └── common/
├── hooks/          # Custom React hooks
│   ├── useTerminalWS.ts  # WebSocket hook
│   └── useChat.ts        # NEW: SSE chat hook
├── pages/          # Route-level views
├── services/       # API services
├── stores/         # Zustand state stores
│   └── sessionStore.ts   # UPDATED: Added createSession, updateStatus
├── styles/         # Global styles, themes
├── test/           # Test utilities and setup
├── types/          # TypeScript definitions
└── utils/          # Utility functions
```

---

## Completed Features

### F-001: Install terminal dependencies ✅
- Installed @xterm/xterm, @xterm/addon-fit, @xterm/addon-web-links

### F-002: Create WebSocket hook ✅
- Created `hooks/useTerminalWS.ts`
- Handles WebSocket connection to `/api/sessions/{serverId}/terminal`
- Parses server messages (output/status/error)
- Provides sendInput() and sendResize() methods
- Exposes connection state: connecting/connected/disconnected/connection_lost

### F-003: Complete sessionStore ✅
- Added `createSession(serverId)` - creates session and sets as active
- Added `updateStatus(sessionId, status)` - updates session status

### F-004: Create TerminalView component ✅
- Initializes xterm.Terminal with dark theme
- Reads font settings from useSettings hook
- Uses FitAddon for container size adaptation
- Sends keyboard input via sendInput
- Writes remote output to terminal

### F-005: Create StatusOverlay component ✅
- Shows loading animation with "正在连接..." when connecting
- Shows reconnect progress when disconnected
- Shows reconnect button when connection_lost
- Hidden when connected

### F-006: Integrate server list with session store ✅
- Created TerminalPanel component
- Shows empty state placeholder when no active session
- Renders TerminalView based on activeSessionId

### F-007: Create TabBar component ✅
- Displays all open sessions as tabs
- Clicking tab switches activeSession
- Close button calls closeSession
- Active tab is visually highlighted

### F-008, F-009, F-010: Unit tests ✅
- All components have comprehensive unit tests
- Total: 203 tests passing

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 5173) |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests once (216 tests) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run preview` | Preview production build |

---

## Notes

- The project uses npm as the package manager
- API proxy configured to forward `/api/*` requests to `http://localhost:8765`
- Test setup includes `@testing-library/jest-dom` matchers
- All 216 tests pass
- Build succeeds
- Lint passes
