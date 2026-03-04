import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CommandCard from './CommandCard'
import type { CommandSuggestion } from '../../types'

describe('CommandCard', () => {
  const lowRiskCommand: CommandSuggestion = {
    command: 'ls -la',
    explanation: '列出当前目录的文件',
    risk_level: 'low',
  }

  const mediumRiskCommand: CommandSuggestion = {
    command: 'sudo apt update',
    explanation: '更新软件包列表',
    risk_level: 'medium',
  }

  const highRiskCommand: CommandSuggestion = {
    command: 'rm -rf /var/log/*',
    explanation: '清空日志目录',
    risk_level: 'high',
  }

  const mockOnExecute = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnSkip = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('displays command in monospace font', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const commandElement = screen.getByText('ls -la')
      // Check that the command is in a code element (monospace)
      expect(commandElement.tagName.toLowerCase()).toBe('code')
    })

    it('displays explanation text', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText('列出当前目录的文件')).toBeInTheDocument()
    })
  })

  describe('Risk level styling', () => {
    it('shows green left border for low risk commands', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const card = screen.getByTestId('command-card')
      expect(card).toHaveAttribute('data-risk-level', 'low')
    })

    it('shows yellow left border for medium risk commands', () => {
      render(
        <CommandCard
          suggestion={mediumRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const card = screen.getByTestId('command-card')
      expect(card).toHaveAttribute('data-risk-level', 'medium')
    })

    it('shows red left border with warning for high risk commands', () => {
      render(
        <CommandCard
          suggestion={highRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const card = screen.getByTestId('command-card')
      expect(card).toHaveAttribute('data-risk-level', 'high')
      // Warning icon should be displayed
      expect(screen.getByText(/⚠/)).toBeInTheDocument()
    })
  })

  describe('Execute button', () => {
    it('triggers onExecute callback when execute button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const executeButton = screen.getByRole('button', { name: /执行/i })
      await user.click(executeButton)

      expect(mockOnExecute).toHaveBeenCalledTimes(1)
    })

    it('shows "确认执行" for high risk commands instead of "执行"', () => {
      render(
        <CommandCard
          suggestion={highRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      // The execute button should show "确认执行" text for high risk
      const executeButton = screen.getByRole('button', { name: '执行命令' })
      expect(executeButton).toHaveTextContent('确认执行')
    })
  })

  describe('Edit functionality', () => {
    it('toggles edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const editButton = screen.getByRole('button', { name: /编辑/i })
      await user.click(editButton)

      // Should show an input field in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('confirms edit on Enter key', async () => {
      const user = userEvent.setup()
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const editButton = screen.getByRole('button', { name: /编辑/i })
      await user.click(editButton)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'ls -lah{enter}')

      expect(mockOnEdit).toHaveBeenCalledWith('ls -lah')
    })

    it('cancels edit on Escape key', async () => {
      const user = userEvent.setup()
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const editButton = screen.getByRole('button', { name: /编辑/i })
      await user.click(editButton)

      const input = screen.getByRole('textbox')
      await user.type(input, '{escape}')

      // Should exit edit mode and not call onEdit
      expect(mockOnEdit).not.toHaveBeenCalled()
      // Should show the original command
      expect(screen.getByText('ls -la')).toBeInTheDocument()
    })
  })

  describe('Skip button', () => {
    it('triggers onSkip callback when skip button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByRole('button', { name: /跳过/i })
      await user.click(skipButton)

      expect(mockOnSkip).toHaveBeenCalledTimes(1)
    })
  })

  describe('Execution status', () => {
    it('shows running state when executing', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          status="running"
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText(/执行中/i)).toBeInTheDocument()
    })

    it('shows done state with checkmark when completed', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          status="done"
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText(/✅/)).toBeInTheDocument()
      expect(screen.getByText(/完成/i)).toBeInTheDocument()
    })

    it('hides action buttons when status is done', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          status="done"
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.queryByRole('button', { name: /执行/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /编辑/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /跳过/i })).not.toBeInTheDocument()
    })

    it('hides action buttons when status is running', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          status="running"
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.queryByRole('button', { name: /执行/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /编辑/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /跳过/i })).not.toBeInTheDocument()
    })

    it('shows error state when status is error', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          status="error"
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText(/错误/i)).toBeInTheDocument()
    })

    it('shows skipped state when status is skipped', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          status="skipped"
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      expect(screen.getByText(/已跳过/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label for execute button', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const executeButton = screen.getByRole('button', { name: /执行/i })
      expect(executeButton).toHaveAttribute('aria-label', '执行命令')
    })

    it('has proper aria-label for edit button', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const editButton = screen.getByRole('button', { name: /编辑/i })
      expect(editButton).toHaveAttribute('aria-label', '编辑命令')
    })

    it('has proper aria-label for skip button', () => {
      render(
        <CommandCard
          suggestion={lowRiskCommand}
          onExecute={mockOnExecute}
          onEdit={mockOnEdit}
          onSkip={mockOnSkip}
        />
      )

      const skipButton = screen.getByRole('button', { name: /跳过/i })
      expect(skipButton).toHaveAttribute('aria-label', '跳过命令')
    })
  })
})
