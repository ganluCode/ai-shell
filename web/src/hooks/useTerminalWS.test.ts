import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTerminalWS } from './useTerminalWS'

describe('useTerminalWS', () => {
  let mockWs: {
    url: string
    readyState: number
    onopen: ((event: Event) => void) | null
    onclose: ((event: CloseEvent) => void) | null
    onmessage: ((event: MessageEvent) => void) | null
    onerror: ((event: Event) => void) | null
    send: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }

  const createMockWs = (url: string) => {
    mockWs = {
      url,
      readyState: WebSocket.CONNECTING,
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn(),
    }
    return mockWs
  }

  const MockWebSocket = vi.fn(createMockWs) as unknown as typeof WebSocket
  // @ts-expect-error Adding static properties to mock
  MockWebSocket.CONNECTING = 0
  // @ts-expect-error Adding static properties to mock
  MockWebSocket.OPEN = 1
  // @ts-expect-error Adding static properties to mock
  MockWebSocket.CLOSING = 2
  // @ts-expect-error Adding static properties to mock
  MockWebSocket.CLOSED = 3

  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('establishes WebSocket connection to correct URL', () => {
    renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    expect(MockWebSocket).toHaveBeenCalledWith(
      'ws://localhost:8765/api/sessions/server-1/terminal'
    )
  })

  it('exposes connecting state initially', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    expect(result.current.connectionState).toBe('connecting')
  })

  it('updates to connected state when WebSocket opens', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    // Verify onopen handler was set
    expect(mockWs.onopen).not.toBeNull()

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    expect(result.current.connectionState).toBe('connected')
  })

  it('updates to connected when receiving status:connected message', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      mockWs.onmessage?.({
        data: JSON.stringify({ type: 'status', status: 'connected' }),
      } as MessageEvent)
    })

    expect(result.current.connectionState).toBe('connected')
  })

  it('updates to disconnected when receiving status:disconnected message', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      mockWs.onmessage?.({
        data: JSON.stringify({
          type: 'status',
          status: 'disconnected',
          retry: 2,
          max_retry: 5,
        }),
      } as MessageEvent)
    })

    expect(result.current.connectionState).toBe('disconnected')
    expect(result.current.retryCount).toBe(2)
    expect(result.current.maxRetry).toBe(5)
  })

  it('updates to connection_lost when receiving status:connection_lost message', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      mockWs.onmessage?.({
        data: JSON.stringify({
          type: 'status',
          status: 'connection_lost',
        }),
      } as MessageEvent)
    })

    expect(result.current.connectionState).toBe('connection_lost')
  })

  it('calls onOutput callback when receiving output message', () => {
    const onOutput = vi.fn()
    renderHook(() =>
      useTerminalWS({ serverId: 'server-1', onOutput })
    )

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      mockWs.onmessage?.({
        data: JSON.stringify({
          type: 'output',
          data: '\u001b[32mroot@prod\u001b[0m:~# ',
        }),
      } as MessageEvent)
    })

    expect(onOutput).toHaveBeenCalledWith('\u001b[32mroot@prod\u001b[0m:~# ')
  })

  it('calls onError callback when receiving error message', () => {
    const onError = vi.fn()
    renderHook(() =>
      useTerminalWS({ serverId: 'server-1', onError })
    )

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      mockWs.onmessage?.({
        data: JSON.stringify({
          type: 'error',
          code: 'SSH_AUTH_FAILED',
          message: 'Authentication failed',
        }),
      } as MessageEvent)
    })

    expect(onError).toHaveBeenCalledWith({
      code: 'SSH_AUTH_FAILED',
      message: 'Authentication failed',
    })
  })

  it('sendInput sends correct format via WebSocket', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      result.current.sendInput('ls -la\r')
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'input', data: 'ls -la\r' })
    )
  })

  it('sendResize sends correct format via WebSocket', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      result.current.sendResize(120, 40)
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'resize', cols: 120, rows: 40 })
    )
  })

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    unmount()

    expect(mockWs.close).toHaveBeenCalled()
  })

  it('reconnect creates new WebSocket when reconnect() is called', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    act(() => {
      mockWs.readyState = WebSocket.OPEN
      mockWs.onopen?.({ type: 'open' } as Event)
    })

    act(() => {
      mockWs.onmessage?.({
        data: JSON.stringify({
          type: 'status',
          status: 'connection_lost',
        }),
      } as MessageEvent)
    })

    const initialCallCount = (MockWebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length

    act(() => {
      result.current.reconnect()
    })

    expect((MockWebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialCallCount + 1)
  })

  it('does not send when WebSocket is not open', () => {
    const { result } = renderHook(() => useTerminalWS({ serverId: 'server-1' }))

    // Don't simulate open - keep WebSocket in CONNECTING state

    act(() => {
      result.current.sendInput('test')
    })

    expect(mockWs.send).not.toHaveBeenCalled()
  })
})
