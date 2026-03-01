import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionStore } from './sessionStore'
import type { Session } from '../types'

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useSessionStore.setState({
        sessions: {},
        activeSessionId: null,
      })
    })
  })

  describe('initial state', () => {
    it('should have empty sessions object by default', () => {
      const { sessions } = useSessionStore.getState()
      expect(sessions).toEqual({})
    })

    it('should have activeSessionId as null by default', () => {
      const { activeSessionId } = useSessionStore.getState()
      expect(activeSessionId).toBeNull()
    })
  })

  describe('sessions state', () => {
    it('should store sessions as Record<string, Session>', () => {
      const { openSession } = useSessionStore.getState()

      const testSession: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connecting',
      }

      act(() => {
        openSession(testSession)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-1']).toEqual(testSession)
    })

    it('should allow multiple sessions to be stored', () => {
      const { openSession } = useSessionStore.getState()

      const session1: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
      }
      const session2: Session = {
        id: 'session-2',
        server_id: 'server-2',
        status: 'connecting',
      }

      act(() => {
        openSession(session1)
        openSession(session2)
      })

      const { sessions } = useSessionStore.getState()
      expect(Object.keys(sessions)).toHaveLength(2)
      expect(sessions['session-1']).toEqual(session1)
      expect(sessions['session-2']).toEqual(session2)
    })
  })

  describe('openSession action', () => {
    it('should add a new session to the sessions record', () => {
      const { openSession } = useSessionStore.getState()

      const newSession: Session = {
        id: 'session-new',
        server_id: 'server-1',
        status: 'connecting',
      }

      act(() => {
        openSession(newSession)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-new']).toEqual(newSession)
    })

    it('should update an existing session if ID already exists', () => {
      const { openSession } = useSessionStore.getState()

      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connecting',
      }

      act(() => {
        openSession(session)
      })

      const updatedSession: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
      }

      act(() => {
        openSession(updatedSession)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-1']).toEqual(updatedSession)
    })
  })

  describe('closeSession action', () => {
    it('should remove a session from the sessions record', () => {
      const { openSession, closeSession } = useSessionStore.getState()

      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
      }

      act(() => {
        openSession(session)
      })
      expect(useSessionStore.getState().sessions['session-1']).toBeDefined()

      act(() => {
        closeSession('session-1')
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-1']).toBeUndefined()
    })

    it('should not throw when closing non-existent session', () => {
      const { closeSession } = useSessionStore.getState()

      expect(() => {
        act(() => {
          closeSession('non-existent-session')
        })
      }).not.toThrow()
    })

    it('should reset activeSessionId when closing the active session', () => {
      const { openSession, setActiveSession, closeSession } =
        useSessionStore.getState()

      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
      }

      act(() => {
        openSession(session)
        setActiveSession('session-1')
      })
      expect(useSessionStore.getState().activeSessionId).toBe('session-1')

      act(() => {
        closeSession('session-1')
      })

      expect(useSessionStore.getState().activeSessionId).toBeNull()
    })

    it('should not reset activeSessionId when closing a different session', () => {
      const { openSession, setActiveSession, closeSession } =
        useSessionStore.getState()

      const session1: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
      }
      const session2: Session = {
        id: 'session-2',
        server_id: 'server-2',
        status: 'connected',
      }

      act(() => {
        openSession(session1)
        openSession(session2)
        setActiveSession('session-1')
      })

      act(() => {
        closeSession('session-2')
      })

      expect(useSessionStore.getState().activeSessionId).toBe('session-1')
    })
  })

  describe('setActiveSession action', () => {
    it('should set the activeSessionId', () => {
      const { setActiveSession } = useSessionStore.getState()

      act(() => {
        setActiveSession('session-1')
      })

      expect(useSessionStore.getState().activeSessionId).toBe('session-1')
    })

    it('should allow setting activeSessionId to null', () => {
      const { setActiveSession } = useSessionStore.getState()

      act(() => {
        setActiveSession('session-1')
      })
      expect(useSessionStore.getState().activeSessionId).toBe('session-1')

      act(() => {
        setActiveSession(null)
      })

      expect(useSessionStore.getState().activeSessionId).toBeNull()
    })

    it('should allow switching active session', () => {
      const { setActiveSession } = useSessionStore.getState()

      act(() => {
        setActiveSession('session-1')
      })
      expect(useSessionStore.getState().activeSessionId).toBe('session-1')

      act(() => {
        setActiveSession('session-2')
      })

      expect(useSessionStore.getState().activeSessionId).toBe('session-2')
    })
  })
})
