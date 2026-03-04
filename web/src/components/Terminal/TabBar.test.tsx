import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TabBar } from './TabBar'

// Mock the session store
const mockSetActiveSession = vi.fn()
const mockCloseSession = vi.fn()

const mockState = {
  activeSessionId: null as string | null,
  sessions: {} as Record<string, { id: string; server_id: string; status: string }>,
  setActiveSession: mockSetActiveSession,
  closeSession: mockCloseSession,
}

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: vi.fn((selector) => selector(mockState)),
}))

// Mock useServers hook to get server labels
vi.mock('../../hooks/useServers', () => ({
  useServers: vi.fn(() => ({
    data: [
      { id: 'server-1', label: 'Server One' },
      { id: 'server-2', label: 'Server Two' },
    ],
  })),
}))

describe('TabBar', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.activeSessionId = null
    mockState.sessions = {}
  })

  it('renders multiple tabs for multiple sessions', () => {
    mockState.sessions = {
      'session-1': { id: 'session-1', server_id: 'server-1', status: 'connected' },
      'session-2': { id: 'session-2', server_id: 'server-2', status: 'connecting' },
    }

    render(<TabBar />)

    expect(screen.getByText('Server One')).toBeInTheDocument()
    expect(screen.getByText('Server Two')).toBeInTheDocument()
  })

  it('clicking tab switches active session', async () => {
    mockState.sessions = {
      'session-1': { id: 'session-1', server_id: 'server-1', status: 'connected' },
      'session-2': { id: 'session-2', server_id: 'server-2', status: 'connected' },
    }
    mockState.activeSessionId = 'session-1'

    render(<TabBar />)

    const tab2 = screen.getByRole('tab', { name: /server two/i })
    await user.click(tab2)

    expect(mockSetActiveSession).toHaveBeenCalledWith('session-2')
  })

  it('clicking close button removes session', async () => {
    mockState.sessions = {
      'session-1': { id: 'session-1', server_id: 'server-1', status: 'connected' },
    }
    mockState.activeSessionId = 'session-1'

    render(<TabBar />)

    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    expect(mockCloseSession).toHaveBeenCalledWith('session-1')
  })

  it('active tab has highlight styling', () => {
    mockState.sessions = {
      'session-1': { id: 'session-1', server_id: 'server-1', status: 'connected' },
      'session-2': { id: 'session-2', server_id: 'server-2', status: 'connected' },
    }
    mockState.activeSessionId = 'session-1'

    render(<TabBar />)

    const activeTab = screen.getByRole('tab', { name: /server one/i })
    expect(activeTab).toHaveClass('active')
  })

  it('returns null when no sessions', () => {
    mockState.sessions = {}

    const { container } = render(<TabBar />)

    expect(container.firstChild).toBeNull()
  })
})
