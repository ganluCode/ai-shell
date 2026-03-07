import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { useToastStore, addToast } from './stores/toastStore'

// Mock the uiStore
const mockOpenSettings = vi.fn()

vi.mock('./stores/uiStore', () => ({
  useUIStore: vi.fn((selector) => {
    const state = {
      settingsOpen: false,
      serverFormOpen: false,
      editingServerId: null,
      openSettings: mockOpenSettings,
      closeSettings: vi.fn(),
      openServerForm: vi.fn(),
      closeServerForm: vi.fn(),
    }
    return selector(state)
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset toast store to initial state
    act(() => {
      useToastStore.setState({ toasts: [] })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the ServerList component', () => {
    render(<App />, { wrapper: createWrapper() })
    expect(screen.getByRole('region', { name: 'Server List' })).toBeInTheDocument()
  })

  it('renders the Terminal component', () => {
    render(<App />, { wrapper: createWrapper() })
    expect(screen.getByRole('region', { name: 'Terminal' })).toBeInTheDocument()
  })

  it('renders the AiChat component', () => {
    render(<App />, { wrapper: createWrapper() })
    expect(screen.getByRole('region', { name: 'AI Chat' })).toBeInTheDocument()
  })

  describe('Header Settings Button', () => {
    it('renders Settings button in header', () => {
      render(<App />, { wrapper: createWrapper() })
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    })

    it('header Settings button calls openSettings() when clicked', async () => {
      const user = userEvent.setup()
      render(<App />, { wrapper: createWrapper() })

      // Find the header settings button (it's in the app-header)
      const headerSettingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(headerSettingsButton)

      expect(mockOpenSettings).toHaveBeenCalled()
    })
  })

  describe('F-003: Global Toast component', () => {
    it('Toast component renders at app root level', () => {
      // Add a toast to make the container visible
      act(() => {
        addToast('info', 'Test toast')
      })

      render(<App />, { wrapper: createWrapper() })

      // Toast container should be present in the DOM
      const toastContainer = screen.getByTestId('toast-container')
      expect(toastContainer).toBeInTheDocument()
    })

    it('Toasts from anywhere in app are visible', async () => {
      render(<App />, { wrapper: createWrapper() })

      // Initially no toasts visible
      expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument()

      // Simulate adding a toast from anywhere in the app
      act(() => {
        addToast('success', 'Server connected')
      })

      // The toast should appear in the app
      await waitFor(() => {
        expect(screen.getByTestId('toast-container')).toBeInTheDocument()
        expect(screen.getByText('Server connected')).toBeInTheDocument()
      })
    })
  })
})
