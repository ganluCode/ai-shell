import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TerminalView } from './TerminalView'

// Mock xterm and addons
const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
  write: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onResize: vi.fn(() => ({ dispose: vi.fn() })),
  resize: vi.fn(),
  loadAddon: vi.fn(),
  options: {},
}

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
    proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
  })),
}))

// Mock useTerminalWS hook
const mockSendInput = vi.fn()
const mockSendResize = vi.fn()
const mockReconnect = vi.fn()

vi.mock('../../hooks/useTerminalWS', () => ({
  useTerminalWS: vi.fn(() => ({
    connectionState: 'connected',
    retryCount: 0,
    maxRetry: 5,
    sendInput: mockSendInput,
    sendResize: mockSendResize,
    reconnect: mockReconnect,
  })),
}))

// Mock useSettings hook
vi.mock('../../hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    data: {
      terminal_font: 'Monaco',
      terminal_size: '14',
    },
  })),
}))

describe('TerminalView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders terminal container', () => {
    render(<TerminalView serverId="server-1" />)

    expect(screen.getByRole('region', { name: /terminal/i })).toBeInTheDocument()
  })

  it('creates xterm Terminal instance on mount', async () => {
    const { Terminal } = await import('@xterm/xterm')
    render(<TerminalView serverId="server-1" />)

    await waitFor(() => {
      expect(Terminal).toHaveBeenCalled()
    })
  })

  it('calls terminal.open with container element', async () => {
    render(<TerminalView serverId="server-1" />)

    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled()
    })
  })

  it('calls terminal.dispose on unmount', async () => {
    const { unmount } = render(<TerminalView serverId="server-1" />)

    await waitFor(() => {
      expect(mockTerminal.open).toHaveBeenCalled()
    })

    unmount()

    expect(mockTerminal.dispose).toHaveBeenCalled()
  })

  it('sends user input via sendInput when xterm.onData is triggered', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dataCallback: any = null
    ;(mockTerminal.onData as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      dataCallback = callback
      return { dispose: vi.fn() }
    })

    render(<TerminalView serverId="server-1" />)

    await waitFor(() => {
      expect(mockTerminal.onData).toHaveBeenCalled()
    })

    // Simulate user typing
    if (dataCallback) {
      dataCallback('ls -la\r')
    }

    expect(mockSendInput).toHaveBeenCalledWith('ls -la\r')
  })

  it('applies font settings from useSettings', async () => {
    const { Terminal } = await import('@xterm/xterm')

    render(<TerminalView serverId="server-1" />)

    await waitFor(() => {
      expect(Terminal).toHaveBeenCalledWith(
        expect.objectContaining({
          fontFamily: 'Monaco',
          fontSize: 14,
        })
      )
    })
  })

  it('applies dark theme to terminal', async () => {
    const { Terminal } = await import('@xterm/xterm')

    render(<TerminalView serverId="server-1" />)

    await waitFor(() => {
      expect(Terminal).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: expect.objectContaining({
            background: expect.any(String),
          }),
        })
      )
    })
  })
})
