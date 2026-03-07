import { useCallback } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useChat } from '../../hooks/useChat'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import './index.css'

function AiChat() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const sessions = useSessionStore((state) => state.sessions)
  const { chatMessages, isStreaming, sendMessage } = useChat()

  const activeSession = activeSessionId ? sessions[activeSessionId] : null

  const handleSend = useCallback(
    (message: string) => {
      if (activeSession?.server_id) {
        sendMessage(activeSession.server_id, message)
      }
    },
    [activeSession?.server_id, sendMessage]
  )

  return (
    <div className="ai-chat" role="region" aria-label="AI Chat">
      <MessageList messages={chatMessages} />
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        hasActiveSession={!!activeSessionId}
      />
    </div>
  )
}

export default AiChat
