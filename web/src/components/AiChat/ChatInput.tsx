import { useState, useCallback, useRef } from 'react'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (message: string) => void
  isStreaming: boolean
  hasActiveSession: boolean
}

function ChatInput({ onSend, isStreaming, hasActiveSession }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDisabled = isStreaming || !hasActiveSession

  const handleSend = useCallback(() => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue && !isDisabled) {
      onSend(trimmedValue)
      setInputValue('')
    }
  }, [inputValue, isDisabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      // Shift+Enter allows new line (default behavior)
    },
    [handleSend]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value)
    },
    []
  )

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [])

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={adjustTextareaHeight}
          placeholder={hasActiveSession ? '输入消息...' : '请先连接服务器'}
          disabled={isDisabled}
          aria-label="消息输入框"
          aria-busy={isStreaming}
          rows={1}
        />
        <button
          className="chat-input-send-button"
          onClick={handleSend}
          disabled={isDisabled || !inputValue.trim()}
          aria-label="发送消息"
          type="button"
        >
          发送
        </button>
      </div>
    </div>
  )
}

export default ChatInput
