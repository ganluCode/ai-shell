import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import ServerList from './index'
import * as api from '../../services/api'
import type { Server, ServerGroup } from '../../types'

// Mock the uiStore
const mockOpenSettings = vi.fn()
const mockOpenServerForm = vi.fn()

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn((selector) => {
    const state = {
      settingsOpen: false,
      serverFormOpen: false,
      editingServerId: null,
      openSettings: mockOpenSettings,
      closeSettings: vi.fn(),
      openServerForm: mockOpenServerForm,
      closeServerForm: vi.fn(),
    }
    return selector(state)
  }),
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

describe('ServerList', () => {
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

  const mockServers: Server[] = [
    {
      id: 'server-1',
      group_id: 'group-1',
      label: 'Prod Web Server',
      host: 'prod-web.example.com',
      port: 22,
      username: 'admin',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 0,
      last_connected_at: '2025-01-15T10:00:00Z',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'server-2',
      group_id: 'group-1',
      label: 'Prod DB Server',
      host: 'prod-db.example.com',
      port: 22,
      username: 'admin',
      auth_type: 'password',
      key_id: null,
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 1,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'server-3',
      group_id: 'group-2',
      label: 'Dev Server',
      host: 'dev.example.com',
      port: 22,
      username: 'dev',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 0,
      last_connected_at: '2025-01-14T10:00:00Z',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'server-4',
      group_id: null,
      label: 'Standalone Server',
      host: 'standalone.example.com',
      port: 22,
      username: 'root',
      auth_type: 'password',
      key_id: null,
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 0,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.spyOn(api, 'getGroups').mockResolvedValue(mockGroups)
    vi.spyOn(api, 'getServers').mockResolvedValue(mockServers)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Server list rendering', () => {
    it('renders servers grouped by group_id', async () => {
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument()
      })

      // Check group headers are displayed
      expect(screen.getByText('Production')).toBeInTheDocument()
      expect(screen.getByText('Development')).toBeInTheDocument()

      // Check servers are displayed under correct groups
      expect(screen.getByText('Prod Web Server')).toBeInTheDocument()
      expect(screen.getByText('Prod DB Server')).toBeInTheDocument()
      expect(screen.getByText('Dev Server')).toBeInTheDocument()
    })

    it('displays ungrouped servers in "Ungrouped" section', async () => {
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Ungrouped')).toBeInTheDocument()
      })

      // Check standalone server is in Ungrouped section
      expect(screen.getByText('Standalone Server')).toBeInTheDocument()
    })

    it('displays each server item with label, host, and connection status icon', async () => {
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Prod Web Server')).toBeInTheDocument()
      })

      // Check server label is displayed
      expect(screen.getByText('Prod Web Server')).toBeInTheDocument()

      // Check host is displayed
      expect(screen.getByText('prod-web.example.com')).toBeInTheDocument()

      // Check connection status icon is present (using aria-label or role)
      const serverItems = screen.getAllByRole('button', { name: /select server/i })
      expect(serverItems.length).toBeGreaterThan(0)
    })

    it('displays empty state when no servers exist', async () => {
      vi.spyOn(api, 'getServers').mockResolvedValueOnce([])
      vi.spyOn(api, 'getGroups').mockResolvedValueOnce(mockGroups)

      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/no servers/i)).toBeInTheDocument()
      })
    })
  })

  describe('Group collapse/expand', () => {
    it('groups can be collapsed by clicking group header', async () => {
      const user = userEvent.setup()
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument()
      })

      // Initially servers should be visible
      expect(screen.getByText('Prod Web Server')).toBeInTheDocument()

      // Click on group header to collapse
      const productionHeader = screen.getByRole('button', { name: /toggle production group/i })
      await user.click(productionHeader)

      // Servers in collapsed group should not be visible
      await waitFor(() => {
        expect(screen.queryByText('Prod Web Server')).not.toBeInTheDocument()
      })
    })

    it('collapsed groups can be expanded by clicking group header', async () => {
      const user = userEvent.setup()
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument()
      })

      // Collapse the group
      const productionHeader = screen.getByRole('button', { name: /toggle production group/i })
      await user.click(productionHeader)

      await waitFor(() => {
        expect(screen.queryByText('Prod Web Server')).not.toBeInTheDocument()
      })

      // Expand the group
      await user.click(productionHeader)

      await waitFor(() => {
        expect(screen.getByText('Prod Web Server')).toBeInTheDocument()
      })
    })
  })

  describe('Server selection', () => {
    it('single click selects server', async () => {
      const user = userEvent.setup()
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Prod Web Server')).toBeInTheDocument()
      })

      // Click on a server item
      const serverItem = screen.getByRole('button', { name: /select server prod web server/i })
      await user.click(serverItem)

      // Server should be selected (indicated by aria-pressed or data attribute)
      expect(serverItem).toHaveAttribute('aria-pressed', 'true')
    })

    it('clicking different server deselects previous selection', async () => {
      const user = userEvent.setup()
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Prod Web Server')).toBeInTheDocument()
      })

      // Click first server
      const firstServer = screen.getByRole('button', { name: /select server prod web server/i })
      await user.click(firstServer)
      expect(firstServer).toHaveAttribute('aria-pressed', 'true')

      // Click second server
      const secondServer = screen.getByRole('button', { name: /select server prod db server/i })
      await user.click(secondServer)
      expect(secondServer).toHaveAttribute('aria-pressed', 'true')
      expect(firstServer).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('Action buttons', () => {
    it('[+ New Server] button opens server form', async () => {
      const user = userEvent.setup()
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument()
      })

      // Click New Server button
      const newServerButton = screen.getByRole('button', { name: /new server/i })
      await user.click(newServerButton)

      expect(mockOpenServerForm).toHaveBeenCalled()
    })

    it('[Settings] button opens settings panel', async () => {
      const user = userEvent.setup()
      render(<ServerList />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument()
      })

      // Click Settings button
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)

      expect(mockOpenSettings).toHaveBeenCalled()
    })
  })
})
