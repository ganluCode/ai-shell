import { create } from 'zustand'
import type { Session, ConnectionStatus, ChatMessage, CommandItem } from '../types'

// Generate a unique session ID
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

interface SessionState {
  sessions: Record<string, Session>
  activeSessionId: string | null
}

interface SessionActions {
  openSession: (session: Session) => void
  createSession: (serverId: string) => string
  closeSession: (sessionId: string) => void
  setActiveSession: (sessionId: string | null) => void
  updateStatus: (sessionId: string, status: ConnectionStatus) => void
  // F-002: Chat message and command queue actions
  addChatMessage: (sessionId: string, message: ChatMessage) => void
  updateLastChatMessage: (
    sessionId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) => void
  setCommandQueue: (sessionId: string, queue: CommandItem[] | null) => void
  updateCommandItem: (
    sessionId: string,
    itemId: string,
    updates: Partial<CommandItem>
  ) => void
  clearCommandQueue: (sessionId: string) => void
}

type SessionStore = SessionState & SessionActions

export const useSessionStore = create<SessionStore>((set) => ({
  // State
  sessions: {},
  activeSessionId: null,

  // Actions
  openSession: (session: Session) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [session.id]: session,
      },
    })),

  createSession: (serverId: string) => {
    const sessionId = generateSessionId()
    const session: Session = {
      id: sessionId,
      server_id: serverId,
      status: 'connecting',
      chatMessages: [],
      commandQueue: null,
    }

    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: session,
      },
      activeSessionId: sessionId,
    }))

    return sessionId
  },

  closeSession: (sessionId: string) =>
    set((state) => ({
      sessions: Object.fromEntries(
        Object.entries(state.sessions).filter(([id]) => id !== sessionId)
      ),
      activeSessionId:
        state.activeSessionId === sessionId ? null : state.activeSessionId,
    })),

  setActiveSession: (sessionId: string | null) =>
    set({ activeSessionId: sessionId }),

  updateStatus: (sessionId: string, status: ConnectionStatus) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            status,
          },
        },
      }
    }),

  // F-002: Chat message actions
  addChatMessage: (sessionId: string, message: ChatMessage) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            chatMessages: [...session.chatMessages, message],
          },
        },
      }
    }),

  updateLastChatMessage: (
    sessionId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session || session.chatMessages.length === 0) return state

      const messages = [...session.chatMessages]
      const lastIndex = messages.length - 1
      messages[lastIndex] = updater(messages[lastIndex])

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            chatMessages: messages,
          },
        },
      }
    }),

  // F-002: Command queue actions
  setCommandQueue: (sessionId: string, queue: CommandItem[] | null) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            commandQueue: queue,
          },
        },
      }
    }),

  updateCommandItem: (
    sessionId: string,
    itemId: string,
    updates: Partial<CommandItem>
  ) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session || !session.commandQueue) return state

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            commandQueue: session.commandQueue.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          },
        },
      }
    }),

  clearCommandQueue: (sessionId: string) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            commandQueue: null,
          },
        },
      }
    }),
}))
