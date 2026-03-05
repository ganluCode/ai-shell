import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandListCard from './CommandListCard'
import type { CommandItem } from '../../types'

const mockCommands: CommandItem[] = [
  {
    id: 'cmd-1',
    command: 'ls -la',
    explanation: 'List all files',
    riskLevel: 'low',
    status: 'pending',
    edited: false,
  },
  {
    id: 'cmd-2',
    command: 'rm -rf /tmp/test',
    explanation: 'Remove test directory',
    riskLevel: 'high',
    status: 'pending',
    edited: false,
  },
  {
    id: 'cmd-3',
    command: 'cat /etc/hosts',
    explanation: 'View hosts file',
    riskLevel: 'medium',
    status: 'done',
    edited: false,
  },
]

describe('CommandListCard', () => {
  const mockOnExecuteAll = vi.fn()
  const mockOnExecuteOneByOne = vi.fn()
  const mockOnExecuteItem = vi.fn()
  const mockOnEditItem = vi.fn()
  const mockOnRemoveItem = vi.fn()
  const mockOnSkipItem = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderCommandListCard = (commands: CommandItem[] = mockCommands) => {
    return render(
      <CommandListCard
        commands={commands}
        onExecuteAll={mockOnExecuteAll}
        onExecuteOneByOne={mockOnExecuteOneByOne}
        onExecuteItem={mockOnExecuteItem}
        onEditItem={mockOnEditItem}
        onRemoveItem={mockOnRemoveItem}
        onSkipItem={mockOnSkipItem}
      />
    )
  }

  describe('Header', () => {
    it('displays header "AI 建议执行以下命令"', () => {
      renderCommandListCard()
      expect(screen.getByText('AI 建议执行以下命令')).toBeInTheDocument()
    })
  })

  describe('Command list rendering', () => {
    it('renders commands as ordered list with index', () => {
      renderCommandListCard()

      // Check for ordered list structure
      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(3)

      // Check for index numbers (1., 2., 3.)
      expect(screen.getByText('1.')).toBeInTheDocument()
      expect(screen.getByText('2.')).toBeInTheDocument()
      expect(screen.getByText('3.')).toBeInTheDocument()
    })

    it('renders command text and explanation for each item', () => {
      renderCommandListCard()

      expect(screen.getByText('ls -la')).toBeInTheDocument()
      expect(screen.getByText('List all files')).toBeInTheDocument()
      expect(screen.getByText('rm -rf /tmp/test')).toBeInTheDocument()
      expect(screen.getByText('Remove test directory')).toBeInTheDocument()
    })

    it('renders risk level tags for each command', () => {
      renderCommandListCard()

      expect(screen.getByText('低风险')).toBeInTheDocument()
      expect(screen.getByText('高风险')).toBeInTheDocument()
      expect(screen.getByText('中风险')).toBeInTheDocument()
    })
  })

  describe('Action buttons for each command', () => {
    it('has Execute button for each pending command', () => {
      renderCommandListCard()

      const executeButtons = screen.getAllByRole('button', { name: '执行命令' })
      // Only pending commands have execute button (cmd-1 and cmd-2)
      expect(executeButtons).toHaveLength(2)
    })

    it('has Edit button for each pending command', () => {
      renderCommandListCard()

      const editButtons = screen.getAllByRole('button', { name: '编辑命令' })
      // Only pending commands have edit button
      expect(editButtons).toHaveLength(2)
    })

    it('has Remove (✕) button for each command', () => {
      renderCommandListCard()

      const removeButtons = screen.getAllByLabelText(/移除命令/)
      expect(removeButtons).toHaveLength(3)
    })

    it('calls onExecuteItem when Execute button is clicked', () => {
      renderCommandListCard()

      const executeButtons = screen.getAllByRole('button', { name: '执行命令' })
      fireEvent.click(executeButtons[0])

      expect(mockOnExecuteItem).toHaveBeenCalledWith('cmd-1')
    })

    it('calls onRemoveItem when Remove button is clicked', () => {
      renderCommandListCard()

      const removeButtons = screen.getAllByLabelText(/移除命令/)
      fireEvent.click(removeButtons[0])

      expect(mockOnRemoveItem).toHaveBeenCalledWith('cmd-1')
    })
  })

  describe('Bottom action buttons', () => {
    it('has "全部执行" button', () => {
      renderCommandListCard()

      expect(screen.getByRole('button', { name: '全部执行' })).toBeInTheDocument()
    })

    it('has "逐条确认执行" button', () => {
      renderCommandListCard()

      expect(screen.getByRole('button', { name: '逐条确认执行' })).toBeInTheDocument()
    })

    it('calls onExecuteAll when "全部执行" is clicked', () => {
      renderCommandListCard()

      fireEvent.click(screen.getByRole('button', { name: '全部执行' }))
      expect(mockOnExecuteAll).toHaveBeenCalled()
    })

    it('calls onExecuteOneByOne when "逐条确认执行" is clicked', () => {
      renderCommandListCard()

      fireEvent.click(screen.getByRole('button', { name: '逐条确认执行' }))
      expect(mockOnExecuteOneByOne).toHaveBeenCalled()
    })
  })

  describe('Command status display', () => {
    it('shows independent status for each command item', () => {
      const commandsWithStatus: CommandItem[] = [
        { ...mockCommands[0], status: 'pending' },
        { ...mockCommands[1], status: 'running' },
        { ...mockCommands[2], status: 'done' },
      ]

      renderCommandListCard(commandsWithStatus)

      // Check status text
      expect(screen.getByText('执行中...')).toBeInTheDocument()
      expect(screen.getByText('✅ 已完成')).toBeInTheDocument()
    })

    it('shows error status for failed commands', () => {
      const commandsWithError: CommandItem[] = [
        { ...mockCommands[0], status: 'error' },
      ]

      renderCommandListCard(commandsWithError)

      expect(screen.getByText('❌ 执行错误')).toBeInTheDocument()
    })

    it('shows skipped status for skipped commands', () => {
      const commandsWithSkipped: CommandItem[] = [
        { ...mockCommands[0], status: 'skipped' },
      ]

      renderCommandListCard(commandsWithSkipped)

      expect(screen.getByText('⊘ 已跳过')).toBeInTheDocument()
    })

    it('pending commands show action buttons, non-pending do not', () => {
      const commandsWithStatus: CommandItem[] = [
        { ...mockCommands[0], status: 'pending' },
        { ...mockCommands[1], status: 'done' },
      ]

      renderCommandListCard(commandsWithStatus)

      // Only 1 execute button for pending command
      const executeButtons = screen.getAllByRole('button', { name: '执行命令' })
      expect(executeButtons).toHaveLength(1)
    })
  })

  describe('Remove functionality', () => {
    it('removes item from list when Remove button is clicked', () => {
      renderCommandListCard()

      // Initial list has 3 items
      expect(screen.getAllByRole('listitem')).toHaveLength(3)

      // Click remove on first item
      const removeButtons = screen.getAllByLabelText(/移除命令/)
      fireEvent.click(removeButtons[0])

      // Should have called onRemoveItem
      expect(mockOnRemoveItem).toHaveBeenCalledWith('cmd-1')
    })
  })

  describe('Edit mode inline editing', () => {
    it('has edit button for pending commands', () => {
      renderCommandListCard()

      const editButtons = screen.getAllByRole('button', { name: '编辑命令' })
      expect(editButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Empty state', () => {
    it('renders nothing when commands array is empty', () => {
      const { container } = renderCommandListCard([])
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria labels for action buttons', () => {
      renderCommandListCard()

      expect(screen.getByRole('button', { name: '全部执行' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '逐条确认执行' })).toBeInTheDocument()
    })

    it('has aria-label for remove buttons', () => {
      renderCommandListCard()

      const removeButtons = screen.getAllByLabelText(/移除命令/)
      expect(removeButtons.length).toBe(3)
    })
  })
})
