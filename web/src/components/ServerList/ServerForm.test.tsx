import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import ServerForm from './ServerForm'
import * as api from '../../services/api'
import type { Server, ServerGroup, KeyPair } from '../../types'

// Mock the uiStore - will be configured per test
const mockCloseServerForm = vi.fn()
let mockStoreState = {
  serverFormOpen: true,
  editingServerId: null as string | null,
  closeServerForm: mockCloseServerForm,
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

// Mock server data
const mockServer: Server = {
  id: 'server-1',
  group_id: 'group-1',
  label: 'Production Web',
  host: 'prod.example.com',
  port: 22,
  username: 'admin',
  auth_type: 'key',
  key_id: 'key-1',
  proxy_jump: null,
  startup_cmd: null,
  notes: null,
  color: '#FF6B6B',
  sort_order: 0,
  last_connected_at: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
}

const mockGroups: ServerGroup[] = [
  {
    id: 'group-1',
    name: 'Production',
    color: '#FF6B6B',
    sort_order: 0,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'group-2',
    name: 'Development',
    color: '#4CAF50',
    sort_order: 1,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
]

const mockKeypairs: KeyPair[] = [
  {
    id: 'key-1',
    label: 'Personal Key',
    private_key_path: '/home/user/.ssh/id_rsa',
    public_key_path: '/home/user/.ssh/id_rsa.pub',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'key-2',
    label: 'Work Key',
    private_key_path: '/home/user/.ssh/work_key',
    public_key_path: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
]

describe('ServerForm', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getGroups').mockResolvedValue(mockGroups)
    vi.spyOn(api, 'getKeyPairs').mockResolvedValue(mockKeypairs)
    vi.spyOn(api, 'getServers').mockResolvedValue([mockServer])
    vi.clearAllMocks()
    // Reset mock store state
    mockStoreState = {
      serverFormOpen: true,
      editingServerId: null,
      closeServerForm: mockCloseServerForm,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Form fields', () => {
    it('renders all required form fields', async () => {
      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByLabelText(/label/i)).toBeInTheDocument()
      })

      // Check all form fields are present
      expect(screen.getByLabelText(/label/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/host/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/port/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/auth type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/group/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/proxy jump/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/startup command/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    })

    it('shows key selection dropdown when auth_type is key', async () => {
      const user = userEvent.setup()

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByLabelText(/auth type/i)).toBeInTheDocument()
      })

      // Select key authentication
      const authTypeSelect = screen.getByLabelText(/auth type/i)
      await user.selectOptions(authTypeSelect, 'key')

      // Key dropdown should be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/^key$/i)).toBeInTheDocument()
      })
    })

    it('shows password input when auth_type is password', async () => {
      const user = userEvent.setup()

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByLabelText(/auth type/i)).toBeInTheDocument()
      })

      // Select password authentication
      const authTypeSelect = screen.getByLabelText(/auth type/i)
      await user.selectOptions(authTypeSelect, 'password')

      // Password input should be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form validation', () => {
    it('shows validation error when label is missing', async () => {
      const user = userEvent.setup()

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      })

      // Submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/label.*required/i)).toBeInTheDocument()
      })
    })

    it('shows validation error when host is missing', async () => {
      const user = userEvent.setup()

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      })

      // Fill only label, not host
      const labelInput = screen.getByLabelText(/label/i)
      await user.type(labelInput, 'Test Server')

      const submitButton = screen.getByRole('button', { name: /create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/host.*required/i)).toBeInTheDocument()
      })
    })

    it('shows validation error when username is missing', async () => {
      const user = userEvent.setup()

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      })

      // Fill label and host, not username
      const labelInput = screen.getByLabelText(/label/i)
      await user.type(labelInput, 'Test Server')
      const hostInput = screen.getByLabelText(/host/i)
      await user.type(hostInput, 'test.example.com')

      const submitButton = screen.getByRole('button', { name: /create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/username.*required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Add mode', () => {
    it('displays empty form when editingServerId is null', async () => {
      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByLabelText(/label/i)).toBeInTheDocument()
      })

      // Form should be empty
      const labelInput = screen.getByLabelText(/label/i) as HTMLInputElement
      const hostInput = screen.getByLabelText(/host/i) as HTMLInputElement
      const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement

      expect(labelInput.value).toBe('')
      expect(hostInput.value).toBe('')
      expect(usernameInput.value).toBe('')
    })

    it('calls useCreateServer on submit in add mode', async () => {
      const user = userEvent.setup()
      const mockCreateServer = vi.fn().mockResolvedValue(mockServer)
      vi.spyOn(api, 'createServer').mockImplementation(mockCreateServer)

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByLabelText(/label/i)).toBeInTheDocument()
      })

      // Fill required fields
      await user.type(screen.getByLabelText(/label/i), 'New Server')
      await user.type(screen.getByLabelText(/host/i), 'new.example.com')
      await user.type(screen.getByLabelText(/username/i), 'admin')

      const submitButton = screen.getByRole('button', { name: /create/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCreateServer).toHaveBeenCalled()
      })
    })
  })

  describe('Edit mode', () => {
    it('populates form with existing server data when editingServerId is set', async () => {
      // Set the editing server ID in the mock store
      mockStoreState.editingServerId = 'server-1'

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByLabelText(/label/i)).toBeInTheDocument()
      })

      // Wait for form to be populated with existing data
      await waitFor(() => {
        const labelInput = screen.getByLabelText(/label/i) as HTMLInputElement
        expect(labelInput.value).toBe('Production Web')
      })

      const hostInput = screen.getByLabelText(/host/i) as HTMLInputElement
      const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement

      expect(hostInput.value).toBe('prod.example.com')
      expect(usernameInput.value).toBe('admin')
    })

    it('calls useUpdateServer on submit in edit mode', async () => {
      const user = userEvent.setup()
      const mockUpdateServer = vi.fn().mockResolvedValue(mockServer)
      vi.spyOn(api, 'updateServer').mockImplementation(mockUpdateServer)

      // Set the editing server ID in the mock store
      mockStoreState.editingServerId = 'server-1'

      render(<ServerForm />, { wrapper: createWrapper() })

      // Wait for form to be populated
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
      })

      // Submit the form (data is already populated)
      const submitButton = screen.getByRole('button', { name: /update/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockUpdateServer).toHaveBeenCalledWith(
          'server-1',
          expect.objectContaining({
            label: 'Production Web',
            host: 'prod.example.com',
          })
        )
      })
    })
  })

  describe('Modal behavior', () => {
    it('calls closeServerForm when cancel button is clicked', async () => {
      const user = userEvent.setup()

      render(<ServerForm />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockCloseServerForm).toHaveBeenCalled()
    })
  })
})
