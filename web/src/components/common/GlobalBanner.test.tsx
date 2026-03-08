import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import GlobalBanner from './GlobalBanner'
import * as api from '../../services/api'

// Mock the API module
vi.mock('../../services/api', () => ({
  checkHealth: vi.fn(),
}))

describe('GlobalBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Visibility', () => {
    it('is hidden when health check passes', async () => {
      vi.mocked(api.checkHealth).mockResolvedValue({ status: 'ok' })

      render(<GlobalBanner />)

      // Initial state - should not show banner
      expect(screen.queryByText('与服务端的连接已断开')).not.toBeInTheDocument()

      // Advance timers to trigger health check
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Health check passes - banner should remain hidden
      expect(screen.queryByText('与服务端的连接已断开')).not.toBeInTheDocument()
    })

    it('displays disconnect message when health check fails', async () => {
      vi.mocked(api.checkHealth).mockRejectedValue(new Error('Network error'))

      render(<GlobalBanner />)

      // Advance timers to trigger health check
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      // Banner should appear with disconnect message
      expect(screen.getByText('与服务端的连接已断开')).toBeInTheDocument()
    })

    it('hides when health check recovers after failure', async () => {
      // First call fails, subsequent calls succeed
      vi.mocked(api.checkHealth)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ status: 'ok' })

      render(<GlobalBanner />)

      // Advance time to let initial health check complete (failure)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      // Banner should appear after failed check
      expect(screen.getByText('与服务端的连接已断开')).toBeInTheDocument()

      // Advance timers to trigger next health check (success)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      // Banner should hide
      expect(screen.queryByText('与服务端的连接已断开')).not.toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('shows red styling when disconnected', async () => {
      vi.mocked(api.checkHealth).mockRejectedValue(new Error('Network error'))

      render(<GlobalBanner />)

      // Advance timers to trigger health check
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      const banner = screen.getByRole('alert')
      expect(banner).toBeInTheDocument()
      expect(banner).toHaveAttribute('data-status', 'error')
    })
  })

  describe('Polling', () => {
    it('polls health endpoint at regular intervals', async () => {
      vi.mocked(api.checkHealth).mockResolvedValue({ status: 'ok' })

      render(<GlobalBanner />)

      // Initial check on mount
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(api.checkHealth).toHaveBeenCalledTimes(1)

      // Next poll after interval
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
      expect(api.checkHealth).toHaveBeenCalledTimes(2)

      // Another poll
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
      expect(api.checkHealth).toHaveBeenCalledTimes(3)
    })

    it('stops polling when component unmounts', async () => {
      vi.mocked(api.checkHealth).mockResolvedValue({ status: 'ok' })

      const { unmount } = render(<GlobalBanner />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(api.checkHealth).toHaveBeenCalledTimes(1)

      unmount()

      // Advance timers - should not trigger more calls
      await act(async () => {
        vi.advanceTimersByTime(10000)
      })
      expect(api.checkHealth).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has role="alert" for screen readers', async () => {
      vi.mocked(api.checkHealth).mockRejectedValue(new Error('Network error'))

      render(<GlobalBanner />)

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('has aria-live="assertive" for critical notification', async () => {
      vi.mocked(api.checkHealth).mockRejectedValue(new Error('Network error'))

      render(<GlobalBanner />)

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      const banner = screen.getByRole('alert')
      expect(banner).toHaveAttribute('aria-live', 'assertive')
    })
  })
})
