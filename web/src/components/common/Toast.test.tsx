import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Toast from './Toast'
import { useToastStore, addToast } from '../../stores/toastStore'

describe('Toast', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useToastStore.setState({
        toasts: [],
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Positioning', () => {
    it('renders in top-right corner', () => {
      act(() => {
        addToast('info', 'Test message')
      })

      render(<Toast />)

      const container = screen.getByTestId('toast-container')
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass('toast-container')
    })

    it('does not render when no toasts exist', () => {
      render(<Toast />)

      expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument()
    })
  })

  describe('Type styling', () => {
    it('shows green styling for success type', () => {
      act(() => {
        addToast('success', 'Operation completed')
      })

      render(<Toast />)

      const toast = screen.getByTestId('toast-item')
      expect(toast).toHaveAttribute('data-type', 'success')
    })

    it('shows red styling for error type', () => {
      act(() => {
        addToast('error', 'Something went wrong')
      })

      render(<Toast />)

      const toast = screen.getByTestId('toast-item')
      expect(toast).toHaveAttribute('data-type', 'error')
    })

    it('shows blue styling for info type', () => {
      act(() => {
        addToast('info', 'Information message')
      })

      render(<Toast />)

      const toast = screen.getByTestId('toast-item')
      expect(toast).toHaveAttribute('data-type', 'info')
    })
  })

  describe('Queue display', () => {
    it('displays multiple toasts stacked', () => {
      act(() => {
        addToast('success', 'First toast')
        addToast('error', 'Second toast')
        addToast('info', 'Third toast')
      })

      render(<Toast />)

      const toasts = screen.getAllByTestId('toast-item')
      expect(toasts).toHaveLength(3)
      expect(screen.getByText('First toast')).toBeInTheDocument()
      expect(screen.getByText('Second toast')).toBeInTheDocument()
      expect(screen.getByText('Third toast')).toBeInTheDocument()
    })

    it('maintains correct order of toasts', () => {
      act(() => {
        addToast('info', 'First')
        addToast('info', 'Second')
      })

      render(<Toast />)

      const toasts = screen.getAllByTestId('toast-item')
      expect(toasts[0]).toHaveTextContent('First')
      expect(toasts[1]).toHaveTextContent('Second')
    })
  })

  describe('Auto-dismiss', () => {
    it('auto-dismisses toast after 3000ms', () => {
      vi.useFakeTimers()

      act(() => {
        addToast('info', 'Will disappear')
      })

      const { rerender } = render(<Toast />)

      expect(screen.getByText('Will disappear')).toBeInTheDocument()

      // Fast-forward 3000ms
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      // Force rerender to reflect state change
      rerender(<Toast />)

      // The toast should be removed from the store, so container should not exist
      expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument()
    })

    it('auto-dismisses multiple toasts independently', () => {
      vi.useFakeTimers()

      act(() => {
        addToast('info', 'First toast')
        addToast('info', 'Second toast')
      })

      const { rerender } = render(<Toast />)

      expect(screen.getByText('First toast')).toBeInTheDocument()
      expect(screen.getByText('Second toast')).toBeInTheDocument()

      // Fast-forward 3000ms - both toasts should be dismissed
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      // Force rerender to reflect state change
      rerender(<Toast />)

      // Both toasts should be removed
      expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument()
    })
  })

  describe('Manual dismiss', () => {
    it('has a close button for each toast', () => {
      act(() => {
        addToast('info', 'Closable toast')
      })

      render(<Toast />)

      expect(screen.getByRole('button', { name: /关闭/i })).toBeInTheDocument()
    })

    it('removes individual toast when X button is clicked', async () => {
      const user = userEvent.setup()

      act(() => {
        addToast('info', 'Toast to close')
        addToast('info', 'Toast to keep')
      })

      render(<Toast />)

      expect(screen.getByText('Toast to close')).toBeInTheDocument()
      expect(screen.getByText('Toast to keep')).toBeInTheDocument()

      const closeButtons = screen.getAllByRole('button', { name: /关闭/i })
      await user.click(closeButtons[0])

      await waitFor(() => {
        expect(screen.queryByText('Toast to close')).not.toBeInTheDocument()
        expect(screen.getByText('Toast to keep')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has role="alert" for toast notifications', () => {
      act(() => {
        addToast('error', 'Error message')
      })

      render(<Toast />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('has aria-live="polite" for non-critical notifications', () => {
      act(() => {
        addToast('info', 'Info message')
      })

      render(<Toast />)

      const container = screen.getByTestId('toast-container')
      expect(container).toHaveAttribute('aria-live', 'polite')
    })
  })
})
