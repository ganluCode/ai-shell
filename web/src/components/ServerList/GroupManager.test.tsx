import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import GroupManager from './GroupManager'
import * as api from '../../services/api'
import type { ServerGroup, Server } from '../../types'

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

// Mock group data
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
    label: 'Prod Web',
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
  },
  {
    id: 'server-2',
    group_id: 'group-1',
    label: 'Prod DB',
    host: 'db.example.com',
    port: 22,
    username: 'admin',
    auth_type: 'key',
    key_id: 'key-1',
    proxy_jump: null,
    startup_cmd: null,
    notes: null,
    color: null,
    sort_order: 1,
    last_connected_at: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
]

describe('GroupManager', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getGroups').mockResolvedValue(mockGroups)
    vi.spyOn(api, 'getServers').mockResolvedValue(mockServers)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Context menu', () => {
    it('shows context menu on right-click with edit name, edit color, delete options', async () => {
      const user = userEvent.setup()

      render(
        <GroupManager
          group={mockGroups[0]}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Right-click on the group header
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit name/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /edit color/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })
    })

    it('closes context menu when clicking outside', async () => {
      const user = userEvent.setup()

      render(
        <div>
          <GroupManager
            group={mockGroups[0]}
            onContextMenuChange={() => {}}
          />
          <div data-testid="outside">Outside</div>
        </div>,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit name/i })).toBeInTheDocument()
      })

      // Click outside
      await user.click(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /edit name/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit group name', () => {
    it('shows edit name dialog when clicking edit name option', async () => {
      const user = userEvent.setup()

      render(
        <GroupManager
          group={mockGroups[0]}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit name/i })).toBeInTheDocument()
      })

      // Click edit name
      await user.click(screen.getByRole('menuitem', { name: /edit name/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/group name/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      })
    })

    it('calls updateGroup API when saving new name', async () => {
      const user = userEvent.setup()
      const mockUpdateGroup = vi.fn().mockResolvedValue(mockGroups[0])
      vi.spyOn(api, 'updateGroup').mockImplementation(mockUpdateGroup)

      render(
        <GroupManager
          group={mockGroups[0]}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu and click edit name
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit name/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /edit name/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/group name/i)).toBeInTheDocument()
      })

      // Change name
      const nameInput = screen.getByLabelText(/group name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Production Updated')

      // Save
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group-1', expect.objectContaining({
          name: 'Production Updated',
        }))
      })
    })
  })

  describe('Color picker', () => {
    it('shows color picker with 6-8 preset colors when clicking edit color', async () => {
      const user = userEvent.setup()

      render(
        <GroupManager
          group={mockGroups[0]}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit color/i })).toBeInTheDocument()
      })

      // Click edit color
      await user.click(screen.getByRole('menuitem', { name: /edit color/i }))

      await waitFor(() => {
        // Check for color picker buttons (should be 6-8 preset colors)
        const colorButtons = screen.getAllByRole('button', { name: /color/i })
        expect(colorButtons.length).toBeGreaterThanOrEqual(6)
        expect(colorButtons.length).toBeLessThanOrEqual(8)
      })
    })

    it('calls updateGroup API when selecting a color', async () => {
      const user = userEvent.setup()
      const mockUpdateGroup = vi.fn().mockResolvedValue(mockGroups[0])
      vi.spyOn(api, 'updateGroup').mockImplementation(mockUpdateGroup)

      render(
        <GroupManager
          group={mockGroups[0]}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu and click edit color
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /edit color/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /edit color/i }))

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /color/i }).length).toBeGreaterThan(0)
      })

      // Click first color option
      const colorButtons = screen.getAllByRole('button', { name: /color/i })
      await user.click(colorButtons[0])

      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group-1', expect.objectContaining({
          color: expect.any(String),
        }))
      })
    })
  })

  describe('Delete group', () => {
    it('shows delete confirmation dialog with warning about affected servers', async () => {
      const user = userEvent.setup()

      render(
        <GroupManager
          group={mockGroups[0]}
          servers={mockServers.filter(s => s.group_id === mockGroups[0].id)}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
      })

      // Click delete
      await user.click(screen.getByRole('menuitem', { name: /delete/i }))

      await waitFor(() => {
        // Check for the dialog heading
        expect(screen.getByRole('heading', { name: /confirm delete/i })).toBeInTheDocument()
        expect(screen.getByText(/2 server/i)).toBeInTheDocument() // 2 servers in this group
      })
    })

    it('calls deleteGroup API when confirming delete', async () => {
      const user = userEvent.setup()
      const mockDeleteGroup = vi.fn().mockResolvedValue(undefined)
      vi.spyOn(api, 'deleteGroup').mockImplementation(mockDeleteGroup)

      render(
        <GroupManager
          group={mockGroups[0]}
          servers={mockServers.filter(s => s.group_id === mockGroups[0].id)}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu and click delete
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

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
        // The mutation was called
        expect(mockDeleteGroup).toHaveBeenCalled()
        // Check the first argument is the group id
        const callArgs = mockDeleteGroup.mock.calls[0]
        expect(callArgs[0]).toBe('group-1')
      })
    })

    it('does not call deleteGroup API when canceling delete', async () => {
      const user = userEvent.setup()
      const mockDeleteGroup = vi.fn().mockResolvedValue(undefined)
      vi.spyOn(api, 'deleteGroup').mockImplementation(mockDeleteGroup)

      render(
        <GroupManager
          group={mockGroups[0]}
          servers={mockServers.filter(s => s.group_id === mockGroups[0].id)}
          onContextMenuChange={() => {}}
        />,
        { wrapper: createWrapper() }
      )

      // Open context menu and click delete
      const groupHeader = screen.getByRole('button', { name: /production/i })
      await user.pointer([{ target: groupHeader }, { keys: '[MouseRight]', target: groupHeader }])

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
        expect(mockDeleteGroup).not.toHaveBeenCalled()
      })
    })
  })
})

describe('GroupManager - Create group button', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getGroups').mockResolvedValue(mockGroups)
    vi.spyOn(api, 'getServers').mockResolvedValue(mockServers)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows create group form when clicking add group button', async () => {
    const user = userEvent.setup()

    render(
      <GroupManager
        group={null}
        onContextMenuChange={() => {}}
      />,
      { wrapper: createWrapper() }
    )

    // Find and click the add group button
    const addButton = screen.getByRole('button', { name: /\+.*group|add.*group/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText(/group name/i)).toBeInTheDocument()
    })
  })

  it('calls createGroup API when submitting new group', async () => {
    const user = userEvent.setup()
    const mockCreateGroup = vi.fn().mockResolvedValue(mockGroups[0])
    vi.spyOn(api, 'createGroup').mockImplementation(mockCreateGroup)

    render(
      <GroupManager
        group={null}
        onContextMenuChange={() => {}}
      />,
      { wrapper: createWrapper() }
    )

    // Click add group button
    const addButton = screen.getByRole('button', { name: /\+.*group|add.*group/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText(/group name/i)).toBeInTheDocument()
    })

    // Enter group name
    const nameInput = screen.getByLabelText(/group name/i)
    await user.type(nameInput, 'New Group')

    // Submit
    await user.click(screen.getByRole('button', { name: /create|save/i }))

    await waitFor(() => {
      // The mutation was called
      expect(mockCreateGroup).toHaveBeenCalled()
      // Check the first argument contains the group name
      const callArgs = mockCreateGroup.mock.calls[0]
      expect(callArgs[0]).toMatchObject({
        name: 'New Group',
      })
    })
  })
})
