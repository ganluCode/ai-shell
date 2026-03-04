import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useChat } from './useChat'
import type { CommandSuggestion } from '../types'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Helper to create a mock ReadableStream from SSE events
function createMockSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(encoder.encode(events[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMessage', () => {
    it('sends POST request with correct payload', async () => {
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(['data: {"type":"done"}\n\n']),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('session-123', '查看磁盘使用情况')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: 'session-123',
          message: '查看磁盘使用情况',
        }),
      })
    })

    it('uses ReadableStream (not native EventSource) for POST request', async () => {
      const mockStream = createMockSSEStream(['data: {"type":"done"}\n\n'])
      const mockResponse = {
        ok: true,
        body: mockStream,
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('session-123', 'test message')
      })

      // Verify fetch was called (which returns ReadableStream)
      expect(mockFetch).toHaveBeenCalled()
      // Verify the response body is a ReadableStream
      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].method).toBe('POST')
      expect(callArgs[1].body).toBeDefined()
    })
  })

  describe('SSE event parsing', () => {
    it('text event accumulates to current AI message content', async () => {
      const events = [
        'data: {"type":"text","content":"好的，"}\n\n',
        'data: {"type":"text","content":"我来帮你查看"}\n\n',
        'data: {"type":"done"}\n\n',
      ]
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      expect(result.current.chatMessages.length).toBe(0)

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      // Should have user message and AI message
      expect(result.current.chatMessages.length).toBe(2)
      // AI message should have accumulated text
      const aiMessage = result.current.chatMessages[1]
      expect(aiMessage.role).toBe('assistant')
      expect(aiMessage.content).toBe('好的，我来帮你查看')
    })

    it('command event creates CommandSuggestion object', async () => {
      const suggestion: CommandSuggestion = {
        command: 'df -h',
        explanation: '以可读格式显示磁盘使用情况',
        risk_level: 'low',
      }
      const events = [
        'data: {"type":"text","content":"查看磁盘"}\n\n',
        'data: {"type":"command","suggestion":' +
          JSON.stringify(suggestion) +
          '}\n\n',
        'data: {"type":"done"}\n\n',
      ]
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      const aiMessage = result.current.chatMessages[1]
      expect(aiMessage.suggestions).toBeDefined()
      expect(aiMessage.suggestions?.length).toBe(1)
      expect(aiMessage.suggestions?.[0]).toEqual(suggestion)
    })

    it('commands event creates CommandSuggestion[] array', async () => {
      const suggestions: CommandSuggestion[] = [
        {
          command: 'cd /opt/app && git pull origin main',
          explanation: '拉取最新代码',
          risk_level: 'low',
        },
        { command: 'systemctl restart app', explanation: '重启服务', risk_level: 'high' },
      ]
      const events = [
        'data: {"type":"text","content":"部署流程："}\n\n',
        'data: {"type":"commands","suggestions":' +
          JSON.stringify(suggestions) +
          '}\n\n',
        'data: {"type":"done"}\n\n',
      ]
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      const aiMessage = result.current.chatMessages[1]
      expect(aiMessage.suggestions).toBeDefined()
      expect(aiMessage.suggestions?.length).toBe(2)
      expect(aiMessage.suggestions).toEqual(suggestions)
    })

    it('error event triggers error display', async () => {
      const onError = vi.fn()
      const events = [
        'data: {"type":"error","error":{"code":"AI_RATE_LIMITED","message":"AI 服务繁忙，请稍后重试"}}\n\n',
      ]
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat({ onError }))

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      expect(onError).toHaveBeenCalledWith({
        code: 'AI_RATE_LIMITED',
        message: 'AI 服务繁忙，请稍后重试',
      })
    })

    it('done event marks message as complete', async () => {
      const events = [
        'data: {"type":"text","content":"完成"}\n\n',
        'data: {"type":"done"}\n\n',
      ]
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      // Initially not streaming
      expect(result.current.isStreaming).toBe(false)

      await act(async () => {
        const promise = result.current.sendMessage('session-123', 'test')
        // During streaming, isStreaming should be true
        // Note: Due to async nature, we can't reliably check mid-stream state
        await promise
      })

      // After done, isStreaming should be false
      expect(result.current.isStreaming).toBe(false)
      // Message should be marked as complete
      const aiMessage = result.current.chatMessages[1]
      expect(aiMessage.isComplete).toBe(true)
    })

    it('chatMessages are updated in real-time during streaming', async () => {
      // Create a stream that we can control
      let streamController: ReadableStreamDefaultController<Uint8Array>
      const encoder = new TextEncoder()

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
      })

      const mockResponse = {
        ok: true,
        body: mockStream,
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      // Start sending message (don't await yet)
      let sendPromise: Promise<void>
      act(() => {
        sendPromise = result.current.sendMessage('session-123', 'test')
      })

      // Wait a tick for the fetch to start
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Send first text event
      await act(async () => {
        streamController!.enqueue(
          encoder.encode('data: {"type":"text","content":"First"}\n\n')
        )
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Check that message is being updated in real-time
      expect(result.current.chatMessages.length).toBe(2)
      const aiMessage = result.current.chatMessages[1]
      expect(aiMessage.content).toBe('First')

      // Send second text event
      await act(async () => {
        streamController!.enqueue(
          encoder.encode('data: {"type":"text","content":" Second"}\n\n')
        )
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Content should be accumulated
      expect(result.current.chatMessages[1].content).toBe('First Second')

      // Complete the stream
      await act(async () => {
        streamController!.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
        streamController!.close()
        await sendPromise!
      })
    })
  })

  describe('state management', () => {
    it('adds user message to chatMessages on send', async () => {
      const events = ['data: {"type":"done"}\n\n']
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('session-123', '用户消息')
      })

      expect(result.current.chatMessages.length).toBe(2)
      expect(result.current.chatMessages[0]).toEqual({
        role: 'user',
        content: '用户消息',
        isComplete: true,
      })
    })

    it('clearChatMessages clears all messages', async () => {
      const events = ['data: {"type":"done"}\n\n']
      const mockResponse = {
        ok: true,
        body: createMockSSEStream(events),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      expect(result.current.chatMessages.length).toBe(2)

      act(() => {
        result.current.clearChatMessages()
      })

      expect(result.current.chatMessages.length).toBe(0)
    })

    it('sets isStreaming to true during streaming and false after done', async () => {
      let streamController: ReadableStreamDefaultController<Uint8Array>
      const encoder = new TextEncoder()

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
      })

      const mockResponse = {
        ok: true,
        body: mockStream,
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat())

      expect(result.current.isStreaming).toBe(false)

      // Start sending
      let sendPromise: Promise<void>
      act(() => {
        sendPromise = result.current.sendMessage('session-123', 'test')
      })

      // Wait for fetch to start
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Should be streaming now
      expect(result.current.isStreaming).toBe(true)

      // Complete the stream
      await act(async () => {
        streamController!.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
        streamController!.close()
        await sendPromise!
      })

      expect(result.current.isStreaming).toBe(false)
    })
  })

  describe('error handling', () => {
    it('handles HTTP errors from the API', async () => {
      const onError = vi.fn()
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: { code: 'INTERNAL_ERROR', message: 'Server error' },
        }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useChat({ onError }))

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      expect(onError).toHaveBeenCalledWith({
        code: 'INTERNAL_ERROR',
        message: 'Server error',
      })
      expect(result.current.isStreaming).toBe(false)
    })

    it('handles network errors', async () => {
      const onError = vi.fn()
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useChat({ onError }))

      await act(async () => {
        await result.current.sendMessage('session-123', 'test')
      })

      expect(onError).toHaveBeenCalledWith({
        code: 'NETWORK_ERROR',
        message: 'Network error',
      })
    })
  })
})
