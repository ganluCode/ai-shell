import { create } from 'zustand'
import type { Session, ConnectionStatus } from '../types'

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
}))
