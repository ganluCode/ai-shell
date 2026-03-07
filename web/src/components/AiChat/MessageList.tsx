import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessage, CommandStatus } from '../../types'
import { useTerminalStore } from '../../stores/terminalStore'
import CommandCard from './CommandCard'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessage[]
}

function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const prevContentRef = useRef<string>('')
  const sendInput = useTerminalStore((s) => s.sendInput)
  const [commandStatuses, setCommandStatuses] = useState<Record<string, CommandStatus>>({})

  const handleExecute = useCallback((key: string, command: string) => {
    if (!sendInput) return
    setCommandStatuses((prev) => ({ ...prev, [key]: 'running' }))
    sendInput(command + '\r')
    // Mark as done after a short delay (no output tracking yet)
    setTimeout(() => {
      setCommandStatuses((prev) => ({ ...prev, [key]: 'done' }))
    }, 500)
  }, [sendInput])

  const handleSkip = useCallback((key: string) => {
    setCommandStatuses((prev) => ({ ...prev, [key]: 'skipped' }))
  }, [])

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const currentLength = messages.length
    const lastMessage = messages[messages.length - 1]
    const currentContent = lastMessage?.content || ''

    // Scroll if:
    // 1. New message added
    // 2. Content of last message changed (streaming)
    const hasNewMessage = currentLength > prevMessagesLengthRef.current
    const contentChanged =
      currentLength === prevMessagesLengthRef.current &&
      currentContent !== prevContentRef.current

    if (hasNewMessage || contentChanged) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    prevMessagesLengthRef.current = currentLength
    prevContentRef.current = currentContent
  }, [messages])

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="message-list-empty" role="log" aria-label="聊天消息" aria-live="polite">
        <div className="empty-state">
          <span className="empty-icon">💬</span>
          <p className="empty-text">有什么可以帮你的？</p>
        </div>
      </div>
    )
  }

  return (
    <div className="message-list" role="log" aria-label="聊天消息" aria-live="polite">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`message message-${message.role}`}
        >
          <div
            className={`message-bubble ${
              !message.isComplete ? 'streaming' : ''
            }`}
          >
            <div className="message-content">{message.content}</div>

            {/* Render command suggestions if present */}
            {message.suggestions && message.suggestions.length > 0 && (
              <div className="message-suggestions">
                {message.suggestions.map((suggestion, sIndex) => {
                  const cmdKey = `${index}-${sIndex}`
                  return (
                    <CommandCard
                      key={sIndex}
                      suggestion={suggestion}
                      status={commandStatuses[cmdKey]}
                      onExecute={() => handleExecute(cmdKey, suggestion.command)}
                      onSkip={() => handleSkip(cmdKey)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList
