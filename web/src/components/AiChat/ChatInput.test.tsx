import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatInput from './ChatInput'

describe('ChatInput', () => {
  const mockOnSend = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('renders a text input field', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders a send button', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      expect(screen.getByRole('button', { name: /发送/i })).toBeInTheDocument()
    })
  })

  describe('Enter key behavior', () => {
    it('sends message when Enter key is pressed', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '查看磁盘使用情况{enter}')

      expect(mockOnSend).toHaveBeenCalledWith('查看磁盘使用情况')
    })

    it('inserts new line when Shift+Enter is pressed', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '第一行{Shift>}{enter}{/Shift}第二行')

      // Should NOT call onSend for Shift+Enter
      expect(mockOnSend).not.toHaveBeenCalled()
      // Should have new line in the textarea
      expect(input).toHaveValue('第一行\n第二行')
    })

    it('does not send empty message on Enter', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '{enter}')

      expect(mockOnSend).not.toHaveBeenCalled()
    })

    it('does not send whitespace-only message on Enter', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '   {enter}')

      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('Send button behavior', () => {
    it('triggers message send when clicked', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '查看日志')

      const sendButton = screen.getByRole('button', { name: /发送/i })
      await user.click(sendButton)

      expect(mockOnSend).toHaveBeenCalledWith('查看日志')
    })

    it('does not send empty message when clicked', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const sendButton = screen.getByRole('button', { name: /发送/i })
      await user.click(sendButton)

      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('Input clearing', () => {
    it('clears input after successful send', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '测试消息{enter}')

      expect(mockOnSend).toHaveBeenCalledWith('测试消息')
      expect(input).toHaveValue('')
    })

    it('clears input after send button click', async () => {
      const user = userEvent.setup()
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, '按钮发送测试')

      const sendButton = screen.getByRole('button', { name: /发送/i })
      await user.click(sendButton)

      expect(input).toHaveValue('')
    })
  })

  describe('Disabled states', () => {
    it('disables input while streaming (waiting for done event)', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={true}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('disables send button while streaming', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={true}
          hasActiveSession={true}
        />
      )

      const sendButton = screen.getByRole('button', { name: /发送/i })
      expect(sendButton).toBeDisabled()
    })

    it('disables input when no active session', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={false}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('shows placeholder "请先连接服务器" when no active session', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={false}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', '请先连接服务器')
    })

    it('shows normal placeholder when session is active', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).not.toHaveAttribute('placeholder', '请先连接服务器')
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label for input', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-label', '消息输入框')
    })

    it('has proper aria-label for send button', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={false}
          hasActiveSession={true}
        />
      )

      const sendButton = screen.getByRole('button', { name: /发送/i })
      expect(sendButton).toHaveAttribute('aria-label', '发送消息')
    })

    it('indicates disabled state to screen readers when streaming', () => {
      render(
        <ChatInput
          onSend={mockOnSend}
          isStreaming={true}
          hasActiveSession={true}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-busy', 'true')
    })
  })
})
