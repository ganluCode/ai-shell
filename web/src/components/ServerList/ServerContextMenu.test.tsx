import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import ServerContextMenu from './ServerContextMenu'
import type { Server } from '../../types'

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
  color: null,
  sort_order: 0,
  last_connected_at: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
}

describe('ServerContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Context menu display', () => {
    it('shows context menu on right-click with Edit and Delete options', async () => {
      const user = userEvent.setup()

      render(
        <ServerContextMenu
          server={mockServer}
          onEdit={() => {}}
          onDelete={() => {}}
        >
          <button>Server Item</button>
        </ServerContextMenu>,
        { wrapper: createWrapper() }
      )

      // Right-click on the server item
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })
    })

    it('closes context menu when clicking outside', async () => {
      const user = userEvent.setup()

      render(
        <div>
          <ServerContextMenu
            server={mockServer}
            onEdit={() => {}}
            onDelete={() => {}}
          >
            <button>Server Item</button>
          </ServerContextMenu>
          <div data-testid="outside">Outside</div>
        </div>,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument()
      })

      // Click outside
      await user.click(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit action', () => {
    it('calls onEdit callback and closes menu when clicking Edit option', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()

      render(
        <ServerContextMenu
          server={mockServer}
          onEdit={onEdit}
          onDelete={() => {}}
        >
          <button>Server Item</button>
        </ServerContextMenu>,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument()
      })

      // Click edit
      await user.click(screen.getByRole('menuitem', { name: /edit/i }))

      await waitFor(() => {
        expect(onEdit).toHaveBeenCalledWith(mockServer)
        expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete action', () => {
    it('shows delete confirmation dialog when clicking Delete option', async () => {
      const user = userEvent.setup()

      render(
        <ServerContextMenu
          server={mockServer}
          onEdit={() => {}}
          onDelete={() => {}}
        >
          <button>Server Item</button>
        </ServerContextMenu>,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })

      // Click delete
      await user.click(screen.getByRole('menuitem', { name: /delete/i }))

      await waitFor(() => {
        // Check for the dialog heading
        expect(screen.getByRole('heading', { name: /confirm delete/i })).toBeInTheDocument()
      })
    })

    it('shows confirmation message with server label and warning about command records', async () => {
      const user = userEvent.setup()

      render(
        <ServerContextMenu
          server={mockServer}
          onEdit={() => {}}
          onDelete={() => {}}
        >
          <button>Server Item</button>
        </ServerContextMenu>,
        { wrapper: createWrapper() }
      )

      // Open context menu and click delete
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /delete/i }))

      await waitFor(() => {
        // Check for the confirmation message with server label
        expect(screen.getByText(/confirm delete server.*production web/i)).toBeInTheDocument()
        // Check for the warning about command records
        expect(screen.getByText(/associated command records will also be deleted/i)).toBeInTheDocument()
      })
    })

    it('calls onDelete callback when confirming delete', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()

      render(
        <ServerContextMenu
          server={mockServer}
          onEdit={() => {}}
          onDelete={onDelete}
        >
          <button>Server Item</button>
        </ServerContextMenu>,
        { wrapper: createWrapper() }
      )

      // Open context menu and click delete
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm.*delete/i })).toBeInTheDocument()
      })

      // Confirm delete
      await user.click(screen.getByRole('button', { name: /confirm.*delete/i }))

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith(mockServer)
      })
    })

    it('does not call onDelete when canceling delete', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()

      render(
        <ServerContextMenu
          server={mockServer}
          onEdit={() => {}}
          onDelete={onDelete}
        >
          <button>Server Item</button>
        </ServerContextMenu>,
        { wrapper: createWrapper() }
      )

      // Open context menu and click delete
      const serverItem = screen.getByRole('button', { name: /server item/i })
      await user.pointer([{ target: serverItem }, { keys: '[MouseRight]', target: serverItem }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })

      // Cancel delete
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(onDelete).not.toHaveBeenCalled()
      })
    })
  })
})
