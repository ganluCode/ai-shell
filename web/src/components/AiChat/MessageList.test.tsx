import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MessageList from './MessageList'
import type { ChatMessage, CommandSuggestion } from '../../types'

// Mock CommandCard component (F-005 not implemented yet)
vi.mock('./CommandCard', () => ({
  default: ({ suggestion }: { suggestion: CommandSuggestion }) => (
    <div data-testid="command-card" data-command={suggestion.command}>
      {suggestion.command}
    </div>
  ),
}))

describe('MessageList', () => {
  const mockScrollIntoView = vi.fn()

  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = mockScrollIntoView
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Empty state', () => {
    it('displays "有什么可以帮你的？" when no messages', () => {
      render(<MessageList messages={[]} />)

      expect(screen.getByText('有什么可以帮你的？')).toBeInTheDocument()
    })
  })

  describe('User messages', () => {
    it('renders user messages with correct content', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '查看磁盘使用情况', isComplete: true },
      ]

      render(<MessageList messages={messages} />)

      expect(screen.getByText('查看磁盘使用情况')).toBeInTheDocument()
    })

    it('renders user messages with right-aligned style', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '用户消息', isComplete: true },
      ]

      render(<MessageList messages={messages} />)

      const messageContainer = screen.getByText('用户消息').closest('.message')
      expect(messageContainer).toHaveClass('message-user')
    })

    it('renders multiple user messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '第一条消息', isComplete: true },
        { role: 'assistant', content: '回复', isComplete: true },
        { role: 'user', content: '第二条消息', isComplete: true },
      ]

      render(<MessageList messages={messages} />)

      expect(screen.getByText('第一条消息')).toBeInTheDocument()
      expect(screen.getByText('第二条消息')).toBeInTheDocument()
    })
  })

  describe('AI messages', () => {
    it('renders AI text messages with correct content', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: '好的，我来帮你查看磁盘使用情况', isComplete: true },
      ]

      render(<MessageList messages={messages} />)

      expect(screen.getByText('好的，我来帮你查看磁盘使用情况')).toBeInTheDocument()
    })

    it('renders AI messages with left-aligned style', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'AI回复', isComplete: true },
      ]

      render(<MessageList messages={messages} />)

      const messageContainer = screen.getByText('AI回复').closest('.message')
      expect(messageContainer).toHaveClass('message-assistant')
    })
  })

  describe('Streaming text', () => {
    it('displays streaming text in real-time', () => {
      const { rerender } = render(
        <MessageList
          messages={[{ role: 'assistant', content: '好的', isComplete: false }]}
        />
      )

      expect(screen.getByText('好的')).toBeInTheDocument()

      // Simulate streaming update
      rerender(
        <MessageList
          messages={[
            { role: 'assistant', content: '好的，我来帮你', isComplete: false },
          ]}
        />
      )

      expect(screen.getByText('好的，我来帮你')).toBeInTheDocument()
    })

    it('shows streaming indicator for incomplete messages', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: '正在思考...', isComplete: false },
      ]

      render(<MessageList messages={messages} />)

      // Should have streaming indicator (cursor animation)
      const messageBubble = screen.getByText('正在思考...').closest('.message-bubble')
      expect(messageBubble).toHaveClass('streaming')
    })
  })

  describe('Auto-scroll', () => {
    it('auto-scrolls to bottom when new content arrives', () => {
      const { rerender } = render(
        <MessageList
          messages={[{ role: 'user', content: '消息1', isComplete: true }]}
        />
      )

      // Add a new message
      rerender(
        <MessageList
          messages={[
            { role: 'user', content: '消息1', isComplete: true },
            { role: 'assistant', content: '消息2', isComplete: true },
          ]}
        />
      )

      expect(mockScrollIntoView).toHaveBeenCalled()
    })

    it('auto-scrolls when streaming content updates', () => {
      const { rerender } = render(
        <MessageList
          messages={[{ role: 'assistant', content: '开始', isComplete: false }]}
        />
      )

      mockScrollIntoView.mockClear()

      // Update streaming content
      rerender(
        <MessageList
          messages={[
            { role: 'assistant', content: '开始继续', isComplete: false },
          ]}
        />
      )

      expect(mockScrollIntoView).toHaveBeenCalled()
    })
  })

  describe('Command suggestions', () => {
    it('renders CommandCard for messages with suggestions', () => {
      const suggestion: CommandSuggestion = {
        command: 'df -h',
        explanation: '显示磁盘使用情况',
        risk_level: 'low',
      }
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '建议执行以下命令：',
          suggestions: [suggestion],
          isComplete: true,
        },
      ]

      render(<MessageList messages={messages} />)

      expect(screen.getByTestId('command-card')).toBeInTheDocument()
      expect(screen.getByText('df -h')).toBeInTheDocument()
    })

    it('renders multiple CommandCards for multiple suggestions', () => {
      const suggestions: CommandSuggestion[] = [
        { command: 'df -h', explanation: '显示磁盘使用情况', risk_level: 'low' },
        { command: 'du -sh /var', explanation: '查看/var目录大小', risk_level: 'low' },
      ]
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '建议执行以下命令：',
          suggestions,
          isComplete: true,
        },
      ]

      render(<MessageList messages={messages} />)

      const commandCards = screen.getAllByTestId('command-card')
      expect(commandCards).toHaveLength(2)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA role for message list', () => {
      render(<MessageList messages={[]} />)

      const list = screen.getByRole('log')
      expect(list).toBeInTheDocument()
      expect(list).toHaveAttribute('aria-label', '聊天消息')
    })

    it('has proper ARIA live region for dynamic content', () => {
      render(<MessageList messages={[]} />)

      const list = screen.getByRole('log')
      expect(list).toHaveAttribute('aria-live', 'polite')
    })
  })
})
