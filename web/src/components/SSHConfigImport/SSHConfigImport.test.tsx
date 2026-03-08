import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import SSHConfigImport from './SSHConfigImport'
import type { SSHConfigEntry, SSHConfigImportResult, Server } from '../../types'

// Mock the hooks
const mockRefetch = vi.fn()
const mockMutate = vi.fn()

let mockHookState = {
  previewData: null as { entries: SSHConfigEntry[] } | null,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: mockRefetch,
}

let mockMutationState = {
  mutate: mockMutate,
  isPending: false,
  isSuccess: false,
  isError: false,
  data: null as SSHConfigImportResult | null,
}

vi.mock('../../hooks/useSSHConfigImport', () => ({
  useSSHConfigPreview: () => ({
    data: mockHookState.previewData,
    isLoading: mockHookState.isLoading,
    isError: mockHookState.isError,
    error: mockHookState.error,
    refetch: mockHookState.refetch,
  }),
  useImportSSHConfig: () => ({
    mutate: mockMutationState.mutate,
    isPending: mockMutationState.isPending,
    isSuccess: mockMutationState.isSuccess,
    isError: mockMutationState.isError,
    data: mockMutationState.data,
  }),
}))

// Mock the uiStore
let mockStoreState = {
  sshConfigImportOpen: false,
  openSSHConfigImport: vi.fn(),
  closeSSHConfigImport: vi.fn(),
}

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState)),
}))

// Mock toast store
vi.mock('../../stores/toastStore', () => ({
  addToast: vi.fn(),
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

// Mock SSH config entries
const mockEntry1: SSHConfigEntry = {
  label: 'prod-web-01',
  host: '192.168.1.100',
  username: 'root',
  port: 22,
  identity_file: '/Users/user/.ssh/id_rsa',
  proxy_jump: null,
  already_exists: false,
}

const mockEntry2: SSHConfigEntry = {
  label: 'staging-app',
  host: '10.0.0.5',
  username: 'deploy',
  port: 2222,
  identity_file: null,
  proxy_jump: 'bastion',
  already_exists: false,
}

const mockExistingEntry: SSHConfigEntry = {
  label: 'existing-server',
  host: '172.16.0.1',
  username: 'admin',
  port: 22,
  identity_file: null,
  proxy_jump: null,
  already_exists: true,
}

const mockServer: Server = {
  id: 'server-1',
  group_id: null,
  label: 'prod-web-01',
  host: '192.168.1.100',
  port: 22,
  username: 'root',
  auth_type: 'key',
  key_id: 'key-1',
  proxy_jump: null,
  startup_cmd: null,
  notes: null,
  color: null,
  sort_order: 0,
  last_connected_at: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
}

describe('SSHConfigImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset hook states
    mockHookState = {
      previewData: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    }
    mockMutationState = {
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      data: null,
    }
    mockStoreState = {
      sshConfigImportOpen: false,
      openSSHConfigImport: vi.fn(),
      closeSSHConfigImport: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal visibility', () => {
    it('renders nothing when sshConfigImportOpen is false', () => {
      mockStoreState.sshConfigImportOpen = false

      const { container } = render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(container.firstChild).toBeNull()
    })

    it('renders modal when sshConfigImportOpen is true', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('导入 SSH Config')).toBeInTheDocument()
    })
  })

  describe('Preview button', () => {
    it('shows "导入 SSH Config" button that triggers preview', async () => {
      const user = userEvent.setup()
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = null

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      const previewButton = screen.getByRole('button', { name: /导入 ssh config/i })
      expect(previewButton).toBeInTheDocument()

      await user.click(previewButton)

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('Preview list display', () => {
    it('shows label, host, username, port for each entry', async () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      // Check first entry
      expect(screen.getByText('prod-web-01')).toBeInTheDocument()
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument()
      expect(screen.getByText('root')).toBeInTheDocument()
      expect(screen.getByText('22')).toBeInTheDocument()

      // Check second entry
      expect(screen.getByText('staging-app')).toBeInTheDocument()
      expect(screen.getByText('10.0.0.5')).toBeInTheDocument()
      expect(screen.getByText('deploy')).toBeInTheDocument()
      expect(screen.getByText('2222')).toBeInTheDocument()
    })

    it('displays identity_file when present', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(screen.getByText('/Users/user/.ssh/id_rsa')).toBeInTheDocument()
    })

    it('does not display identity_file when null', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry2] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      // identity_file is null for mockEntry2, should not appear
      expect(screen.queryByText('id_rsa')).not.toBeInTheDocument()
    })
  })

  describe('Checkbox selection', () => {
    it('has checkbox for each entry', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
    })

    it('defaults all non-existing entries to checked', async () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Wait for useEffect to set default selections and re-render
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
        expect(checkboxes[0]).toBeChecked()
        expect(checkboxes[1]).toBeChecked()
      })
    })

    it('toggles checkbox when clicked', async () => {
      const user = userEvent.setup()
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Wait for useEffect to set default selections
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
        expect(checkboxes[0]).toBeChecked()
      })

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
      await user.click(checkboxes[0])

      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked()
      })
    })
  })

  describe('Already exists entries', () => {
    it('marks already_exists entries with "已存在" text', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockExistingEntry] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(screen.getByText('已存在')).toBeInTheDocument()
    })

    it('unchecks already_exists entries by default', async () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockExistingEntry] }

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Wait for useEffect to set default selections
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
        // First entry (not existing) should be checked
        expect(checkboxes[0]).toBeChecked()
        // Second entry (existing) should be unchecked
        expect(checkboxes[1]).not.toBeChecked()
      })
    })

    it('disables checkbox for already_exists entries', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockExistingEntry] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox).toBeDisabled()
    })

    it('grays out already_exists entries', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockExistingEntry] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      // Find the entry row and check it has the existing class
      const entryRow = screen.getByText('existing-server').closest('.ssh-import-entry')
      expect(entryRow).toHaveClass('existing')
    })
  })

  describe('Confirm button', () => {
    it('shows confirm button with count "确认导入 (N 项)"', async () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Wait for useEffect to set default selections
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /确认导入.*2.*项/i })).toBeInTheDocument()
      })
    })

    it('updates count when entries are unchecked', async () => {
      const user = userEvent.setup()
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Initially shows 2 items - wait for useEffect
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /确认导入.*2.*项/i })).toBeInTheDocument()
      })

      // Uncheck first entry
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      // Should now show 1 item
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /确认导入.*1.*项/i })).toBeInTheDocument()
      })
    })

    it('is disabled when no entries are selected', async () => {
      const user = userEvent.setup()
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1] }

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Wait for useEffect to set default selections
      let confirmButton: HTMLElement | null = null
      await waitFor(() => {
        confirmButton = screen.getByRole('button', { name: /确认导入.*1.*项/i })
        expect(confirmButton).not.toBeDisabled()
      })

      // Uncheck the only entry
      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      await waitFor(() => {
        expect(confirmButton).toBeDisabled()
      })
    })
  })

  describe('Import flow', () => {
    it('shows loading state during import', async () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1] }
      mockMutationState.isPending = true

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      // When isPending is true, button shows "导入中..." instead of "确认导入"
      const confirmButton = screen.getByRole('button', { name: /导入中/i })
      expect(confirmButton).toBeDisabled()
      expect(screen.getByText(/导入中/i)).toBeInTheDocument()
    })

    it('calls mutate with selected labels on confirm', async () => {
      const user = userEvent.setup()
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1, mockEntry2] }
      mockMutationState.mutate = mockMutate

      await act(async () => {
        render(<SSHConfigImport />, { wrapper: createWrapper() })
      })

      // Wait for useEffect to set default selections
      let confirmButton: HTMLElement | null = null
      await waitFor(() => {
        confirmButton = screen.getByRole('button', { name: /确认导入.*2.*项/i })
      })
      await user.click(confirmButton!)

      // TanStack Query v5 mutate() only takes one argument (the variables)
      expect(mockMutate).toHaveBeenCalledWith(['prod-web-01', 'staging-app'])
    })

    it('shows success message after import', async () => {
      const { addToast } = await import('../../stores/toastStore')
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1] }
      mockMutationState.isSuccess = true
      mockMutationState.data = { imported_count: 1, servers: [mockServer] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      // Component should show success state
      await waitFor(() => {
        expect(addToast).toHaveBeenCalledWith('success', '成功导入 1 台服务器')
      })
    })

    it('closes modal and refreshes servers list after successful import', async () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1] }
      mockMutationState.isSuccess = true
      mockMutationState.data = { imported_count: 1, servers: [mockServer] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      // Modal should close after success
      await waitFor(() => {
        expect(mockStoreState.closeSSHConfigImport).toHaveBeenCalled()
      })
    })
  })

  describe('Cancel button', () => {
    it('calls closeSSHConfigImport when cancel button is clicked', async () => {
      const user = userEvent.setup()
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [mockEntry1] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      const cancelButton = screen.getByRole('button', { name: /取消/i })
      await user.click(cancelButton)

      expect(mockStoreState.closeSSHConfigImport).toHaveBeenCalled()
    })
  })

  describe('Loading and error states', () => {
    it('shows loading state when preview is loading', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.isLoading = true

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(screen.getByText(/加载中/i)).toBeInTheDocument()
    })

    it('shows error message when preview fails', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.isError = true
      mockHookState.error = new Error('Failed to load SSH config')

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(screen.getByText(/加载失败/i)).toBeInTheDocument()
    })

    it('shows empty state when no entries found', () => {
      mockStoreState.sshConfigImportOpen = true
      mockHookState.previewData = { entries: [] }

      render(<SSHConfigImport />, { wrapper: createWrapper() })

      expect(screen.getByText(/没有找到/i)).toBeInTheDocument()
    })
  })
})
