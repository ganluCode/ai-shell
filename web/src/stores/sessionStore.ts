import { create } from 'zustand'
import type { Session } from '../types'

interface SessionState {
  sessions: Record<string, Session>
  activeSessionId: string | null
}

interface SessionActions {
  openSession: (session: Session) => void
  closeSession: (sessionId: string) => void
  setActiveSession: (sessionId: string | null) => void
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
}))
