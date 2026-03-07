import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import ErrorBubble from './ErrorBubble'
import type { ApiError } from '../../types'

describe('ErrorBubble', () => {
  describe('rendering', () => {
    it('renders with red-bordered error message', () => {
      const error: ApiError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      }

      render(<ErrorBubble error={error} />)

      const bubble = screen.getByRole('alert')
      expect(bubble).toBeInTheDocument()
      expect(bubble).toHaveClass('error-bubble')
    })

    it('displays error message in the bubble', () => {
      const error: ApiError = {
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong',
      }

      render(<ErrorBubble error={error} />)

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('AI_AUTH_FAILED error', () => {
    it('shows "API Key 无效，请在设置中更新" message', () => {
      const error: ApiError = {
        code: 'AI_AUTH_FAILED',
        message: 'Authentication failed',
      }

      render(<ErrorBubble error={error} />)

      expect(screen.getByText(/API Key 无效，请在设置中更新/)).toBeInTheDocument()
    })

    it('shows [打开设置] link', () => {
      const error: ApiError = {
        code: 'AI_AUTH_FAILED',
        message: 'Authentication failed',
      }

      render(<ErrorBubble error={error} />)

      const settingsLink = screen.getByRole('button', { name: /打开设置/ })
      expect(settingsLink).toBeInTheDocument()
    })

    it('calls onOpenSettings when [打开设置] is clicked', async () => {
      const user = userEvent.setup()
      const onOpenSettings = vi.fn()
      const error: ApiError = {
        code: 'AI_AUTH_FAILED',
        message: 'Authentication failed',
      }

      render(<ErrorBubble error={error} onOpenSettings={onOpenSettings} />)

      await user.click(screen.getByRole('button', { name: /打开设置/ }))

      expect(onOpenSettings).toHaveBeenCalledOnce()
    })
  })

  describe('AI_RATE_LIMITED error', () => {
    it('shows "AI 服务繁忙，请稍后重试" message', () => {
      const error: ApiError = {
        code: 'AI_RATE_LIMITED',
        message: 'Rate limit exceeded',
      }

      render(<ErrorBubble error={error} />)

      expect(screen.getByText(/AI 服务繁忙，请稍后重试/)).toBeInTheDocument()
    })

    it('shows [重试] button', () => {
      const error: ApiError = {
        code: 'AI_RATE_LIMITED',
        message: 'Rate limit exceeded',
      }

      render(<ErrorBubble error={error} />)

      const retryButton = screen.getByRole('button', { name: /重试/ })
      expect(retryButton).toBeInTheDocument()
    })

    it('calls onRetry when [重试] is clicked', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      const error: ApiError = {
        code: 'AI_RATE_LIMITED',
        message: 'Rate limit exceeded',
      }

      render(<ErrorBubble error={error} onRetry={onRetry} />)

      await user.click(screen.getByRole('button', { name: /重试/ }))

      expect(onRetry).toHaveBeenCalledOnce()
    })
  })

  describe('AI_TIMEOUT error', () => {
    it('shows "AI 响应超时" message', () => {
      const error: ApiError = {
        code: 'AI_TIMEOUT',
        message: 'Request timed out',
      }

      render(<ErrorBubble error={error} />)

      expect(screen.getByText(/AI 响应超时/)).toBeInTheDocument()
    })

    it('shows [重试] button', () => {
      const error: ApiError = {
        code: 'AI_TIMEOUT',
        message: 'Request timed out',
      }

      render(<ErrorBubble error={error} />)

      const retryButton = screen.getByRole('button', { name: /重试/ })
      expect(retryButton).toBeInTheDocument()
    })

    it('calls onRetry when [重试] is clicked', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      const error: ApiError = {
        code: 'AI_TIMEOUT',
        message: 'Request timed out',
      }

      render(<ErrorBubble error={error} onRetry={onRetry} />)

      await user.click(screen.getByRole('button', { name: /重试/ }))

      expect(onRetry).toHaveBeenCalledOnce()
    })
  })

  describe('other errors', () => {
    it('displays error.message for unknown error codes', () => {
      const error: ApiError = {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }

      render(<ErrorBubble error={error} />)

      expect(screen.getByText('Internal server error')).toBeInTheDocument()
    })

    it('does not show action buttons for unknown error codes', () => {
      const error: ApiError = {
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong',
      }

      render(<ErrorBubble error={error} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
