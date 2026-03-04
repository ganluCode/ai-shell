import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../types'
import CommandCard from './CommandCard'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessage[]
}

function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const prevContentRef = useRef<string>('')

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
                {message.suggestions.map((suggestion, sIndex) => (
                  <CommandCard
                    key={sIndex}
                    suggestion={suggestion}
                  />
                ))}
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
