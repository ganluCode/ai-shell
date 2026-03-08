import { useState, useCallback, useRef } from 'react'
import type { CommandSuggestion, ChatEvent, RiskLevel } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  suggestions?: CommandSuggestion[]
  isComplete: boolean
}

export interface ChatError {
  code: string
  message: string
}

export interface UseChatOptions {
  onError?: (error: ChatError) => void
}

export interface UseChatReturn {
  chatMessages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (sessionId: string, message: string) => Promise<void>
  clearChatMessages: () => void
}

// ============================================================================
// SSE Parsing Utilities
// ============================================================================

/**
 * Parses SSE data lines from the stream
 * Each line should be in format: "data: <json>"
 */
function parseSSELine(line: string): ChatEvent | null {
  const dataPrefix = 'data: '
  if (!line.startsWith(dataPrefix)) {
    return null
  }

  const jsonStr = line.slice(dataPrefix.length).trim()
  if (!jsonStr) {
    return null
  }

  try {
    return JSON.parse(jsonStr) as ChatEvent
  } catch {
    return null
  }
}

/**
 * Accumulates SSE lines and returns complete events
 * Handles multi-line chunks and incomplete lines
 */
function processSSEChunk(
  chunk: string,
  buffer: string
): { events: ChatEvent[]; newBuffer: string } {
  const combined = buffer + chunk
  const lines = combined.split('\n')

  // Keep the last incomplete line in buffer
  const newBuffer = lines.pop() || ''

  const events: ChatEvent[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      const event = parseSSELine(trimmed)
      if (event) {
        events.push(event)
      }
    }
  }

  return { events, newBuffer }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { onError } = options

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Use ref for error callback to avoid stale closure issues
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const sendMessage = useCallback(
    async (serverId: string, message: string) => {
      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        isComplete: true,
      }

      // Create initial AI message placeholder
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        suggestions: [],
        isComplete: false,
      }

      setChatMessages((prev) => [...prev, userMessage, aiMessage])
      setIsStreaming(true)

      try {
        const response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            server_id: serverId,
            message,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          const error: ChatError = {
            code: errorData.error?.code || 'HTTP_ERROR',
            message:
              errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          }
          onErrorRef.current?.(error)
          setIsStreaming(false)
          return
        }

        if (!response.body) {
          onErrorRef.current?.({
            code: 'NO_BODY',
            message: 'Response body is null',
          })
          setIsStreaming(false)
          return
        }

        // Process the ReadableStream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const { events, newBuffer } = processSSEChunk(chunk, buffer)
          buffer = newBuffer

          // Process each event and update state
          for (const event of events) {
            setChatMessages((prev) => {
              const newMessages = [...prev]
              const lastMessage = newMessages[newMessages.length - 1]

              // Only update if last message is from assistant
              if (lastMessage?.role !== 'assistant') {
                return prev
              }

              switch (event.type) {
                case 'text':
                  // Accumulate text content
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + event.content,
                  }
                  break

                case 'command': {
                  // Backend sends {type:"command", command, explanation, risk_level}
                  const evt = event as Record<string, unknown>
                  const suggestion = {
                    command: evt.command as string,
                    explanation: evt.explanation as string,
                    risk_level: evt.risk_level as RiskLevel,
                  }
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    suggestions: [...(lastMessage.suggestions || []), suggestion],
                  }
                  break
                }

                case 'commands': {
                  // Backend sends {type:"commands", commands: [{command, explanation, risk_level}, ...]}
                  const cmdsEvt = event as Record<string, unknown>
                  const commands = cmdsEvt.commands as Array<Record<string, unknown>>
                  const suggestions = commands.map((cmd) => ({
                    command: cmd.command as string,
                    explanation: cmd.explanation as string,
                    risk_level: cmd.risk_level as RiskLevel,
                  }))
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    suggestions: [...(lastMessage.suggestions || []), ...suggestions],
                  }
                  break
                }

                case 'error':
                  // Trigger error callback
                  onErrorRef.current?.(event.error)
                  break

                case 'done':
                  // Mark message as complete
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    isComplete: true,
                  }
                  break
              }

              return newMessages
            })
          }
        }
      } catch (error) {
        const chatError: ChatError = {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown network error',
        }
        onErrorRef.current?.(chatError)
      } finally {
        setIsStreaming(false)
      }
    },
    []
  )

  const clearChatMessages = useCallback(() => {
    setChatMessages([])
  }, [])

  return {
    chatMessages,
    isStreaming,
    sendMessage,
    clearChatMessages,
  }
}
