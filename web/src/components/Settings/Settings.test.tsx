import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Settings from './Settings'

// Mock the uiStore
const mockCloseSettings = vi.fn()
let mockStoreState = {
  settingsOpen: true,
  closeSettings: mockCloseSettings,
}

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState)),
}))

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock store state
    mockStoreState = {
      settingsOpen: true,
      closeSettings: mockCloseSettings,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders when settingsOpen is true', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument()
    })

    it('does not render when settingsOpen is false', () => {
      mockStoreState.settingsOpen = false

      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.queryByRole('dialog', { name: /settings/i })).not.toBeInTheDocument()
    })

    it('displays the Settings title', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
    })
  })

  describe('Close functionality', () => {
    it('has a close button', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    it('calls closeSettings when close button is clicked', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockCloseSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has proper modal attributes', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has accessible label for the dialog', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const dialog = screen.getByRole('dialog', { name: /settings/i })
      expect(dialog).toBeInTheDocument()
    })
  })
})
