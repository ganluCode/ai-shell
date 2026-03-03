import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TerminalPanel } from './TerminalPanel'

// Mock the session store
const mockState = {
  activeSessionId: null as string | null,
  sessions: {} as Record<string, { id: string; server_id: string; status: string }>,
}

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: vi.fn((selector) => selector(mockState)),
}))

// Mock TerminalView
vi.mock('./TerminalView', () => ({
  TerminalView: ({ serverId }: { serverId: string }) => (
    <div data-testid="terminal-view" data-server-id={serverId}>
      Terminal View
    </div>
  ),
}))

// Mock StatusOverlay
vi.mock('./StatusOverlay', () => ({
  StatusOverlay: () => <div data-testid="status-overlay">Status Overlay</div>,
}))

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.activeSessionId = null
    mockState.sessions = {}
  })

  it('shows empty state placeholder when no active session', () => {
    mockState.activeSessionId = null
    mockState.sessions = {}

    render(<TerminalPanel />)

    expect(screen.getByText(/双击左侧服务器开始连接/i)).toBeInTheDocument()
  })

  it('renders TerminalView when there is an active session', () => {
    mockState.activeSessionId = 'session-1'
    mockState.sessions = {
      'session-1': {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connecting',
      },
    }

    render(<TerminalPanel />)

    expect(screen.getByTestId('terminal-view')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-view')).toHaveAttribute('data-server-id', 'server-1')
  })

  it('does not show empty state when session is active', () => {
    mockState.activeSessionId = 'session-1'
    mockState.sessions = {
      'session-1': {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
      },
    }

    render(<TerminalPanel />)

    expect(screen.queryByText(/双击左侧服务器开始连接/i)).not.toBeInTheDocument()
  })
})
