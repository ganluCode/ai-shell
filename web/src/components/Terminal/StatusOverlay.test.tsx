import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusOverlay } from './StatusOverlay'

describe('StatusOverlay', () => {
  const user = userEvent.setup()
  const mockReconnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "正在连接..." when connecting', () => {
    render(
      <StatusOverlay
        connectionState="connecting"
        onReconnect={mockReconnect}
      />
    )

    expect(screen.getByText(/正在连接/i)).toBeInTheDocument()
  })

  it('shows reconnect progress when disconnected', () => {
    render(
      <StatusOverlay
        connectionState="disconnected"
        retryCount={2}
        maxRetry={5}
        onReconnect={mockReconnect}
      />
    )

    expect(screen.getByText(/连接已断开.*正在重连/i)).toBeInTheDocument()
    expect(screen.getByText(/2\/5/)).toBeInTheDocument()
  })

  it('shows "连接已断开" with reconnect button when connection_lost', () => {
    render(
      <StatusOverlay
        connectionState="connection_lost"
        onReconnect={mockReconnect}
      />
    )

    expect(screen.getByText(/连接已断开/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重新连接/i })).toBeInTheDocument()
  })

  it('clicking reconnect button calls onReconnect', async () => {
    render(
      <StatusOverlay
        connectionState="connection_lost"
        onReconnect={mockReconnect}
      />
    )

    await user.click(screen.getByRole('button', { name: /重新连接/i }))

    expect(mockReconnect).toHaveBeenCalled()
  })

  it('is hidden when connected', () => {
    render(
      <StatusOverlay
        connectionState="connected"
        onReconnect={mockReconnect}
      />
    )

    expect(screen.queryByText(/正在连接/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/连接已断开/i)).not.toBeInTheDocument()
  })

  it('overlay is not visible when connected', () => {
    const { container } = render(
      <StatusOverlay
        connectionState="connected"
        onReconnect={mockReconnect}
      />
    )

    const overlay = container.querySelector('.status-overlay')
    // When connected, the component returns null
    expect(overlay).toBeNull()
  })
})
